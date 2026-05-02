/**
 * L2 — Therapist Persona Compilation
 *
 * Combines the static provider config (identity / tone / boundaries) with
 * top-K therapist-approved persona examples retrieved for the current turn.
 *
 * The compiled prompt is wrapped in withConstitution() at the chat layer so
 * the L1 identity always wins.
 */

import { storage } from "../storage";
import { topPersonaExamples, listPersonaExamplesByProvider, bumpAgentVersion } from "./twinStorage";
import { embed } from "../lib/llm";
import type { PersonaExample, ProviderConfig, ProviderAgentConfig } from "@workspace/db";

export interface CompiledPersona {
  systemPrompt: string;
  exampleIds: string[];
  exampleCount: number;
  agentConfig: ProviderAgentConfig | undefined;
  providerConfig: ProviderConfig | undefined;
  selectedModel: string;
}

function renderAgentConfig(agent: ProviderAgentConfig | undefined): string {
  if (!agent) return "";
  const parts: string[] = [];
  if (agent.providerName || agent.providerTitle) {
    parts.push(`## Therapist Identity\nYou are modeled on ${agent.providerName ?? "the therapist"}${
      agent.providerTitle ? `, ${agent.providerTitle}` : ""
    }. Speak as that practice's companion, not as that person.`);
  }
  if (agent.coreIdentity) parts.push(`## Core Identity\n${agent.coreIdentity}`);
  if (agent.guidingPrinciples) parts.push(`## Guiding Principles\n${agent.guidingPrinciples}`);
  if (agent.tone || agent.voice) {
    const tone = agent.tone ? `Tone: ${agent.tone}` : "";
    const voice = agent.voice ? `Voice: ${agent.voice}` : "";
    parts.push(`## Communication Style\n${[tone, voice].filter(Boolean).join("\n")}`);
  }
  if (agent.rules) parts.push(`## Rules\n${agent.rules}`);
  if (agent.boundaries) parts.push(`## Boundaries\n${agent.boundaries}`);
  return parts.join("\n\n");
}

function renderProviderProgram(provider: ProviderConfig | undefined, currentStage?: string | null): string {
  if (!provider) return "";
  const parts: string[] = ["## Program Context"];
  if (provider.title) parts.push(`Program: ${provider.title}`);
  if (provider.methodology) parts.push(`Methodology: ${provider.methodology}`);
  if (currentStage) parts.push(`Current Stage: ${currentStage}`);
  return parts.join("\n");
}

function renderExamples(examples: PersonaExample[]): string {
  if (examples.length === 0) return "";
  const lines = ["## Therapist-Approved Examples", "Use these as STRONG guidance for tone, structure, and what to say:"];
  examples.forEach((ex, i) => {
    lines.push(`\nExample ${i + 1}:`);
    lines.push(`Client said: ${ex.scenario}`);
    lines.push(`Therapist (good response): ${ex.approvedResponse}`);
    if (ex.rejectedResponse) lines.push(`AVOID this kind of response: ${ex.rejectedResponse}`);
    if (ex.notes) lines.push(`Note: ${ex.notes}`);
  });
  return lines.join("\n");
}

export async function compilePersonaForTurn(opts: {
  providerId: string;
  query: string;
  currentStage?: string | null;
}): Promise<CompiledPersona> {
  const [agentConfig, providerConfig] = await Promise.all([
    storage.getProviderAgentConfigByProviderId(opts.providerId),
    storage.getProviderConfigByProviderId(opts.providerId),
  ]);

  const queryEmbedding = await embed(opts.query);
  const examples = await topPersonaExamples(opts.providerId, opts.query, queryEmbedding, 4);

  const sections = [
    renderAgentConfig(agentConfig),
    renderProviderProgram(providerConfig, opts.currentStage ?? null),
    renderExamples(examples),
  ].filter(Boolean);

  const baseFallback = "You are a warm, attentive AI companion supporting a human therapist's practice.";
  const systemPrompt = sections.length > 0 ? sections.join("\n\n") : baseFallback;
  const selectedModel = agentConfig?.selectedModel || "google/gemini-2.5-flash";

  return {
    systemPrompt,
    exampleIds: examples.map((e) => e.id),
    exampleCount: examples.length,
    agentConfig,
    providerConfig,
    selectedModel,
  };
}

/**
 * L2 reproducibility snapshot. Compiles the persona without per-turn retrieval
 * (uses the full set of active persona examples) and writes a new active row
 * to agent_versions, deactivating the previous one. Call this whenever the
 * persona materially changes — onboarding apply, calibration approve/correct,
 * or review-queue label — so each L2 input produces an auditable version.
 */
export async function snapshotAgentVersion(opts: {
  providerId: string;
  reason: string;
  createdBy?: string | null;
}): Promise<void> {
  try {
    const [agentConfig, providerConfig, examples] = await Promise.all([
      storage.getProviderAgentConfigByProviderId(opts.providerId),
      storage.getProviderConfigByProviderId(opts.providerId),
      listPersonaExamplesByProvider(opts.providerId),
    ]);
    const sections = [
      renderAgentConfig(agentConfig),
      renderProviderProgram(providerConfig, null),
      renderExamples(examples),
    ].filter(Boolean);
    const compiledSystemPrompt =
      sections.length > 0
        ? sections.join("\n\n")
        : "You are a warm, attentive AI companion supporting a human therapist's practice.";
    await bumpAgentVersion({
      providerId: opts.providerId,
      reason: opts.reason,
      createdBy: opts.createdBy ?? null,
      agentConfig: (agentConfig as unknown as Record<string, unknown>) ?? null,
      providerConfig: (providerConfig as unknown as Record<string, unknown>) ?? null,
      compiledSystemPrompt,
      exampleIds: examples.map((e) => e.id),
    });
  } catch {
    // Non-fatal: never block the caller's user-visible action on an
    // audit-only snapshot. The next material change will retry.
  }
}
