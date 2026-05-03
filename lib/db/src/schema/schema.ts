import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, pgEnum, boolean, varchar, json, index, integer, customType, real, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    if (Array.isArray(value)) return value as unknown as number[];
    return JSON.parse(value);
  },
});

export const appRoleEnum = pgEnum("app_role", ["provider", "seeker"]);
export const engagementStatusEnum = pgEnum("engagement_status", ["active", "paused", "completed"]);
export const msgRoleEnum = pgEnum("msg_role", ["seeker", "agent", "provider"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "ended"]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "paused"]);
export const goalProgressStatusEnum = pgEnum("goal_progress_status", ["pending", "confirmed"]);
export const resourceTypeEnum = pgEnum("resource_type", ["link", "document", "exercise"]);
export const onboardingChatStatusEnum = pgEnum("onboarding_chat_status", ["in_progress", "completed"]);
export const safetyDecisionEnum = pgEnum("safety_decision", ["allow", "soften", "block_with_template", "escalate", "redact"]);
export const safetySeverityEnum = pgEnum("safety_severity", ["info", "low", "medium", "high", "critical"]);
export const calibrationStatusEnum = pgEnum("calibration_status", ["in_progress", "completed", "abandoned"]);
export const reviewLabelEnum = pgEnum("review_label", ["this_is_me", "not_me", "never_say_this", "needs_edit"]);
export const personaExampleSourceEnum = pgEnum("persona_example_source", ["calibration", "review_queue", "manual"]);
export const attachmentKindEnum = pgEnum("attachment_kind", ["image", "audio"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  // Region drives crisis-template localization in the L1 safety gate.
  // "US"   -> CRISIS_TEMPLATE_US (988, 741741, 911)
  // "INTL" -> CRISIS_TEMPLATE_INTL (Samaritans, findahelpline.com, 112)
  // Defaults to US for backward compatibility on existing rows.
  region: text("region").default("US"),
  // IANA time-zone name (e.g. "America/Los_Angeles") used to render
  // scheduled sessions and calendar invites. Defaults to "UTC" until the
  // client reports its detected zone via PATCH /api/user/timezone.
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  role: appRoleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const seekers = pgTable("seekers", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerConfigs = pgTable("provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id),
  title: text("title").notNull(),
  methodology: text("methodology"),
  stages: jsonb("stages").notNull(),
  labels: jsonb("labels").default([]),
  summaryTemplate: jsonb("summary_template").default([]),
  taggingRules: jsonb("tagging_rules").default([]),
  trajectoryRules: jsonb("trajectory_rules").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerAgentConfigs = pgTable("provider_agent_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  coreIdentity: text("core_identity"),
  guidingPrinciples: text("guiding_principles"),
  tone: text("tone"),
  voice: text("voice"),
  rules: text("rules"),
  boundaries: text("boundaries"),
  providerName: text("provider_name"),
  providerTitle: text("provider_title"),
  avatarUrl: text("avatar_url"),
  selectedModel: text("selected_model").default("google/gemini-2.5-flash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const engagements = pgTable("engagements", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").references(() => seekers.id),
  providerId: uuid("provider_id").references(() => users.id),
  status: engagementStatusEnum("status").default("active"),
  // L2 — which playbook (bundle of persona_examples) drives this engagement.
  // Nullable: when null, persona compilation falls back to the provider's
  // default playbook, then to all provider examples (legacy back-compat).
  // FK is declared loosely (no .references) because playbooks is defined
  // later in this file; circular references resolve cleanly at runtime.
  playbookId: uuid("playbook_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  status: sessionStatusEnum("status").default("active"),
  initialStage: text("initial_stage"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  role: msgRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Seeker-initiated "Forget this". When set, the row's content has been
  // hard-overwritten in place (see storage.redactMessage) and the
  // tombstone is kept so coaches see a placeholder for transcript gaps.
  redactedAt: timestamp("redacted_at"),
  redactedBy: uuid("redacted_by").references(() => users.id),
});

// Per-message attachments (photos and voice memos). A seeker message may
// have any number of attachments. For voice memos, `transcript` is filled
// in server-side after Whisper runs over the uploaded blob, and that
// transcript is also folded into the parent message's `content` so the
// L1/L2/L3 pipeline and twin context see the spoken text.
export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .references(() => messages.id, { onDelete: "cascade" })
    .notNull(),
  kind: attachmentKindEnum("kind").notNull(),
  // Canonical `/objects/...` path returned by ObjectStorageService when the
  // upload is normalized. Used both for serving (signed GET) and ACL.
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes"),
  durationS: integer("duration_s"),
  // Audio-only: filled in once transcription completes. Null while the
  // job is in flight; empty string if Whisper returned nothing usable.
  transcript: text("transcript"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  assignedStage: text("assigned_stage"),
  sessionSummary: text("session_summary"),
  keyInsights: jsonb("key_insights").default([]),
  nextAction: text("next_action"),
  trajectoryStatus: text("trajectory_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const progressIndicators = pgTable("progress_indicators", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  type: text("type"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  sessionId: uuid("session_id").references(() => sessions.id),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: goalStatusEnum("status").default("active"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goalProgress = pgTable("goal_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").references(() => goals.id).notNull(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  seekerUserId: uuid("seeker_user_id").references(() => users.id).notNull(),
  note: text("note"),
  status: goalProgressStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
});

export const intakeForms = pgTable("intake_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const intakeResponses = pgTable("intake_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  intakeFormId: uuid("intake_form_id").references(() => intakeForms.id).notNull(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  seekerId: uuid("seeker_id").references(() => seekers.id).notNull(),
  answers: jsonb("answers").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: resourceTypeEnum("type").notNull(),
  url: text("url"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const resourceAssignments = pgTable("resource_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").references(() => resources.id).notNull(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  viewedAt: timestamp("viewed_at"),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerOnboardingChats = pgTable("provider_onboarding_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  messages: jsonb("messages").notNull().default([]),
  status: onboardingChatStatusEnum("status").default("in_progress"),
  generatedConfig: jsonb("generated_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Coach "Inbox triage" — when a coach hits "handled" on an inbox row, write a
// short-lived dismissal so non-alert reasons (no-contact, etc.) get suppressed
// for 24h. Alerts use their own is_read state, so this table only carries the
// transient suppression for everything else.
export const coachInboxDismissals = pgTable(
  "coach_inbox_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => users.id).notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
    dismissedAt: timestamp("dismissed_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    byProviderExpires: index("idx_coach_inbox_dismissals_provider_expires")
      .on(table.providerId, table.expiresAt),
  }),
);

// Expo push tokens registered by the mobile app for a user.
// One row per (userId, token); tokens may rotate per device install.
// `enabled` lets the seeker disable push without deleting registration.
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    token: text("token").notNull().unique(),
    platform: text("platform"),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("IDX_push_tokens_user").on(table.userId),
  }),
);

// connect-pg-simple session table
export const userSessions = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_user_sessions_expire").on(table.expire),
  }),
);

// ============================================================
// Therapist Twin tables (L1 / L2 / L3)
// ============================================================

// Structured "right-to-be-forgotten" log. One row per seeker-initiated
// redaction (message or memory). The corresponding messages / client_memory
// row is also overwritten in place — sensitive content is NOT preserved at
// rest; this table only records that a redaction happened, by whom, and an
// optional user-supplied reason. safety_events still carries an additional
// audit row for the L1 trail.
export const redactions = pgTable("redactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(), // "message" | "memory"
  targetId: uuid("target_id").notNull(),
  seekerUserId: uuid("seeker_user_id").references(() => users.id).notNull(),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  sessionId: uuid("session_id").references(() => sessions.id),
  // Optional: cascaded child redactions get a back-reference so a message
  // redaction can be linked to the memory rows it forgot.
  parentId: uuid("parent_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// L1 — every safety-relevant decision (input check, output check, escalation)
export const safetyEvents = pgTable("safety_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  userId: uuid("user_id").references(() => users.id),
  providerId: uuid("provider_id").references(() => users.id),
  // Allowed stage values:
  //   "input"            — L1 input gate verdict (checkInput)
  //   "output"           — L1 output gate verdict (checkOutput)
  //   "review_label"     — therapist review/calibration "never_say_this" label
  //   "internal_audit"   — caller-side annotation around an internal guarded
  //                        LLM call, carries redacted input/output snippets
  //   "guarded_summary"  — runGuardedLLM aggregate row, written ONLY when the
  //                        output gate did not allow (carries purpose+kind)
  stage: text("stage").notNull(),
  decision: safetyDecisionEnum("decision").notNull(),
  severity: safetySeverityEnum("severity").notNull(),
  reason: text("reason"),
  classifierLabels: jsonb("classifier_labels").default({}),
  inputSnippet: text("input_snippet"),
  outputSnippet: text("output_snippet"),
  templateUsed: text("template_used"),
  agentVersionId: uuid("agent_version_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// L2 — version-pinned compiled persona for reproducibility
export const agentVersions = pgTable("agent_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  version: integer("version").notNull(),
  compiledSystemPrompt: text("compiled_system_prompt").notNull(),
  agentConfigSnapshot: jsonb("agent_config_snapshot").notNull(),
  exampleIds: jsonb("example_ids").default([]),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// L2 — coach-authored playbook: a named bundle of persona_examples that
// captures how the coach wants the AI to handle a recurring situation
// (intake, check-in, harm-reduction, celebration, etc.). One playbook per
// engagement (or the provider's default) drives persona compilation.
export const playbooks = pgTable("playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Exactly one playbook per provider may be the default; enforced by
  // `setDefaultPlaybook` clearing the previous default in a transaction.
  isDefault: boolean("is_default").default(false),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  providerIdx: index("playbooks_provider_idx").on(t.providerId),
}));

// L2 — therapist-approved exemplars (and negative labels) used for retrieval
export const personaExamples = pgTable("persona_examples", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  // Which playbook this example belongs to. Nullable so legacy rows (created
  // before playbooks existed) keep working — they're retrieved as the
  // "unscoped" pool when no playbook is assigned.
  playbookId: uuid("playbook_id").references(() => playbooks.id),
  source: personaExampleSourceEnum("source").notNull(),
  // Therapist's review-queue label, when this row originated there. Distinguishes
  // positive examples ("this_is_me", "needs_edit") from negatives ("not_me",
  // "never_say_this"). Calibration-sourced rows leave this null.
  label: reviewLabelEnum("label"),
  scenario: text("scenario").notNull(),       // synthetic client utterance / context
  // Nullable: negative-label rows (not_me / never_say_this) carry no approved
  // response — only a rejected one and the therapist's signal.
  approvedResponse: text("approved_response"),
  rejectedResponse: text("rejected_response"), // what AI tried that was wrong
  notes: text("notes"),
  tags: jsonb("tags").default([]),
  weight: real("weight").default(1.0),
  embedding: vector("embedding"),
  // Negative labels store isActive=false so retrieval naturally ignores them
  // while preserving the audit trail.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// L2 — calibration sessions (synthetic client conversation)
export const calibrationSessions = pgTable("calibration_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => users.id).notNull(),
  scenarioName: text("scenario_name").notNull(),
  syntheticClientProfile: jsonb("synthetic_client_profile").notNull(),
  transcript: jsonb("transcript").notNull().default([]), // [{role, content, draft, approvedEdit, label}]
  status: calibrationStatusEnum("status").default("in_progress"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Daily mood check-ins from seekers (1–5 score + optional one-line note).
// One row per (seeker, day); resubmits update the same row.
export const moodEntries = pgTable(
  "mood_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seekerId: uuid("seeker_id").references(() => seekers.id).notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id),
    day: date("day").notNull(),
    score: integer("score").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqSeekerDay: uniqueIndex("uniq_mood_seeker_day").on(t.seekerId, t.day),
    seekerIdx: index("mood_seeker_idx").on(t.seekerId),
    engagementIdx: index("mood_engagement_idx").on(t.engagementId),
  }),
);

// Reflection journal — coach-curated prompts and seeker-authored entries.
// A prompt with providerId IS NULL is part of the global starter set.
// A prompt with engagementId set is assigned only to that client; otherwise
// it is available to any client of the providerId.
export const journalPrompts = pgTable(
  "journal_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => users.id),
    engagementId: uuid("engagement_id").references(() => engagements.id),
    text: text("text").notNull(),
    category: text("category").default("general"),
    isArchived: boolean("is_archived").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    providerIdx: index("journal_prompts_provider_idx").on(t.providerId),
    engagementIdx: index("journal_prompts_engagement_idx").on(t.engagementId),
    // Unique starter rows so re-seeding can use ON CONFLICT DO NOTHING and
    // recover from partial states without duplicating built-in prompts.
    starterUnique: uniqueIndex("journal_prompts_starter_unique_idx")
      .on(t.text)
      .where(sql`provider_id IS NULL`),
  }),
);

// Seeker journal entries. `sharedWithCoach=true` exposes the entry to the
// coach via /api/engagements/:id/journal and locks editing.
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seekerId: uuid("seeker_id").references(() => seekers.id).notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id),
    promptId: uuid("prompt_id").references(() => journalPrompts.id),
    body: text("body").notNull(),
    sharedWithCoach: boolean("shared_with_coach").default(false).notNull(),
    sharedAt: timestamp("shared_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    seekerIdx: index("journal_entries_seeker_idx").on(t.seekerId),
    engagementIdx: index("journal_entries_engagement_idx").on(t.engagementId),
  }),
);

// L3 — per-client memory entries with optional embedding
export const clientMemory = pgTable("client_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
  sessionId: uuid("session_id").references(() => sessions.id),
  // Every seeker message that contributed to this memory entry. Stored as
  // a jsonb array of message UUIDs so a single redaction can cascade to
  // every memory derived from any contributing seeker turn (not just the
  // last one in the reflected batch). FK is not enforced because jsonb
  // can't carry one; orphaned IDs are harmless to lookup.
  sourceMessageIds: jsonb("source_message_ids").$type<string[]>().default([]),
  kind: text("kind").notNull(), // "preference" | "boundary" | "fact" | "trigger" | "goal_progress" | "rapport"
  content: text("content").notNull(),
  tags: jsonb("tags").default([]),
  importance: real("importance").default(0.5),
  embedding: vector("embedding"),
  redactedAt: timestamp("redacted_at"),
  redactedBy: uuid("redacted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily inter-session AI micro-nudges. One row per (seekerUserId, day) is the
// expected v1 cadence; the unique index enforces it. Status lifecycle:
//   pending -> sent -> done | skipped | snoozed
//   pending -> blocked (L1 output gate refused)
export const nudges = pgTable(
  "nudges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seekerUserId: uuid("seeker_user_id").references(() => users.id).notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id),
    sourceGoalId: uuid("source_goal_id").references(() => goals.id),
    body: text("body").notNull(),
    // "next_action" | "goal" | "fallback"
    source: text("source").notNull().default("fallback"),
    // "pending" | "sent" | "done" | "skipped" | "snoozed" | "blocked"
    status: text("status").notNull().default("pending"),
    day: date("day").notNull(),
    snoozeUntil: timestamp("snooze_until"),
    sentAt: timestamp("sent_at"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqSeekerDay: uniqueIndex("uniq_nudges_seeker_day").on(t.seekerUserId, t.day),
    seekerIdx: index("nudges_seeker_idx").on(t.seekerUserId),
  }),
);

// Per-seeker nudge preferences. One row per user (seeker) — providers
// don't receive nudges so they never get a row. Window is expressed as
// hours-of-day in the user's timezone (users.timezone). The generator
// only fires when the user's local hour is within [startHour, endHour).
// Defaults: enabled=true, 7:00-11:00 local time (morning).
export const nudgePrefs = pgTable("nudge_prefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  windowStartHour: integer("window_start_hour").notNull().default(7),
  windowEndHour: integer("window_end_hour").notNull().default(11),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI-generated session prep briefs the coach reads before a session.
// Briefs are saved (not regenerated per view); the coach explicitly
// triggers a refresh and can mark the brief as "used in session".
// status lifecycle: "ready" (LLM produced & passed L1 output gate)
//                 | "templated_safety" (L1 wrapped/blocked the output)
//                 | "failed" (composition or LLM call errored)
export const sessionBriefs = pgTable(
  "session_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
    providerId: uuid("provider_id").references(() => users.id).notNull(),
    sections: jsonb("sections").notNull().default({}),
    status: text("status").notNull().default("ready"),
    safetyDecision: text("safety_decision"),
    safetyReason: text("safety_reason"),
    model: text("model"),
    generatedAt: timestamp("generated_at").defaultNow(),
    usedAt: timestamp("used_at"),
    usedInSessionId: uuid("used_in_session_id").references(() => sessions.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    engagementIdx: index("session_briefs_engagement_idx").on(t.engagementId),
  }),
);

// ============================================================
// Scheduled sessions (Task #18 — calendar invites)
// ============================================================
// status lifecycle:
//   "proposed"   — coach has put forward 1–3 candidate slots,
//                  seeker has not picked one yet
//   "confirmed"  — seeker picked a slot; confirmedAt is the chosen UTC
//                  start time; .ics REQUEST sent to both sides
//   "cancelled"  — either side cancelled (cancelReason / cancelledBy set);
//                  .ics CANCEL sent
// Reschedule is in-place: status moves back to "proposed", confirmedAt
// is cleared, proposedSlots is replaced, icsSeq is bumped.
export const scheduledSessions = pgTable(
  "scheduled_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
    providerId: uuid("provider_id").references(() => users.id).notNull(),
    seekerUserId: uuid("seeker_user_id").references(() => users.id).notNull(),
    status: text("status").notNull().default("proposed"),
    // Array of ISO-8601 UTC timestamp strings, length 1..3.
    proposedSlots: jsonb("proposed_slots").notNull().default([]),
    // Chosen UTC start time once status === "confirmed".
    confirmedAt: timestamp("confirmed_at"),
    // IANA time-zone the slots were proposed in (used for .ics rendering
    // and seeker's home-screen banner). Snapshot at propose-time so a
    // user changing their default tz later doesn't rewrite history.
    timezone: text("timezone").notNull().default("UTC"),
    durationMinutes: integer("duration_minutes").notNull().default(50),
    title: text("title").notNull().default("Therapy session"),
    // Stable per-row UID used as the iCalendar UID (METHOD:REQUEST and
    // CANCEL must reuse the same UID for the calendar client to update
    // the right event). Defaults to row id but kept separate so it could
    // be exported/imported across systems.
    icsUid: text("ics_uid").notNull(),
    icsSeq: integer("ics_seq").notNull().default(0),
    cancelReason: text("cancel_reason"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    // Stamped when the 1-hour-before push reminder has been delivered to
    // the seeker, so the lazy reminder check only fires once.
    reminderSentAt: timestamp("reminder_sent_at"),
    createdBy: uuid("created_by").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    engagementIdx: index("scheduled_sessions_engagement_idx").on(t.engagementId),
    seekerIdx: index("scheduled_sessions_seeker_idx").on(t.seekerUserId),
    confirmedIdx: index("scheduled_sessions_confirmed_idx").on(t.confirmedAt),
  }),
);

// One row per coach who has begun Stripe Connect onboarding.
// chargesEnabled / payoutsEnabled / detailsSubmitted mirror the Stripe
// account status fields so the UI can show a clear "needs more info"
// state without round-tripping to Stripe on every render. Updated by
// the account.updated webhook.
export const providerBilling = pgTable(
  "provider_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => users.id).notNull().unique(),
    stripeAccountId: text("stripe_account_id"),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
);

// Coach-defined sliding-scale tiers. Each tier is a (label, amount,
// cadence) bundle the seeker picks from. cadence is either
// "per_session" (charged on each scheduled-session confirm) or
// "monthly" (Stripe subscription with on_behalf_of + transfer_data
// to the coach's connected account).
// stripePriceId is created lazily when the first seeker selects a
// monthly tier — per_session tiers never need a Price.
export const priceTiers = pgTable(
  "price_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => users.id).notNull(),
    label: text("label").notNull(),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    billingCadence: text("billing_cadence").notNull().default("per_session"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    providerIdx: index("price_tiers_provider_idx").on(t.providerId),
  }),
);

// One row per engagement once a tier has been selected. Tracks the
// seeker's Stripe customer (lazy-created on first charge), the active
// subscription id (monthly only), and the last payment status.
// status lifecycle:
//   "none"      — no tier selected yet (row may not exist)
//   "active"    — most recent charge succeeded OR subscription active
//   "past_due"  — last charge failed; new sessions are blocked until
//                 the seeker resolves (re-selects tier / updates card)
//   "canceled"  — subscription cancelled or coach archived the engagement
export const engagementBilling = pgTable(
  "engagement_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id").references(() => engagements.id).notNull().unique(),
    tierId: uuid("tier_id").references(() => priceTiers.id),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePaymentMethodId: text("stripe_payment_method_id"),
    lastPaymentIntentId: text("last_payment_intent_id"),
    status: text("status").notNull().default("none"),
    lastChargedAt: timestamp("last_charged_at"),
    failedAt: timestamp("failed_at"),
    lastFailureMessage: text("last_failure_message"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    engagementIdx: index("engagement_billing_engagement_idx").on(t.engagementId),
  }),
);

// Append-only payment ledger so the seeker UI can show a real history
// even after Stripe objects are archived. Charges from per-session
// PaymentIntents AND subscription invoice payments both land here.
export const billingPayments = pgTable(
  "billing_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id").references(() => engagements.id).notNull(),
    tierId: uuid("tier_id").references(() => priceTiers.id),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull(), // "succeeded" | "failed" | "pending"
    failureMessage: text("failure_message"),
    scheduledSessionId: uuid("scheduled_session_id").references(() => scheduledSessions.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    engagementIdx: index("billing_payments_engagement_idx").on(t.engagementId),
    createdIdx: index("billing_payments_created_idx").on(t.createdAt),
    // Postgres treats multiple NULLs as distinct, so unlinked rows still insert.
    piUnique: uniqueIndex("billing_payments_pi_unique").on(t.stripePaymentIntentId),
    invUnique: uniqueIndex("billing_payments_inv_unique").on(t.stripeInvoiceId),
  }),
);

// Webhook idempotency: event ids are recorded here after the handler
// succeeds so duplicate deliveries from Stripe become no-ops.
export const billingProcessedEvents = pgTable(
  "billing_processed_events",
  {
    eventId: text("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertSeekerSchema = createInsertSchema(seekers).omit({ id: true, createdAt: true });
export const insertProviderConfigSchema = createInsertSchema(providerConfigs).omit({ id: true, createdAt: true });
export const insertProviderAgentConfigSchema = createInsertSchema(providerAgentConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEngagementSchema = createInsertSchema(engagements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, startedAt: true, endedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, redactedAt: true, redactedBy: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });
export const insertProgressIndicatorSchema = createInsertSchema(progressIndicators).omit({ id: true, createdAt: true });
export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalProgressSchema = createInsertSchema(goalProgress).omit({ id: true, createdAt: true, confirmedAt: true, confirmedBy: true });
export const insertIntakeFormSchema = createInsertSchema(intakeForms).omit({ id: true, createdAt: true });
export const insertIntakeResponseSchema = createInsertSchema(intakeResponses).omit({ id: true, completedAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertResourceAssignmentSchema = createInsertSchema(resourceAssignments).omit({ id: true, assignedAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertProviderOnboardingChatSchema = createInsertSchema(providerOnboardingChats).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, createdAt: true, updatedAt: true, lastSeenAt: true });
export const insertSafetyEventSchema = createInsertSchema(safetyEvents).omit({ id: true, createdAt: true });
export const insertAgentVersionSchema = createInsertSchema(agentVersions).omit({ id: true, createdAt: true });
export const insertPersonaExampleSchema = createInsertSchema(personaExamples).omit({ id: true, createdAt: true, embedding: true });
export const insertCalibrationSessionSchema = createInsertSchema(calibrationSessions).omit({ id: true, createdAt: true, completedAt: true });
export const insertClientMemorySchema = createInsertSchema(clientMemory).omit({ id: true, createdAt: true, redactedAt: true, redactedBy: true, embedding: true });
export const insertRedactionSchema = createInsertSchema(redactions).omit({ id: true, createdAt: true });
export type InsertRedaction = z.infer<typeof insertRedactionSchema>;
export type Redaction = typeof redactions.$inferSelect;
export const insertMoodEntrySchema = createInsertSchema(moodEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJournalPromptSchema = createInsertSchema(journalPrompts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true, updatedAt: true, sharedAt: true });
export const insertCoachInboxDismissalSchema = createInsertSchema(coachInboxDismissals).omit({ id: true, dismissedAt: true });
export const insertPlaybookSchema = createInsertSchema(playbooks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNudgeSchema = createInsertSchema(nudges).omit({ id: true, createdAt: true, sentAt: true, respondedAt: true });
export const insertNudgePrefsSchema = createInsertSchema(nudgePrefs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNudgePrefs = z.infer<typeof insertNudgePrefsSchema>;
export type NudgePrefs = typeof nudgePrefs.$inferSelect;
export const insertSessionBriefSchema = createInsertSchema(sessionBriefs).omit({ id: true, createdAt: true, generatedAt: true, usedAt: true, usedInSessionId: true });
export const insertScheduledSessionSchema = createInsertSchema(scheduledSessions).omit({ id: true, createdAt: true, updatedAt: true, reminderSentAt: true, icsSeq: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertSeeker = z.infer<typeof insertSeekerSchema>;
export type InsertProviderConfig = z.infer<typeof insertProviderConfigSchema>;
export type InsertProviderAgentConfig = z.infer<typeof insertProviderAgentConfigSchema>;
export type InsertEngagement = z.infer<typeof insertEngagementSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type InsertProgressIndicator = z.infer<typeof insertProgressIndicatorSchema>;
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertGoalProgress = z.infer<typeof insertGoalProgressSchema>;
export type InsertIntakeForm = z.infer<typeof insertIntakeFormSchema>;
export type InsertIntakeResponse = z.infer<typeof insertIntakeResponseSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertResourceAssignment = z.infer<typeof insertResourceAssignmentSchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertProviderOnboardingChat = z.infer<typeof insertProviderOnboardingChatSchema>;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type InsertSafetyEvent = z.infer<typeof insertSafetyEventSchema>;
export type InsertAgentVersion = z.infer<typeof insertAgentVersionSchema>;
export type InsertPersonaExample = z.infer<typeof insertPersonaExampleSchema>;
export type InsertCalibrationSession = z.infer<typeof insertCalibrationSessionSchema>;
export type InsertClientMemory = z.infer<typeof insertClientMemorySchema>;
export type InsertMoodEntry = z.infer<typeof insertMoodEntrySchema>;
export type InsertJournalPrompt = z.infer<typeof insertJournalPromptSchema>;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type InsertCoachInboxDismissal = z.infer<typeof insertCoachInboxDismissalSchema>;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
export type InsertNudge = z.infer<typeof insertNudgeSchema>;
export type InsertSessionBrief = z.infer<typeof insertSessionBriefSchema>;

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type Seeker = typeof seekers.$inferSelect;
export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type ProviderAgentConfig = typeof providerAgentConfigs.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export const insertMessageAttachmentSchema = createInsertSchema(messageAttachments).omit({ id: true, createdAt: true });
export type InsertMessageAttachment = z.infer<typeof insertMessageAttachmentSchema>;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type ProgressIndicator = typeof progressIndicators.$inferSelect;
export type ClientNote = typeof clientNotes.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalProgress = typeof goalProgress.$inferSelect;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type ResourceAssignment = typeof resourceAssignments.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type ProviderOnboardingChat = typeof providerOnboardingChats.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type SafetyEvent = typeof safetyEvents.$inferSelect;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type PersonaExample = typeof personaExamples.$inferSelect;
export type CalibrationSession = typeof calibrationSessions.$inferSelect;
export type ClientMemory = typeof clientMemory.$inferSelect;
export type MoodEntry = typeof moodEntries.$inferSelect;
export type JournalPrompt = typeof journalPrompts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type CoachInboxDismissal = typeof coachInboxDismissals.$inferSelect;
export type Playbook = typeof playbooks.$inferSelect;
export type Nudge = typeof nudges.$inferSelect;
export type SessionBrief = typeof sessionBriefs.$inferSelect;
export type InsertScheduledSession = z.infer<typeof insertScheduledSessionSchema>;
export type ScheduledSession = typeof scheduledSessions.$inferSelect;

export const insertProviderBillingSchema = createInsertSchema(providerBilling).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPriceTierSchema = createInsertSchema(priceTiers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEngagementBillingSchema = createInsertSchema(engagementBilling).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBillingPaymentSchema = createInsertSchema(billingPayments).omit({ id: true, createdAt: true });
export type InsertProviderBilling = z.infer<typeof insertProviderBillingSchema>;
export type InsertPriceTier = z.infer<typeof insertPriceTierSchema>;
export type InsertEngagementBilling = z.infer<typeof insertEngagementBillingSchema>;
export type InsertBillingPayment = z.infer<typeof insertBillingPaymentSchema>;
export type ProviderBilling = typeof providerBilling.$inferSelect;
export type PriceTier = typeof priceTiers.$inferSelect;
export type EngagementBilling = typeof engagementBilling.$inferSelect;
export type BillingPayment = typeof billingPayments.$inferSelect;
