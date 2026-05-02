import { logger } from "./logger";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const SAFETY_MODEL = "google/gemini-2.5-flash-lite";

function key(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY not configured");
  return k;
}

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function chat(opts: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model || DEFAULT_MODEL,
    messages: opts.messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logger.error({ status: res.status, errText }, "openrouter chat failed");
    throw new Error(`LLM call failed: ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Cheap classifier call. Returns parsed JSON or throws.
 */
export async function classify<T>(prompt: string, schemaHint: string): Promise<T> {
  const raw = await chat({
    model: SAFETY_MODEL,
    temperature: 0,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content:
          "You are a strict classifier. Output ONLY valid JSON matching the requested schema. No prose.",
      },
      { role: "user", content: `${prompt}\n\nSchema: ${schemaHint}` },
    ],
  });
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Best-effort embedding. Returns null if no embedding provider is configured;
 * callers must handle null and fall back to non-vector retrieval.
 *
 * If `OPENAI_API_KEY` is present we call OpenAI's embeddings API directly
 * (Replit's AI-Integrations OpenAI proxy does not currently expose
 * embeddings). Otherwise we return null and the storage layer falls back to
 * recency / tag-based retrieval.
 */
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims — matches schema
const EMBED_URL = "https://api.openai.com/v1/embeddings";

export function embedConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embed(text: string): Promise<number[] | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  try {
    const trimmed = text.slice(0, 8000); // safety: stay well under context
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: trimmed }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText }, "embedding call failed; falling back");
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vec = data.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    logger.warn({ err }, "embedding call threw; falling back");
    return null;
  }
}

// ---------------------------------------------------------------- moderation
//
// OpenAI's content-moderation endpoint. Used by the L1 safety gate as a
// dedicated harm-categories check, in parallel with our regex prescreen and
// LLM crisis classifier. Returns null when the key is missing or the call
// fails — the caller is expected to treat null as "moderation unavailable"
// and fall back to its own conservative behaviour.

export interface ModerationCategoryScores {
  hate?: number;
  "hate/threatening"?: number;
  harassment?: number;
  "harassment/threatening"?: number;
  "self-harm"?: number;
  "self-harm/intent"?: number;
  "self-harm/instructions"?: number;
  sexual?: number;
  "sexual/minors"?: number;
  violence?: number;
  "violence/graphic"?: number;
  [k: string]: number | undefined;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: ModerationCategoryScores;
  model: string;
}

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";

export function moderationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function moderate(text: string): Promise<ModerationResult | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  if (!text || text.trim().length === 0) return null;
  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODERATION_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText }, "moderation call failed");
      return null;
    }
    const data = (await res.json()) as {
      model?: string;
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
        category_scores?: ModerationCategoryScores;
      }>;
    };
    const r = data.results?.[0];
    if (!r) return null;
    return {
      flagged: Boolean(r.flagged),
      categories: r.categories ?? {},
      category_scores: r.category_scores ?? {},
      model: data.model ?? MODERATION_MODEL,
    };
  } catch (err) {
    logger.warn({ err }, "moderation call threw");
    return null;
  }
}
