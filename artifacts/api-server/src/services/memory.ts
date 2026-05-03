/**
 * L3 — Per-Client Adaptation Memory
 *
 * Writes structured memory entries from a session reflection step. Reads
 * top-K relevant entries to weave into the persona prompt for subsequent
 * turns. Therapist may redact or delete any entry from the Memory Inspector.
 */

import { logger } from "../lib/logger";
import { embed } from "../lib/llm";
import { runGuardedLLM } from "./safety";
import { writeClientMemory, topClientMemory } from "./twinStorage";
import type { ClientMemory, Message } from "@workspace/db";

export interface ReflectionEntry {
  kind: "preference" | "boundary" | "fact" | "trigger" | "goal_progress" | "rapport";
  content: string;
  tags: string[];
  importance: number; // 0..1
}

interface ReflectionOutput {
  entries: ReflectionEntry[];
}

const REFLECTION_SYSTEM = `You extract durable, therapist-useful memory entries from a coaching session
transcript. Be concise, factual, and respect privacy: do not record sensitive
identifiers (addresses, phone numbers) or speculation. Output JSON only.`;

const SCHEMA_HINT = `{
  "entries": [
    {
      "kind": "preference"|"boundary"|"fact"|"trigger"|"goal_progress"|"rapport",
      "content": string,            // <= 200 chars, present tense, neutral tone
      "tags": string[],             // 1-4 short lowercase tags
      "importance": number          // 0.0 .. 1.0
    }
  ]
}`;

/** Run after a session ends. Writes 0..N memory entries. */
export async function reflectAndWrite(opts: {
  engagementId: string;
  sessionId: string;
  messages: Message[];
}): Promise<ClientMemory[]> {
  if (opts.messages.length < 2) return [];

  // Conservative cascade attribution: every seeker message in the
  // reflected batch is recorded as a contributing source. Forgetting any
  // of them will then cascade-forget every memory derived from this
  // session, since we can't reliably tell post-hoc which seeker turn
  // produced which entry.
  const sourceMessageIds = opts.messages
    .filter((m) => m.role === "seeker")
    .map((m) => m.id);

  const transcript = opts.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")
    .slice(0, 8000);

  let parsed: ReflectionOutput;
  try {
    // Reflection is internal (provider-side) — still runs through the L1
    // safety gate so we never invoke the LLM without input/output checks.
    const guarded = await runGuardedLLM({
      purpose: "internal_provider",
      kind: "session_reflection",
      ctx: { sessionId: opts.sessionId, engagementId: opts.engagementId },
      jsonMode: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: REFLECTION_SYSTEM },
        {
          role: "user",
          content: `Transcript:\n${transcript}\n\nExtract durable memory entries useful for the next session. Schema: ${SCHEMA_HINT}`,
        },
      ],
    });
    if (guarded.templated) {
      // Safety gate replaced the output with a template — don't ingest it
      // as memory; just skip reflection for this session.
      logger.warn({ sessionId: opts.sessionId }, "reflection blocked by safety gate; skipping memory write");
      return [];
    }
    const cleaned = guarded.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err }, "reflection LLM call failed");
    return [];
  }

  const written: ClientMemory[] = [];
  for (const entry of parsed.entries ?? []) {
    if (!entry?.content) continue;
    const trimmed: ReflectionEntry = {
      kind: entry.kind,
      content: entry.content.slice(0, 240),
      tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 4).map(String) : [],
      importance: Math.min(1, Math.max(0, Number(entry.importance) || 0.5)),
    };
    const embedding = await embed(trimmed.content);
    try {
      const row = await writeClientMemory(
        {
          engagementId: opts.engagementId,
          sessionId: opts.sessionId,
          sourceMessageIds,
          kind: trimmed.kind,
          content: trimmed.content,
          tags: trimmed.tags,
          importance: trimmed.importance,
        },
        embedding,
      );
      written.push(row);
    } catch (err) {
      logger.error({ err }, "failed to persist memory entry");
    }
  }
  return written;
}

/** Read top-K memory snippets to embed in the persona prompt. */
export async function buildMemoryContext(opts: {
  engagementId: string;
  query: string;
  k?: number;
}): Promise<{ block: string; entryIds: string[] }> {
  const queryEmbedding = await embed(opts.query);
  const top = await topClientMemory(opts.engagementId, opts.query, queryEmbedding, opts.k ?? 6);
  if (top.length === 0) return { block: "", entryIds: [] };

  const lines = ["## What I Remember About This Client"];
  for (const m of top) {
    const tags = Array.isArray(m.tags) && m.tags.length > 0 ? ` [${(m.tags as string[]).join(", ")}]` : "";
    lines.push(`- (${m.kind})${tags} ${m.content}`);
  }
  lines.push(
    "\nUse this to feel continuous and attentive. Do not read it back verbatim. " +
      "If something contradicts what the client says now, trust the client and gently update.",
  );
  return { block: lines.join("\n"), entryIds: top.map((t) => t.id) };
}
