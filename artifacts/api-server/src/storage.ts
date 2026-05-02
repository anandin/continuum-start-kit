import { db } from "./db";
import { eq, and, or, desc, asc, sql, isNull, lt, gte } from "drizzle-orm";
import {
  users, profiles, userRoles, seekers, providerConfigs, providerAgentConfigs,
  engagements, sessions, messages, summaries, progressIndicators,
  clientNotes, goals, intakeForms, intakeResponses, resources, resourceAssignments, alerts, providerOnboardingChats,
  moodEntries, journalPrompts, journalEntries,
  InsertUser, InsertProfile, InsertUserRole, InsertSeeker, InsertProviderConfig,
  InsertProviderAgentConfig, InsertEngagement, InsertSession, InsertMessage,
  InsertSummary, InsertProgressIndicator,
  InsertClientNote, InsertGoal, InsertIntakeForm, InsertIntakeResponse,
  InsertResource, InsertResourceAssignment, InsertAlert, InsertProviderOnboardingChat,
  InsertMoodEntry, InsertJournalPrompt, InsertJournalEntry,
  User, Profile, UserRole, Seeker,
  ProviderConfig, ProviderAgentConfig, Engagement, Session, Message, Summary, ProgressIndicator,
  ClientNote, Goal, IntakeForm, IntakeResponse, Resource, ResourceAssignment, Alert, ProviderOnboardingChat,
  MoodEntry, JournalPrompt, JournalEntry
} from "@workspace/db";

export interface IStorage {
  createUser(data: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
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
    return db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
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
    await db.delete(goals).where(eq(goals.id, id));
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
    // Idempotent: relies on the partial unique index on (text) where provider_id IS NULL
    // so re-running fills in any starters missing from a partial state.
    await db.insert(journalPrompts)
      .values(prompts.map((p) => ({ text: p.text, category: p.category })))
      .onConflictDoNothing({ target: journalPrompts.text });
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
}

export const storage = new DatabaseStorage();
