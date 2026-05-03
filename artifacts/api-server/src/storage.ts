import { db } from "./db";
import { eq, and, or, desc, asc, sql, isNull, lt, gte, inArray } from "drizzle-orm";
import {
  users, profiles, userRoles, seekers, providerConfigs, providerAgentConfigs,
  engagements, sessions, messages, summaries, progressIndicators,
  clientNotes, goals, goalProgress, intakeForms, intakeResponses, resources, resourceAssignments, alerts, providerOnboardingChats,
  moodEntries, journalPrompts, journalEntries,
  safetyEvents, coachInboxDismissals,
  pushTokens,
  InsertUser, InsertProfile, InsertUserRole, InsertSeeker, InsertProviderConfig,
  InsertProviderAgentConfig, InsertEngagement, InsertSession, InsertMessage,
  InsertSummary, InsertProgressIndicator,
  InsertClientNote, InsertGoal, InsertGoalProgress, InsertIntakeForm, InsertIntakeResponse,
  InsertResource, InsertResourceAssignment, InsertAlert, InsertProviderOnboardingChat,
  InsertMoodEntry, InsertJournalPrompt, InsertJournalEntry,
  InsertPushToken,
  User, Profile, UserRole, Seeker,
  ProviderConfig, ProviderAgentConfig, Engagement, Session, Message, Summary, ProgressIndicator,
  ClientNote, Goal, GoalProgress, IntakeForm, IntakeResponse, Resource, ResourceAssignment, Alert, ProviderOnboardingChat,
  MoodEntry, JournalPrompt, JournalEntry,
  PushToken,
} from "@workspace/db";

// Coach inbox row — one per active engagement, composed from alerts +
// safety_events + last-message-per-engagement, with severity and reason.
export type CoachInboxSeverity = "critical" | "elevated" | "quiet";
export type CoachInboxReasonKind =
  | "safety"
  | "alerts"
  | "no_contact"
  | "unread_messages";
export interface CoachInboxReason {
  kind: CoachInboxReasonKind;
  label: string;
  timestamp: string | null;
}
export interface CoachInboxRow {
  engagementId: string;
  seekerUserId: string | null;
  seekerAlias: string;
  severity: CoachInboxSeverity;
  reasons: CoachInboxReason[];
  lastMessageAt: string | null;
  unreadAlertCount: number;
  latestSafetyEventAt: string | null;
  activeSessionId: string | null;
  dismissedUntil: string | null;
}

export interface IStorage {
  createUser(data: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserTimezone(userId: string, timezone: string): Promise<User | undefined>;
  
  createProfile(data: InsertProfile): Promise<Profile>;
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  
  createUserRole(data: InsertUserRole): Promise<UserRole>;
  getUserRoleByUserId(userId: string): Promise<UserRole | undefined>;
  
  createSeeker(data: InsertSeeker): Promise<Seeker>;
  getSeekerByOwnerId(ownerId: string): Promise<Seeker | undefined>;
  getSeekerById(id: string): Promise<Seeker | undefined>;
  
  createProviderConfig(data: InsertProviderConfig): Promise<ProviderConfig>;
  getProviderConfigByProviderId(providerId: string): Promise<ProviderConfig | undefined>;
  updateProviderConfig(id: string, data: Partial<InsertProviderConfig>): Promise<ProviderConfig | undefined>;
  getAllProviderConfigs(): Promise<ProviderConfig[]>;
  
  createProviderAgentConfig(data: InsertProviderAgentConfig): Promise<ProviderAgentConfig>;
  getProviderAgentConfigByProviderId(providerId: string): Promise<ProviderAgentConfig | undefined>;
  updateProviderAgentConfig(id: string, data: Partial<InsertProviderAgentConfig>): Promise<ProviderAgentConfig | undefined>;
  
  createEngagement(data: InsertEngagement): Promise<Engagement>;
  getEngagementById(id: string): Promise<Engagement | undefined>;
  getEngagementsBySeekerId(seekerId: string): Promise<Engagement[]>;
  getEngagementsByProviderId(providerId: string): Promise<Engagement[]>;
  updateEngagement(id: string, data: Partial<InsertEngagement>): Promise<Engagement | undefined>;
  
  createSession(data: InsertSession): Promise<Session>;
  getSessionById(id: string): Promise<Session | undefined>;
  getSessionsByEngagementId(engagementId: string): Promise<Session[]>;
  updateSession(id: string, data: Partial<{ status: "active" | "ended"; endedAt: Date }>): Promise<Session | undefined>;
  
  createMessage(data: InsertMessage): Promise<Message>;
  getMessagesBySessionId(sessionId: string): Promise<Message[]>;
  getMessageById(id: string): Promise<Message | undefined>;
  redactMessage(id: string, redactedBy: string): Promise<Message | undefined>;
  
  createSummary(data: InsertSummary): Promise<Summary>;
  getSummaryBySessionId(sessionId: string): Promise<Summary | undefined>;
  
  createProgressIndicator(data: InsertProgressIndicator): Promise<ProgressIndicator>;
  getProgressIndicatorsBySessionId(sessionId: string): Promise<ProgressIndicator[]>;
  getProgressIndicatorsByEngagementId(engagementId: string): Promise<ProgressIndicator[]>;

  // Notes
  createClientNote(data: InsertClientNote): Promise<ClientNote>;
  getClientNotesByEngagementId(engagementId: string): Promise<ClientNote[]>;
  getClientNoteById(id: string): Promise<ClientNote | undefined>;
  updateClientNote(id: string, data: Partial<InsertClientNote>): Promise<ClientNote | undefined>;
  deleteClientNote(id: string): Promise<void>;

  // Goals
  createGoal(data: InsertGoal): Promise<Goal>;
  getGoalsByEngagementId(engagementId: string): Promise<Goal[]>;
  getGoalById(id: string): Promise<Goal | undefined>;
  updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: string): Promise<void>;

  // Goal Progress (seeker self-checkoffs)
  createGoalProgress(data: InsertGoalProgress): Promise<GoalProgress>;
  getPendingGoalProgress(goalId: string, seekerUserId: string): Promise<GoalProgress | undefined>;
  getGoalProgressById(id: string): Promise<GoalProgress | undefined>;
  getGoalProgressByEngagementId(engagementId: string): Promise<GoalProgress[]>;
  updateGoalProgress(id: string, data: Partial<{ note: string | null; status: "pending" | "confirmed"; confirmedAt: Date | null; confirmedBy: string | null }>): Promise<GoalProgress | undefined>;
  deletePendingGoalProgress(goalId: string, seekerUserId: string): Promise<void>;
  confirmGoalProgress(progressId: string, confirmedBy: string): Promise<{ progress: GoalProgress; goal: Goal } | { error: "not_found" | "not_pending" }>;
  resolvePendingProgressForCompletedGoal(goalId: string, confirmedBy: string): Promise<void>;

  // Intake Forms
  createIntakeForm(data: InsertIntakeForm): Promise<IntakeForm>;
  getIntakeFormsByProviderId(providerId: string): Promise<IntakeForm[]>;
  getIntakeFormById(id: string): Promise<IntakeForm | undefined>;
  updateIntakeForm(id: string, data: Partial<InsertIntakeForm>): Promise<IntakeForm | undefined>;
  deleteIntakeForm(id: string): Promise<void>;

  // Intake Responses
  createIntakeResponse(data: InsertIntakeResponse): Promise<IntakeResponse>;
  getIntakeResponseByEngagementId(engagementId: string): Promise<IntakeResponse | undefined>;

  // Resources
  createResource(data: InsertResource): Promise<Resource>;
  getResourcesByProviderId(providerId: string): Promise<Resource[]>;
  getResourceById(id: string): Promise<Resource | undefined>;
  updateResource(id: string, data: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: string): Promise<void>;

  // Resource Assignments
  createResourceAssignment(data: InsertResourceAssignment): Promise<ResourceAssignment>;
  getResourceAssignmentsByEngagementId(engagementId: string): Promise<Array<ResourceAssignment & { resource: Resource }>>;
  getResourceAssignmentById(id: string): Promise<ResourceAssignment | undefined>;
  markResourceViewed(id: string): Promise<void>;

  // Alerts
  createAlert(data: InsertAlert): Promise<Alert>;
  getAlertsByProviderId(providerId: string): Promise<Alert[]>;
  getUnreadAlertCountByProviderId(providerId: string): Promise<number>;
  markAlertRead(id: string, providerId?: string): Promise<void>;
  markAllAlertsRead(providerId: string): Promise<void>;

  // Provider Onboarding Chats
  createProviderOnboardingChat(data: InsertProviderOnboardingChat): Promise<ProviderOnboardingChat>;
  getActiveOnboardingChatByProviderId(providerId: string): Promise<ProviderOnboardingChat | undefined>;
  updateProviderOnboardingChat(id: string, data: Partial<InsertProviderOnboardingChat>): Promise<ProviderOnboardingChat | undefined>;

  // Mood Entries
  upsertMoodEntry(data: InsertMoodEntry): Promise<MoodEntry>;
  getMoodEntriesBySeekerId(seekerId: string, sinceDay: string): Promise<MoodEntry[]>;
  getMoodEntriesByEngagementId(engagementId: string, sinceDay: string): Promise<MoodEntry[]>;

  // Journal Prompts
  createJournalPrompt(data: InsertJournalPrompt): Promise<JournalPrompt>;
  updateJournalPrompt(id: string, data: Partial<InsertJournalPrompt>): Promise<JournalPrompt | undefined>;
  getJournalPromptById(id: string): Promise<JournalPrompt | undefined>;
  listJournalPromptsForCoach(providerId: string, includeArchived?: boolean): Promise<JournalPrompt[]>;
  listAvailableJournalPromptsForSeeker(providerId: string | null, engagementId: string | null): Promise<JournalPrompt[]>;
  countGlobalStarterPrompts(): Promise<number>;
  seedGlobalStarterPrompts(prompts: Array<{ text: string; category: string }>): Promise<void>;

  // Journal Entries
  createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: string, data: Partial<InsertJournalEntry> & { sharedAt?: Date | null }): Promise<JournalEntry | undefined>;
  getJournalEntryById(id: string): Promise<JournalEntry | undefined>;
  listJournalEntriesBySeekerId(seekerId: string): Promise<JournalEntry[]>;
  listSharedJournalEntriesByEngagementId(engagementId: string): Promise<JournalEntry[]>;

  // Coach Inbox triage
  getCoachInboxRows(providerId: string, opts?: { now?: Date }): Promise<CoachInboxRow[]>;
  dismissCoachInboxRow(providerId: string, engagementId: string, opts?: { hours?: number; now?: Date }): Promise<void>;

  // Push Tokens
  upsertPushToken(data: InsertPushToken): Promise<PushToken>;
  getPushTokensByUserId(userId: string, opts?: { onlyEnabled?: boolean }): Promise<PushToken[]>;
  setPushTokensEnabledForUser(userId: string, enabled: boolean): Promise<void>;
  deletePushToken(token: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserTimezone(userId: string, timezone: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ timezone })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createProfile(data: InsertProfile): Promise<Profile> {
    const [profile] = await db.insert(profiles).values(data).returning();
    return profile;
  }

  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async createUserRole(data: InsertUserRole): Promise<UserRole> {
    const [role] = await db.insert(userRoles).values(data).returning();
    return role;
  }

  async getUserRoleByUserId(userId: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return role;
  }

  async createSeeker(data: InsertSeeker): Promise<Seeker> {
    const [seeker] = await db.insert(seekers).values(data).returning();
    return seeker;
  }

  async getSeekerByOwnerId(ownerId: string): Promise<Seeker | undefined> {
    const [seeker] = await db.select().from(seekers).where(eq(seekers.ownerId, ownerId));
    return seeker;
  }

  async getSeekerById(id: string): Promise<Seeker | undefined> {
    const [seeker] = await db.select().from(seekers).where(eq(seekers.id, id));
    return seeker;
  }

  async createProviderConfig(data: InsertProviderConfig): Promise<ProviderConfig> {
    const [config] = await db.insert(providerConfigs).values(data).returning();
    return config;
  }

  async getProviderConfigByProviderId(providerId: string): Promise<ProviderConfig | undefined> {
    const [config] = await db.select().from(providerConfigs).where(eq(providerConfigs.providerId, providerId));
    return config;
  }

  async updateProviderConfig(id: string, data: Partial<InsertProviderConfig>): Promise<ProviderConfig | undefined> {
    const [config] = await db.update(providerConfigs).set(data).where(eq(providerConfigs.id, id)).returning();
    return config;
  }

  async getAllProviderConfigs(): Promise<ProviderConfig[]> {
    return db.select().from(providerConfigs);
  }

  async createProviderAgentConfig(data: InsertProviderAgentConfig): Promise<ProviderAgentConfig> {
    const [config] = await db.insert(providerAgentConfigs).values(data).returning();
    return config;
  }

  async getProviderAgentConfigByProviderId(providerId: string): Promise<ProviderAgentConfig | undefined> {
    const [config] = await db.select().from(providerAgentConfigs)
      .where(eq(providerAgentConfigs.providerId, providerId))
      .orderBy(desc(providerAgentConfigs.createdAt))
      .limit(1);
    return config;
  }

  async updateProviderAgentConfig(id: string, data: Partial<InsertProviderAgentConfig>): Promise<ProviderAgentConfig | undefined> {
    const [config] = await db.update(providerAgentConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerAgentConfigs.id, id))
      .returning();
    return config;
  }

  async createEngagement(data: InsertEngagement): Promise<Engagement> {
    const [engagement] = await db.insert(engagements).values(data).returning();
    return engagement;
  }

  async getEngagementById(id: string): Promise<Engagement | undefined> {
    const [engagement] = await db.select().from(engagements).where(eq(engagements.id, id));
    return engagement;
  }

  async getEngagementsBySeekerId(seekerId: string): Promise<Engagement[]> {
    return db.select().from(engagements).where(eq(engagements.seekerId, seekerId));
  }

  async getEngagementsByProviderId(providerId: string): Promise<Engagement[]> {
    return db.select().from(engagements).where(eq(engagements.providerId, providerId));
  }

  async updateEngagement(id: string, data: Partial<InsertEngagement>): Promise<Engagement | undefined> {
    const [engagement] = await db.update(engagements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(engagements.id, id))
      .returning();
    return engagement;
  }

  async createSession(data: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(data).returning();
    return session;
  }

  async getSessionById(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionsByEngagementId(engagementId: string): Promise<Session[]> {
    return db.select().from(sessions)
      .where(eq(sessions.engagementId, engagementId))
      .orderBy(desc(sessions.startedAt));
  }

  async updateSession(id: string, data: Partial<{ status: "active" | "ended"; endedAt: Date }>): Promise<Session | undefined> {
    const [session] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return session;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(data).returning();
    return message;
  }

  async getMessagesBySessionId(sessionId: string): Promise<Message[]> {
    const rows = await db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
    // Centralized redaction scrub: every caller (transcript endpoint, twin
    // chat context assembly, session-finish summarizer, etc.) sees an empty
    // body for redacted messages while still being able to render a
    // "redacted at HH:MM" placeholder via the redactedAt timestamp.
    // Anything that genuinely needs the raw row (e.g. the redact handler
    // itself) must use getMessageById.
    return rows.map((r) => (r.redactedAt ? { ...r, content: "" } : r));
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const [row] = await db.select().from(messages).where(eq(messages.id, id));
    return row;
  }

  async redactMessage(id: string, redactedBy: string): Promise<Message | undefined> {
    // Hard-overwrite the message body in place so the original text is gone
    // from the database, not just hidden by an API filter. The redactedAt
    // tombstone keeps the row so coaches still see a placeholder.
    const [row] = await db
      .update(messages)
      .set({ content: "", redactedAt: new Date(), redactedBy })
      .where(eq(messages.id, id))
      .returning();
    return row;
  }

  async createSummary(data: InsertSummary): Promise<Summary> {
    const [summary] = await db.insert(summaries).values(data).returning();
    return summary;
  }

  async getSummaryBySessionId(sessionId: string): Promise<Summary | undefined> {
    const [summary] = await db.select().from(summaries).where(eq(summaries.sessionId, sessionId));
    return summary;
  }

  async createProgressIndicator(data: InsertProgressIndicator): Promise<ProgressIndicator> {
    const [indicator] = await db.insert(progressIndicators).values(data).returning();
    return indicator;
  }

  async getProgressIndicatorsBySessionId(sessionId: string): Promise<ProgressIndicator[]> {
    return db.select().from(progressIndicators)
      .where(eq(progressIndicators.sessionId, sessionId))
      .orderBy(desc(progressIndicators.createdAt));
  }

  async getProgressIndicatorsByEngagementId(engagementId: string): Promise<ProgressIndicator[]> {
    return db.select().from(progressIndicators)
      .where(eq(progressIndicators.engagementId, engagementId))
      .orderBy(desc(progressIndicators.createdAt));
  }

  // ============ Notes ============
  async createClientNote(data: InsertClientNote): Promise<ClientNote> {
    const [note] = await db.insert(clientNotes).values(data).returning();
    return note;
  }
  async getClientNotesByEngagementId(engagementId: string): Promise<ClientNote[]> {
    return db.select().from(clientNotes)
      .where(eq(clientNotes.engagementId, engagementId))
      .orderBy(desc(clientNotes.createdAt));
  }
  async getClientNoteById(id: string): Promise<ClientNote | undefined> {
    const [note] = await db.select().from(clientNotes).where(eq(clientNotes.id, id));
    return note;
  }
  async updateClientNote(id: string, data: Partial<InsertClientNote>): Promise<ClientNote | undefined> {
    const [note] = await db.update(clientNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientNotes.id, id)).returning();
    return note;
  }
  async deleteClientNote(id: string): Promise<void> {
    await db.delete(clientNotes).where(eq(clientNotes.id, id));
  }

  // ============ Goals ============
  async createGoal(data: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(goals).values(data).returning();
    return goal;
  }
  async getGoalsByEngagementId(engagementId: string): Promise<Goal[]> {
    return db.select().from(goals)
      .where(eq(goals.engagementId, engagementId))
      .orderBy(desc(goals.createdAt));
  }
  async getGoalById(id: string): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }
  async updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | undefined> {
    const [goal] = await db.update(goals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(goals.id, id)).returning();
    return goal;
  }
  async deleteGoal(id: string): Promise<void> {
    await db.delete(goalProgress).where(eq(goalProgress.goalId, id));
    await db.delete(goals).where(eq(goals.id, id));
  }

  // ============ Goal Progress ============
  async createGoalProgress(data: InsertGoalProgress): Promise<GoalProgress> {
    const [row] = await db.insert(goalProgress).values(data).returning();
    return row;
  }
  async getPendingGoalProgress(goalId: string, seekerUserId: string): Promise<GoalProgress | undefined> {
    const [row] = await db.select().from(goalProgress)
      .where(and(
        eq(goalProgress.goalId, goalId),
        eq(goalProgress.seekerUserId, seekerUserId),
        eq(goalProgress.status, "pending"),
      ))
      .orderBy(desc(goalProgress.createdAt))
      .limit(1);
    return row;
  }
  async getGoalProgressById(id: string): Promise<GoalProgress | undefined> {
    const [row] = await db.select().from(goalProgress).where(eq(goalProgress.id, id));
    return row;
  }
  async getGoalProgressByEngagementId(engagementId: string): Promise<GoalProgress[]> {
    return db.select().from(goalProgress)
      .where(eq(goalProgress.engagementId, engagementId))
      .orderBy(desc(goalProgress.createdAt));
  }
  async updateGoalProgress(
    id: string,
    data: Partial<{ note: string | null; status: "pending" | "confirmed"; confirmedAt: Date | null; confirmedBy: string | null }>,
  ): Promise<GoalProgress | undefined> {
    const [row] = await db.update(goalProgress).set(data).where(eq(goalProgress.id, id)).returning();
    return row;
  }
  async deletePendingGoalProgress(goalId: string, seekerUserId: string): Promise<void> {
    await db.delete(goalProgress).where(and(
      eq(goalProgress.goalId, goalId),
      eq(goalProgress.seekerUserId, seekerUserId),
      eq(goalProgress.status, "pending"),
    ));
  }

  // Atomic confirm: only succeeds if the row is still pending. Updates the
  // progress row and the goal in a single transaction so the two never drift.
  async confirmGoalProgress(
    progressId: string,
    confirmedBy: string,
  ): Promise<{ progress: GoalProgress; goal: Goal } | { error: "not_found" | "not_pending" }> {
    return db.transaction(async (tx) => {
      const [updatedProgress] = await tx.update(goalProgress)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy,
        })
        .where(and(
          eq(goalProgress.id, progressId),
          eq(goalProgress.status, "pending"),
        ))
        .returning();
      if (!updatedProgress) {
        const [existing] = await tx.select().from(goalProgress).where(eq(goalProgress.id, progressId));
        return { error: existing ? "not_pending" as const : "not_found" as const };
      }
      const [updatedGoal] = await tx.update(goals)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(goals.id, updatedProgress.goalId))
        .returning();
      // Auto-resolve any sibling pending rows for the same goal so the
      // coach's "to confirm" badge reflects the now-completed state.
      await tx.update(goalProgress)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy,
        })
        .where(and(
          eq(goalProgress.goalId, updatedProgress.goalId),
          eq(goalProgress.status, "pending"),
        ));
      return { progress: updatedProgress, goal: updatedGoal };
    });
  }

  // Used when the coach completes a goal via the legacy goal-status path so
  // any outstanding pending self-checkoffs get resolved instead of dangling.
  async resolvePendingProgressForCompletedGoal(goalId: string, confirmedBy: string): Promise<void> {
    await db.update(goalProgress)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedBy,
      })
      .where(and(
        eq(goalProgress.goalId, goalId),
        eq(goalProgress.status, "pending"),
      ));
  }

  // ============ Intake Forms ============
  async createIntakeForm(data: InsertIntakeForm): Promise<IntakeForm> {
    const [form] = await db.insert(intakeForms).values(data).returning();
    return form;
  }
  async getIntakeFormsByProviderId(providerId: string): Promise<IntakeForm[]> {
    return db.select().from(intakeForms)
      .where(eq(intakeForms.providerId, providerId))
      .orderBy(desc(intakeForms.createdAt));
  }
  async getIntakeFormById(id: string): Promise<IntakeForm | undefined> {
    const [form] = await db.select().from(intakeForms).where(eq(intakeForms.id, id));
    return form;
  }
  async updateIntakeForm(id: string, data: Partial<InsertIntakeForm>): Promise<IntakeForm | undefined> {
    const [form] = await db.update(intakeForms).set(data).where(eq(intakeForms.id, id)).returning();
    return form;
  }
  async deleteIntakeForm(id: string): Promise<void> {
    await db.delete(intakeForms).where(eq(intakeForms.id, id));
  }

  // ============ Intake Responses ============
  async createIntakeResponse(data: InsertIntakeResponse): Promise<IntakeResponse> {
    const [response] = await db.insert(intakeResponses).values(data).returning();
    return response;
  }
  async getIntakeResponseByEngagementId(engagementId: string): Promise<IntakeResponse | undefined> {
    const [response] = await db.select().from(intakeResponses)
      .where(eq(intakeResponses.engagementId, engagementId))
      .orderBy(desc(intakeResponses.completedAt))
      .limit(1);
    return response;
  }

  // ============ Resources ============
  async createResource(data: InsertResource): Promise<Resource> {
    const [resource] = await db.insert(resources).values(data).returning();
    return resource;
  }
  async getResourcesByProviderId(providerId: string): Promise<Resource[]> {
    return db.select().from(resources)
      .where(eq(resources.providerId, providerId))
      .orderBy(desc(resources.createdAt));
  }
  async getResourceById(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }
  async updateResource(id: string, data: Partial<InsertResource>): Promise<Resource | undefined> {
    const [resource] = await db.update(resources).set(data).where(eq(resources.id, id)).returning();
    return resource;
  }
  async deleteResource(id: string): Promise<void> {
    await db.delete(resourceAssignments).where(eq(resourceAssignments.resourceId, id));
    await db.delete(resources).where(eq(resources.id, id));
  }

  // ============ Resource Assignments ============
  async createResourceAssignment(data: InsertResourceAssignment): Promise<ResourceAssignment> {
    const [assignment] = await db.insert(resourceAssignments).values(data).returning();
    return assignment;
  }
  async getResourceAssignmentsByEngagementId(engagementId: string): Promise<Array<ResourceAssignment & { resource: Resource }>> {
    const rows = await db.select().from(resourceAssignments)
      .innerJoin(resources, eq(resourceAssignments.resourceId, resources.id))
      .where(eq(resourceAssignments.engagementId, engagementId))
      .orderBy(desc(resourceAssignments.assignedAt));
    return rows.map(r => ({ ...r.resource_assignments, resource: r.resources }));
  }
  async getResourceAssignmentById(id: string): Promise<ResourceAssignment | undefined> {
    const [a] = await db.select().from(resourceAssignments).where(eq(resourceAssignments.id, id));
    return a;
  }
  async markResourceViewed(id: string): Promise<void> {
    await db.update(resourceAssignments)
      .set({ viewedAt: new Date() })
      .where(eq(resourceAssignments.id, id));
  }

  // ============ Alerts ============
  async createAlert(data: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(data).returning();
    return alert;
  }
  async getAlertsByProviderId(providerId: string): Promise<Alert[]> {
    return db.select().from(alerts)
      .where(eq(alerts.providerId, providerId))
      .orderBy(desc(alerts.createdAt))
      .limit(50);
  }
  async getUnreadAlertCountByProviderId(providerId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(and(eq(alerts.providerId, providerId), eq(alerts.isRead, false)));
    return result[0]?.count ?? 0;
  }
  async markAlertRead(id: string, providerId?: string): Promise<void> {
    if (providerId) {
      await db.update(alerts).set({ isRead: true }).where(and(eq(alerts.id, id), eq(alerts.providerId, providerId)));
    } else {
      await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
    }
  }
  async markAllAlertsRead(providerId: string): Promise<void> {
    await db.update(alerts).set({ isRead: true }).where(eq(alerts.providerId, providerId));
  }

  // ============ Provider Onboarding Chats ============
  async createProviderOnboardingChat(data: InsertProviderOnboardingChat): Promise<ProviderOnboardingChat> {
    const [chat] = await db.insert(providerOnboardingChats).values(data).returning();
    return chat;
  }
  async getActiveOnboardingChatByProviderId(providerId: string): Promise<ProviderOnboardingChat | undefined> {
    const [chat] = await db.select().from(providerOnboardingChats)
      .where(and(eq(providerOnboardingChats.providerId, providerId), eq(providerOnboardingChats.status, "in_progress")))
      .orderBy(desc(providerOnboardingChats.createdAt))
      .limit(1);
    return chat;
  }
  async updateProviderOnboardingChat(id: string, data: Partial<InsertProviderOnboardingChat>): Promise<ProviderOnboardingChat | undefined> {
    const [chat] = await db.update(providerOnboardingChats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerOnboardingChats.id, id))
      .returning();
    return chat;
  }

  // ============ Mood Entries ============
  async upsertMoodEntry(data: InsertMoodEntry): Promise<MoodEntry> {
    const [entry] = await db.insert(moodEntries)
      .values(data)
      .onConflictDoUpdate({
        target: [moodEntries.seekerId, moodEntries.day],
        set: {
          score: data.score,
          note: data.note ?? null,
          engagementId: data.engagementId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return entry;
  }
  async getMoodEntriesBySeekerId(seekerId: string, sinceDay: string): Promise<MoodEntry[]> {
    return db.select().from(moodEntries)
      .where(and(eq(moodEntries.seekerId, seekerId), gte(moodEntries.day, sinceDay)))
      .orderBy(asc(moodEntries.day));
  }
  async getMoodEntriesByEngagementId(engagementId: string, sinceDay: string): Promise<MoodEntry[]> {
    return db.select().from(moodEntries)
      .where(and(eq(moodEntries.engagementId, engagementId), gte(moodEntries.day, sinceDay)))
      .orderBy(asc(moodEntries.day));
  }

  // ============ Seeker Progress Snapshot ============
  // Aggregates everything the seeker progress view needs in a single call.
  // - sessionsCompleted: total ended sessions across all the seeker's engagements.
  // - moodSeries: last `moodWindowDays` days of mood entries.
  // - streak: consecutive days (UTC) with a mood OR journal check-in. The
  //   streak is "forgiving" — if today has no check-in but yesterday does,
  //   we still report the streak with status "keep-going".
  // - goalsThisWeek: count of self-checkoff rows in the last 7 days.
  async getSeekerProgressSnapshot(
    userId: string,
    opts: { moodWindowDays?: number; streakWindowDays?: number } = {},
  ): Promise<{
    sessionsCompleted: number;
    moodSeries: Array<{ day: string; score: number; note: string | null }>;
    streak: { current: number; status: "active" | "keep-going" | "none"; lastCheckInDay: string | null };
    goalsThisWeek: number;
    hasSeekerProfile: boolean;
  }> {
    const moodWindow = opts.moodWindowDays ?? 30;
    // Streak walks backward from today and stops at the first gap, so the
    // window only matters as an upper bound on how long a streak we can
    // measure. 400 days comfortably covers a year+ for any current user.
    const streakWindow = opts.streakWindowDays ?? 400;

    const seeker = await this.getSeekerByOwnerId(userId);
    if (!seeker) {
      return {
        sessionsCompleted: 0,
        moodSeries: [],
        streak: { current: 0, status: "none", lastCheckInDay: null },
        goalsThisWeek: 0,
        hasSeekerProfile: false,
      };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const shift = (days: number) => {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - days);
      return d;
    };

    const moodSinceDay = ymd(shift(moodWindow - 1));
    const streakSinceDay = ymd(shift(streakWindow - 1));
    const sevenDaysAgo = shift(6); // inclusive 7-day window
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    // Run aggregations in parallel.
    const [sessionsCountRows, moodRows, streakMoodRows, journalDayRows, goalsCountRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .innerJoin(engagements, eq(sessions.engagementId, engagements.id))
        .where(and(eq(engagements.seekerId, seeker.id), eq(sessions.status, "ended"))),
      db.select({ day: moodEntries.day, score: moodEntries.score, note: moodEntries.note })
        .from(moodEntries)
        .where(and(eq(moodEntries.seekerId, seeker.id), gte(moodEntries.day, moodSinceDay)))
        .orderBy(asc(moodEntries.day)),
      db.select({ day: moodEntries.day })
        .from(moodEntries)
        .where(and(eq(moodEntries.seekerId, seeker.id), gte(moodEntries.day, streakSinceDay))),
      db.select({ day: sql<string>`to_char((${journalEntries.createdAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD')` })
        .from(journalEntries)
        .where(and(
          eq(journalEntries.seekerId, seeker.id),
          gte(journalEntries.createdAt, shift(streakWindow - 1)),
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(goalProgress)
        .where(and(eq(goalProgress.seekerUserId, userId), gte(goalProgress.createdAt, sevenDaysAgo))),
    ]);

    const sessionsCompleted = sessionsCountRows[0]?.count ?? 0;
    const goalsThisWeek = goalsCountRows[0]?.count ?? 0;

    const moodSeries = moodRows.map((r) => ({
      day: typeof r.day === "string" ? r.day : ymd(new Date(r.day as unknown as string)),
      score: r.score,
      note: r.note,
    }));

    // Build set of UTC day strings with any check-in (mood or journal).
    const checkinDays = new Set<string>();
    for (const r of streakMoodRows) {
      const d = typeof r.day === "string" ? r.day : ymd(new Date(r.day as unknown as string));
      checkinDays.add(d);
    }
    for (const r of journalDayRows) {
      if (r.day) checkinDays.add(r.day);
    }

    const todayStr = ymd(today);
    const yesterdayStr = ymd(shift(1));
    let cursor: Date | null = null;
    let status: "active" | "keep-going" | "none" = "none";
    if (checkinDays.has(todayStr)) {
      cursor = new Date(today);
      status = "active";
    } else if (checkinDays.has(yesterdayStr)) {
      cursor = shift(1);
      status = "keep-going";
    }

    let current = 0;
    let lastCheckInDay: string | null = null;
    if (cursor) {
      while (checkinDays.has(ymd(cursor))) {
        if (lastCheckInDay === null) lastCheckInDay = ymd(cursor);
        current += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
    }

    return {
      sessionsCompleted,
      moodSeries,
      streak: { current, status, lastCheckInDay },
      goalsThisWeek,
      hasSeekerProfile: true,
    };
  }

  // ============ Journal Prompts ============
  async createJournalPrompt(data: InsertJournalPrompt): Promise<JournalPrompt> {
    const [prompt] = await db.insert(journalPrompts).values(data).returning();
    return prompt;
  }
  async updateJournalPrompt(id: string, data: Partial<InsertJournalPrompt>): Promise<JournalPrompt | undefined> {
    const [prompt] = await db.update(journalPrompts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(journalPrompts.id, id))
      .returning();
    return prompt;
  }
  async getJournalPromptById(id: string): Promise<JournalPrompt | undefined> {
    const [prompt] = await db.select().from(journalPrompts).where(eq(journalPrompts.id, id));
    return prompt;
  }
  async listJournalPromptsForCoach(providerId: string, includeArchived = false): Promise<JournalPrompt[]> {
    // Coach sees their own prompts + global starters. Archived are hidden by default.
    const ownership = or(
      eq(journalPrompts.providerId, providerId),
      isNull(journalPrompts.providerId),
    )!;
    const where = includeArchived
      ? ownership
      : and(ownership, eq(journalPrompts.isArchived, false));
    return db.select().from(journalPrompts)
      .where(where)
      .orderBy(desc(journalPrompts.createdAt));
  }
  async listAvailableJournalPromptsForSeeker(
    providerId: string | null,
    engagementId: string | null,
  ): Promise<JournalPrompt[]> {
    // Seeker sees: global starters + provider's library prompts (engagementId IS NULL)
    // + prompts assigned specifically to their engagement.
    const conditions = [isNull(journalPrompts.providerId)];
    if (providerId) {
      conditions.push(
        and(
          eq(journalPrompts.providerId, providerId),
          isNull(journalPrompts.engagementId),
        )!,
      );
    }
    if (engagementId) {
      conditions.push(eq(journalPrompts.engagementId, engagementId));
    }
    return db.select().from(journalPrompts)
      .where(and(eq(journalPrompts.isArchived, false), or(...conditions))!)
      .orderBy(desc(journalPrompts.createdAt));
  }
  async countGlobalStarterPrompts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(journalPrompts)
      .where(isNull(journalPrompts.providerId));
    return result[0]?.count ?? 0;
  }
  async seedGlobalStarterPrompts(prompts: Array<{ text: string; category: string }>): Promise<void> {
    if (prompts.length === 0) return;
    // Idempotent: the partial unique index on (text) WHERE provider_id IS NULL
    // de-duplicates starter prompts. We omit the conflict target because Postgres
    // ON CONFLICT cannot reference a partial index; an untargeted DO NOTHING
    // swallows conflicts on any unique constraint, which here can only be the
    // partial index (PK is a generated uuid).
    await db.insert(journalPrompts)
      .values(prompts.map((p) => ({ text: p.text, category: p.category })))
      .onConflictDoNothing();
  }

  // ============ Journal Entries ============
  async createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry> {
    const [entry] = await db.insert(journalEntries)
      .values({
        ...data,
        sharedAt: data.sharedWithCoach ? new Date() : null,
      })
      .returning();
    return entry;
  }
  async updateJournalEntry(
    id: string,
    data: Partial<InsertJournalEntry> & { sharedAt?: Date | null },
  ): Promise<JournalEntry | undefined> {
    const [entry] = await db.update(journalEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(journalEntries.id, id))
      .returning();
    return entry;
  }
  async getJournalEntryById(id: string): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
    return entry;
  }
  async listJournalEntriesBySeekerId(seekerId: string): Promise<JournalEntry[]> {
    return db.select().from(journalEntries)
      .where(eq(journalEntries.seekerId, seekerId))
      .orderBy(desc(journalEntries.createdAt));
  }
  async listSharedJournalEntriesByEngagementId(engagementId: string): Promise<JournalEntry[]> {
    return db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.engagementId, engagementId),
        eq(journalEntries.sharedWithCoach, true),
      ))
      .orderBy(desc(journalEntries.createdAt));
  }

  // ============ Coach Inbox triage ============
  async getCoachInboxRows(
    providerId: string,
    opts: { now?: Date } = {},
  ): Promise<CoachInboxRow[]> {
    const now = opts.now ?? new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Active engagements for this coach with seeker linkage.
    const engagementRows = await db
      .select({
        engagementId: engagements.id,
        seekerId: engagements.seekerId,
        seekerOwnerId: seekers.ownerId,
      })
      .from(engagements)
      .innerJoin(seekers, eq(seekers.id, engagements.seekerId))
      .where(and(
        eq(engagements.providerId, providerId),
        eq(engagements.status, "active"),
      ));

    if (engagementRows.length === 0) return [];

    const engagementIds = engagementRows.map((r) => r.engagementId);

    // 2. Per-engagement aggregates run in parallel.
    const [
      lastMessageRows,
      lastSeekerMessageRows,
      lastProviderMessageRows,
      unreadAlertRows,
      criticalSafetyRows,
      activeSessionRows,
      dismissalRows,
    ] = await Promise.all([
      // Latest message overall (any role) per engagement — used for the
      // "no contact in N days" reason.
      db.select({
        engagementId: sessions.engagementId,
        lastAt: sql<Date>`max(${messages.createdAt})`.as("last_at"),
      })
        .from(messages)
        .innerJoin(sessions, eq(sessions.id, messages.sessionId))
        .where(inArray(sessions.engagementId, engagementIds))
        .groupBy(sessions.engagementId),
      // Latest seeker-authored message per engagement
      db.select({
        engagementId: sessions.engagementId,
        lastAt: sql<Date>`max(${messages.createdAt})`.as("last_seeker_at"),
      })
        .from(messages)
        .innerJoin(sessions, eq(sessions.id, messages.sessionId))
        .where(and(
          inArray(sessions.engagementId, engagementIds),
          eq(messages.role, "seeker"),
        ))
        .groupBy(sessions.engagementId),
      // Latest provider-authored message per engagement — used to detect
      // "seeker awaiting reply" (we deliberately ignore agent/twin replies
      // because they don't count as a coach having replied).
      db.select({
        engagementId: sessions.engagementId,
        lastAt: sql<Date>`max(${messages.createdAt})`.as("last_provider_at"),
      })
        .from(messages)
        .innerJoin(sessions, eq(sessions.id, messages.sessionId))
        .where(and(
          inArray(sessions.engagementId, engagementIds),
          eq(messages.role, "provider"),
        ))
        .groupBy(sessions.engagementId),
      // Unread alert count + latest unread alert per engagement
      db.select({
        engagementId: alerts.engagementId,
        count: sql<number>`count(*)::int`.as("count"),
        latestAt: sql<Date>`max(${alerts.createdAt})`.as("latest_at"),
      })
        .from(alerts)
        .where(and(
          eq(alerts.providerId, providerId),
          eq(alerts.isRead, false),
        ))
        .groupBy(alerts.engagementId),
      // Critical safety events (input/output gate, severity high/critical) in last 7 days
      db.select({
        engagementId: safetyEvents.engagementId,
        latestAt: sql<Date>`max(${safetyEvents.createdAt})`.as("latest_at"),
      })
        .from(safetyEvents)
        .where(and(
          eq(safetyEvents.providerId, providerId),
          gte(safetyEvents.createdAt, sevenDaysAgo),
          inArray(safetyEvents.stage, ["input", "output"]),
          inArray(safetyEvents.severity, ["high", "critical"]),
        ))
        .groupBy(safetyEvents.engagementId),
      // One active session per engagement for the "Open chat" CTA
      db.select({
        engagementId: sessions.engagementId,
        sessionId: sessions.id,
      })
        .from(sessions)
        .where(and(
          inArray(sessions.engagementId, engagementIds),
          eq(sessions.status, "active"),
        )),
      // Active dismissals
      db.select({
        engagementId: coachInboxDismissals.engagementId,
        dismissedAt: coachInboxDismissals.dismissedAt,
        expiresAt: coachInboxDismissals.expiresAt,
      })
        .from(coachInboxDismissals)
        .where(and(
          eq(coachInboxDismissals.providerId, providerId),
          gte(coachInboxDismissals.expiresAt, now),
        )),
    ]);

    // Drizzle returns aggregate timestamps (max(...)) as raw strings, so
    // normalize everything to Date here once.
    const toDate = (v: unknown): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return v;
      const d = new Date(v as string);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const lastMessageMap = new Map<string, Date>();
    for (const r of lastMessageRows) {
      const d = toDate(r.lastAt);
      if (r.engagementId && d) lastMessageMap.set(r.engagementId, d);
    }
    const lastSeekerMessageMap = new Map<string, Date>();
    for (const r of lastSeekerMessageRows) {
      const d = toDate(r.lastAt);
      if (r.engagementId && d) lastSeekerMessageMap.set(r.engagementId, d);
    }
    const lastProviderMessageMap = new Map<string, Date>();
    for (const r of lastProviderMessageRows) {
      const d = toDate(r.lastAt);
      if (r.engagementId && d) lastProviderMessageMap.set(r.engagementId, d);
    }
    const alertMap = new Map<string, { count: number; latestAt: Date }>();
    for (const r of unreadAlertRows) {
      const d = toDate(r.latestAt);
      if (r.engagementId && d) alertMap.set(r.engagementId, { count: r.count, latestAt: d });
    }
    const safetyMap = new Map<string, Date>();
    for (const r of criticalSafetyRows) {
      const d = toDate(r.latestAt);
      if (r.engagementId && d) safetyMap.set(r.engagementId, d);
    }
    const activeSessionMap = new Map<string, string>();
    // Multiple active sessions per engagement is unusual, but if it happens we
    // just keep one — any active session works for the "Open chat" CTA.
    for (const r of activeSessionRows) if (r.engagementId) activeSessionMap.set(r.engagementId, r.sessionId);
    // Keep the *most recent* dismissal per engagement (latest dismissedAt) so a
    // fresh "Handled" replaces an older one cleanly.
    const dismissalMap = new Map<string, { dismissedAt: Date; expiresAt: Date }>();
    for (const r of dismissalRows) {
      const dismissedAt = toDate(r.dismissedAt);
      const expiresAt = toDate(r.expiresAt);
      if (!dismissedAt || !expiresAt) continue;
      const existing = dismissalMap.get(r.engagementId);
      if (!existing || dismissedAt > existing.dismissedAt) {
        dismissalMap.set(r.engagementId, { dismissedAt, expiresAt });
      }
    }

    const rows: CoachInboxRow[] = engagementRows.map((eng) => {
      const lastMessageAt = lastMessageMap.get(eng.engagementId) ?? null;
      const lastSeekerMessageAt = lastSeekerMessageMap.get(eng.engagementId) ?? null;
      const lastProviderMessageAt = lastProviderMessageMap.get(eng.engagementId) ?? null;
      const alert = alertMap.get(eng.engagementId);
      const safetyAt = safetyMap.get(eng.engagementId) ?? null;
      const dismissal = dismissalMap.get(eng.engagementId) ?? null;
      const dismissedUntil = dismissal?.expiresAt ?? null;
      const dismissedAt = dismissal?.dismissedAt ?? null;

      const reasons: CoachInboxReason[] = [];

      // Critical: recent safety event
      if (safetyAt) {
        reasons.push({
          kind: "safety",
          label: `Safety event ${formatRelative(safetyAt, now)}`,
          timestamp: safetyAt.toISOString(),
        });
      }

      // Elevated: unread alerts
      if (alert && alert.count > 0) {
        reasons.push({
          kind: "alerts",
          label: alert.count === 1
            ? "1 unread alert"
            : `${alert.count} unread alerts`,
          timestamp: alert.latestAt.toISOString(),
        });
      }

      // Elevated: seeker waiting for a coach reply >=24h. We compare against
      // the last *provider*-authored message — agent/twin auto-replies do NOT
      // count as a coach having replied.
      if (lastSeekerMessageAt) {
        const lastSeekerMs = lastSeekerMessageAt.getTime();
        const lastProviderMs = lastProviderMessageAt?.getTime() ?? 0;
        if (lastSeekerMs > lastProviderMs) {
          const ageH = Math.floor((now.getTime() - lastSeekerMs) / (60 * 60 * 1000));
          if (ageH >= 24) {
            reasons.push({
              kind: "unread_messages",
              label: ageH < 48
                ? `Awaiting reply for ${ageH}h`
                : `Awaiting reply for ${Math.floor(ageH / 24)}d`,
              timestamp: lastSeekerMessageAt.toISOString(),
            });
          }
        }
      }

      // Quiet: no contact in 7+ days (use last message; fall back to "never").
      const lastContact = lastMessageAt;
      const daysSinceContact = lastContact
        ? Math.floor((now.getTime() - lastContact.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      if (!safetyAt && (!alert || alert.count === 0)) {
        if (daysSinceContact === null) {
          reasons.push({
            kind: "no_contact",
            label: "No contact yet",
            timestamp: null,
          });
        } else if (daysSinceContact >= 7) {
          reasons.push({
            kind: "no_contact",
            label: `No contact in ${daysSinceContact} days`,
            timestamp: lastContact!.toISOString(),
          });
        }
      }

      let severity: CoachInboxSeverity;
      if (safetyAt) severity = "critical";
      else if ((alert && alert.count > 0) || reasons.some((r) => r.kind === "unread_messages")) severity = "elevated";
      else severity = "quiet";

      return {
        engagementId: eng.engagementId,
        seekerUserId: eng.seekerOwnerId ?? null,
        seekerAlias: `Seeker-${(eng.seekerId ?? "unknown").slice(0, 8)}`,
        severity,
        reasons,
        lastMessageAt: lastMessageAt?.toISOString() ?? null,
        unreadAlertCount: alert?.count ?? 0,
        latestSafetyEventAt: safetyAt?.toISOString() ?? null,
        activeSessionId: activeSessionMap.get(eng.engagementId) ?? null,
        dismissedUntil: dismissedUntil?.toISOString() ?? null,
      };
    });

    // Filter + dismissal handling.
    //
    // A "Handled" click suppresses an engagement for 24h, BUT critical safety
    // signals must still re-surface a row when something *new* happens inside
    // that window — a coach should never miss a fresh crisis just because they
    // dismissed yesterday's. We honor the dismissal for slow-moving reasons
    // (no_contact, awaiting reply) but allow safety/alerts that arrived AFTER
    // the dismissal time to break through.
    const visible: CoachInboxRow[] = [];
    for (const row of rows) {
      if (row.reasons.length === 0) continue;
      if (!row.dismissedUntil) {
        visible.push(row);
        continue;
      }
      const dismissedAtIso = dismissalMap.get(row.engagementId)?.dismissedAt.toISOString() ?? "";
      const survivingReasons = row.reasons.filter((reason) => {
        // Slow-moving reasons stay hidden during the dismissal window.
        if (reason.kind === "no_contact" || reason.kind === "unread_messages") return false;
        // Safety + alerts re-surface only when they're strictly newer than the
        // dismissal — i.e., something new happened after the coach handled it.
        if (!reason.timestamp) return false;
        return reason.timestamp > dismissedAtIso;
      });
      if (survivingReasons.length === 0) continue;
      // Recompute severity from surviving reasons so the pill matches what's shown.
      const hasSafety = survivingReasons.some((r) => r.kind === "safety");
      const hasAlertOrUnread = survivingReasons.some((r) => r.kind === "alerts" || r.kind === "unread_messages");
      visible.push({
        ...row,
        reasons: survivingReasons,
        severity: hasSafety ? "critical" : hasAlertOrUnread ? "elevated" : "quiet",
      });
    }

    // Sort: critical first, then elevated, then quiet (oldest contact first).
    const severityRank: Record<CoachInboxSeverity, number> = {
      critical: 0,
      elevated: 1,
      quiet: 2,
    };
    // Pick the newest reason timestamp on a row for tiebreaking (don't rely on
    // reasons[0] ordering — pick the actually-newest signal).
    const newestReasonTs = (r: CoachInboxRow): string =>
      r.reasons.reduce<string>((acc, reason) => {
        if (!reason.timestamp) return acc;
        return reason.timestamp > acc ? reason.timestamp : acc;
      }, "");
    visible.sort((a, b) => {
      const sd = severityRank[a.severity] - severityRank[b.severity];
      if (sd !== 0) return sd;
      // Within critical/elevated: newest trigger first
      if (a.severity !== "quiet") {
        const aAt = newestReasonTs(a) || a.lastMessageAt || "";
        const bAt = newestReasonTs(b) || b.lastMessageAt || "";
        return bAt.localeCompare(aAt);
      }
      // Quiet: oldest contact first ("most overdue at top")
      const aAt = a.lastMessageAt ?? "";
      const bAt = b.lastMessageAt ?? "";
      return aAt.localeCompare(bAt);
    });

    return visible;
  }

  async dismissCoachInboxRow(
    providerId: string,
    engagementId: string,
    opts: { hours?: number; now?: Date } = {},
  ): Promise<void> {
    const hours = opts.hours ?? 24;
    const now = opts.now ?? new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      // Mark all unread alerts for this engagement+provider as read.
      await tx
        .update(alerts)
        .set({ isRead: true })
        .where(and(
          eq(alerts.providerId, providerId),
          eq(alerts.engagementId, engagementId),
          eq(alerts.isRead, false),
        ));
      // Insert a fresh dismissal so non-alert reasons are suppressed for 24h.
      await tx
        .insert(coachInboxDismissals)
        .values({ providerId, engagementId, expiresAt });
    });
  }

  // ============ Push Tokens ============
  async upsertPushToken(data: InsertPushToken): Promise<PushToken> {
    // On conflict we deliberately do NOT touch `enabled` — that is owned
    // by the user's explicit preference (toggle on Profile / PATCH route).
    // Re-registering an existing token must not silently re-enable a
    // token the user has previously turned off.
    const now = new Date();
    const [row] = await db.insert(pushTokens)
      .values(data)
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId: data.userId,
          platform: data.platform ?? null,
          updatedAt: now,
          lastSeenAt: now,
        },
      })
      .returning();
    return row;
  }

  async getPushTokensByUserId(userId: string, opts?: { onlyEnabled?: boolean }): Promise<PushToken[]> {
    const where = opts?.onlyEnabled
      ? and(eq(pushTokens.userId, userId), eq(pushTokens.enabled, true))
      : eq(pushTokens.userId, userId);
    return db.select().from(pushTokens).where(where).orderBy(desc(pushTokens.updatedAt));
  }

  async setPushTokensEnabledForUser(userId: string, enabled: boolean): Promise<void> {
    await db.update(pushTokens)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(pushTokens.userId, userId));
  }

  async deletePushToken(token: string, userId: string): Promise<void> {
    await db.delete(pushTokens)
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
  }
}

// ----- helpers -----

function formatRelative(then: Date, now: Date): string {
  const diffMs = now.getTime() - then.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const storage = new DatabaseStorage();
