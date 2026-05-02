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
 * OpenRouter does not reliably expose embedding endpoints. We leave this as a
 * stub that can be wired to a Replit AI integration or OpenAI when an API key
 * becomes available.
 */
export async function embed(_text: string): Promise<number[] | null> {
  return null;
}
