import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, profiles, userRoles, seekers, providerConfigs, providerAgentConfigs,
  engagements, sessions, messages, summaries, progressIndicators,
  InsertUser, InsertProfile, InsertUserRole, InsertSeeker, InsertProviderConfig,
  InsertProviderAgentConfig, InsertEngagement, InsertSession, InsertMessage,
  InsertSummary, InsertProgressIndicator, User, Profile, UserRole, Seeker,
  ProviderConfig, ProviderAgentConfig, Engagement, Session, Message, Summary, ProgressIndicator
} from "../shared/schema";

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
}

export const storage = new DatabaseStorage();
