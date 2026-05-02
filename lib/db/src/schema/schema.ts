import { pgTable, uuid, text, timestamp, jsonb, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appRoleEnum = pgEnum("app_role", ["provider", "seeker"]);
export const engagementStatusEnum = pgEnum("engagement_status", ["active", "paused", "completed"]);
export const msgRoleEnum = pgEnum("msg_role", ["seeker", "agent", "provider"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "ended"]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "paused"]);
export const resourceTypeEnum = pgEnum("resource_type", ["link", "document", "exercise"]);
export const onboardingChatStatusEnum = pgEnum("onboarding_chat_status", ["in_progress", "completed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
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

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertSeekerSchema = createInsertSchema(seekers).omit({ id: true, createdAt: true });
export const insertProviderConfigSchema = createInsertSchema(providerConfigs).omit({ id: true, createdAt: true });
export const insertProviderAgentConfigSchema = createInsertSchema(providerAgentConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEngagementSchema = createInsertSchema(engagements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, startedAt: true, endedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });
export const insertProgressIndicatorSchema = createInsertSchema(progressIndicators).omit({ id: true, createdAt: true });
export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIntakeFormSchema = createInsertSchema(intakeForms).omit({ id: true, createdAt: true });
export const insertIntakeResponseSchema = createInsertSchema(intakeResponses).omit({ id: true, completedAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertResourceAssignmentSchema = createInsertSchema(resourceAssignments).omit({ id: true, assignedAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertProviderOnboardingChatSchema = createInsertSchema(providerOnboardingChats).omit({ id: true, createdAt: true, updatedAt: true });

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
export type InsertIntakeForm = z.infer<typeof insertIntakeFormSchema>;
export type InsertIntakeResponse = z.infer<typeof insertIntakeResponseSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertResourceAssignment = z.infer<typeof insertResourceAssignmentSchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertProviderOnboardingChat = z.infer<typeof insertProviderOnboardingChatSchema>;

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type Seeker = typeof seekers.$inferSelect;
export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type ProviderAgentConfig = typeof providerAgentConfigs.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type ProgressIndicator = typeof progressIndicators.$inferSelect;
export type ClientNote = typeof clientNotes.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type ResourceAssignment = typeof resourceAssignments.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type ProviderOnboardingChat = typeof providerOnboardingChats.$inferSelect;
