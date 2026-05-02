/**
 * Shared TypeScript shapes for Twin JSONB columns. The DB columns are typed as
 * `unknown`/`Json` from drizzle-zod, so we centralize the runtime contracts
 * here and cast at the boundary instead of sprinkling `as any`.
 */

import type { SafetyDecision } from "./safety";

export interface SyntheticClientProfile {
  presenting: string;
  tone: string;
  [k: string]: unknown;
}

export type CalibrationLabel = "this_is_me" | "needs_edit" | "never_say_this" | null;

export interface CalibrationTurn {
  client: string;
  draft: string;
  templated: boolean;
  decision: SafetyDecision;
  approvedEdit: string | null;
  label: CalibrationLabel;
}

export interface ProviderConfigStage {
  name: string;
  description?: string;
  [k: string]: unknown;
}
