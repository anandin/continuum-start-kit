import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

import { api } from "@/lib/api";

const TTS_CACHE_PREFIX = "coach-reply-";
const TTS_CACHE_KEEP = 5;

/**
 * Keep the on-device cache of generated TTS files small. We name files
 * `coach-reply-<timestamp>.mp3` so a lexical sort matches recency. Older
 * files past the keep-window get unlinked best-effort.
 */
function pruneCachedTtsFiles() {
  if (Platform.OS === "web") return;
  try {
    const entries = Paths.cache.list();
    const ours = entries
      .filter(
        (e): e is File =>
          e instanceof File && e.name.startsWith(TTS_CACHE_PREFIX),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const stale = ours.slice(0, Math.max(0, ours.length - TTS_CACHE_KEEP));
    for (const f of stale) {
      try {
        f.delete();
      } catch {
        /* best effort */
      }
    }
  } catch {
    /* best effort */
  }
}

/**
 * Send a recorded audio file URI through the server's Whisper-backed
 * transcription endpoint. The returned text is what the seeker would
 * normally have typed into the chat input — callers should send it
 * through /api/chat to keep the L1/L2/L3 safety + persona pipeline
 * authoritative for spoken input too.
 */
export async function transcribeRecordingUri(opts: {
  uri: string;
  mimeType?: string;
}): Promise<string> {
  const file = new File(opts.uri);
  const audioBase64 = await file.base64();
  const guessedMime = opts.mimeType || guessMimeFromUri(opts.uri);
  const filename = filenameForMime(guessedMime);

  const result = await api<{ text: string }>("/api/voice/transcribe", {
    method: "POST",
    body: JSON.stringify({
      audioBase64,
      mimeType: guessedMime,
      filename,
    }),
  });
  return (result.text || "").trim();
}

/**
 * Fetch base64 TTS audio for a coach reply and stage it as a local file
 * the AudioPlayer can stream from. Writing to a file (rather than playing a
 * `data:` URI) is more reliable across iOS / Android / web in expo-audio.
 */
export async function fetchSpokenReplyUri(opts: {
  sessionId: string;
  messageId: string;
}): Promise<string> {
  const result = await api<{ audioBase64: string; mimeType: string }>(
    "/api/voice/tts",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: opts.sessionId,
        messageId: opts.messageId,
        format: "mp3",
      }),
    },
  );

  if (Platform.OS === "web") {
    // expo-file-system on web lacks the same File primitives, so play
    // straight from a data URL instead.
    return `data:${result.mimeType};base64,${result.audioBase64}`;
  }

  pruneCachedTtsFiles();
  const filename = `${TTS_CACHE_PREFIX}${Date.now()}.mp3`;
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      /* best effort */
    }
  }
  file.create();
  file.write(result.audioBase64, { encoding: "base64" });
  return file.uri;
}

function guessMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".m4a")) return "audio/m4a";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  return "audio/m4a";
}

function filenameForMime(mime: string): string {
  if (mime.includes("mpeg")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  if (mime.includes("webm")) return "voice.webm";
  if (mime.includes("mp4")) return "voice.mp4";
  if (mime.includes("caf")) return "voice.caf";
  return "voice.m4a";
}
