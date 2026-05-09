import { logger } from "./logger";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logger.error({ status: res.status, errText }, "openrouter chat failed");
    throw new Error(`LLM call failed: ${res.status}`);
  }
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Cheap classifier call. Returns parsed JSON or throws.
 */
export async function classify<T>(
  prompt: string,
  schemaHint: string,
): Promise<T> {
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
  const cleaned = raw
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
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
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: trimmed }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, errText },
        "embedding call failed; falling back",
      );
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
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

// ---------------------------------------------------------------- transcription
//
// OpenAI Whisper for speech-to-text. Used by the seeker mobile app's
// voice-message flow: recorded audio is shipped as base64, the server
// decodes it and forwards it to Whisper, and the resulting transcript is
// then routed through the normal /api/chat L1/L2/L3 pipeline so that all
// safety/persona/memory invariants still apply to spoken input.

const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const TRANSCRIBE_MODEL = "whisper-1";

export function transcriptionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeAudio(opts: {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
}): Promise<string | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  if (!opts.audioBase64) return null;
  try {
    const buf = Buffer.from(opts.audioBase64, "base64");
    if (buf.length === 0) return null;
    const mime = opts.mimeType || "audio/m4a";
    const filename =
      opts.filename || `voice.${(mime.split("/")[1] || "m4a").split(";")[0]}`;
    const blob = new Blob([new Uint8Array(buf)], { type: mime });

    const form = new FormData();
    form.append("file", blob, filename);
    form.append("model", TRANSCRIBE_MODEL);
    form.append("response_format", "json");
    if (opts.language) form.append("language", opts.language);

    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, errText },
        "whisper transcription failed",
      );
      return null;
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    logger.warn({ err }, "whisper transcription threw");
    return null;
  }
}

// ---------------------------------------------------------------- text-to-speech
//
// OpenAI TTS for reading agent replies back to the seeker. Returns base64
// audio in the requested format so the mobile client can write it to a
// cache file and hand it to expo-audio for playback. The agent reply has
// already been safety-gated before persistence, so we only need to guard
// against runtime/network failures here.

const TTS_URL = "https://api.openai.com/v1/audio/speech";
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE_DEFAULT = "alloy";
const TTS_FORMAT_DEFAULT: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm" =
  "mp3";

export function ttsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function synthesizeSpeech(opts: {
  text: string;
  voice?: string;
  format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}): Promise<{ audioBase64: string; mimeType: string } | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  const text = (opts.text || "").trim();
  if (!text) return null;
  const format = opts.format || TTS_FORMAT_DEFAULT;
  try {
    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: opts.voice || TTS_VOICE_DEFAULT,
        input: text.slice(0, 4000),
        response_format: format,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText }, "openai tts failed");
      return null;
    }
    const ab = await res.arrayBuffer();
    const audioBase64 = Buffer.from(ab).toString("base64");
    const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    return { audioBase64, mimeType };
  } catch (err) {
    logger.warn({ err }, "openai tts threw");
    return null;
  }
}

export async function moderate(text: string): Promise<ModerationResult | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k) return null;
  if (!text || text.trim().length === 0) return null;
  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: text.slice(0, 8000),
      }),
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
