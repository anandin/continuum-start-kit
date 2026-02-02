import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function registerRoutes(app: Express) {
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profile = await storage.getProfileByUserId(userId);
      const userRole = await storage.getUserRoleByUserId(userId);
      
      res.json({ 
        profile, 
        role: userRole?.role || null 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/role", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { role } = req.body;

      if (!role || !["provider", "seeker"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const existingRole = await storage.getUserRoleByUserId(userId);
      if (existingRole) {
        return res.status(400).json({ error: "Role already set" });
      }

      const userRole = await storage.createUserRole({ userId, role });

      if (role === "seeker") {
        await storage.createSeeker({ ownerId: userId });
      }

      res.json({ role: userRole.role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/provider-configs", requireAuth, async (req, res) => {
    try {
      const configs = await storage.getAllProviderConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/provider-config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getProviderConfigByProviderId(userId);
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider-config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { title, methodology, stages, labels, summaryTemplate, taggingRules, trajectoryRules } = req.body;

      const existingConfig = await storage.getProviderConfigByProviderId(userId);
      
      if (existingConfig) {
        const updated = await storage.updateProviderConfig(existingConfig.id, {
          title, methodology, stages, labels, summaryTemplate, taggingRules, trajectoryRules
        });
        return res.json(updated);
      }

      const config = await storage.createProviderConfig({
        providerId: userId,
        title,
        methodology,
        stages,
        labels,
        summaryTemplate,
        taggingRules,
        trajectoryRules,
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/provider-agent-config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getProviderAgentConfigByProviderId(userId);
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider-agent-config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const existingConfig = await storage.getProviderAgentConfigByProviderId(userId);
      
      if (existingConfig) {
        const updated = await storage.updateProviderAgentConfig(existingConfig.id, data);
        return res.json(updated);
      }

      const config = await storage.createProviderAgentConfig({
        providerId: userId,
        ...data,
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = await storage.getUserRoleByUserId(userId);

      if (userRole?.role === "provider") {
        const engagements = await storage.getEngagementsByProviderId(userId);
        return res.json(engagements);
      } else {
        const seeker = await storage.getSeekerByOwnerId(userId);
        if (!seeker) {
          return res.json([]);
        }
        const engagements = await storage.getEngagementsBySeekerId(seeker.id);
        return res.json(engagements);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/engagements", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { providerId } = req.body;

      const seeker = await storage.getSeekerByOwnerId(userId);
      if (!seeker) {
        return res.status(400).json({ error: "Seeker profile not found" });
      }

      const engagement = await storage.createEngagement({
        seekerId: seeker.id,
        providerId,
      });
      res.json(engagement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id", requireAuth, async (req, res) => {
    try {
      const engagement = await storage.getEngagementById(req.params.id);
      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      res.json(engagement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getSessionsByEngagementId(req.params.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const { engagementId, initialStage } = req.body;
      const session = await storage.createSession({
        engagementId,
        initialStage,
        status: "active",
      });
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getSessionById(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getMessagesBySessionId(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: "sessionId and message are required" });
      }

      await storage.createMessage({
        sessionId,
        role: "seeker",
        content: message,
      });

      const session = await storage.getSessionById(sessionId);
      if (!session?.engagementId) {
        return res.status(400).json({ error: "Invalid session" });
      }

      const engagement = await storage.getEngagementById(session.engagementId);
      if (!engagement?.providerId) {
        return res.status(400).json({ error: "Invalid engagement" });
      }

      const providerConfig = await storage.getProviderConfigByProviderId(engagement.providerId);
      const agentConfig = await storage.getProviderAgentConfigByProviderId(engagement.providerId);
      const recentMessages = await storage.getMessagesBySessionId(sessionId);

      let systemPrompt = "You are a helpful AI coaching assistant.";
      
      if (agentConfig) {
        systemPrompt = "";
        if (agentConfig.coreIdentity) systemPrompt += `## Core Identity\n${agentConfig.coreIdentity}\n\n`;
        if (agentConfig.guidingPrinciples) systemPrompt += `## Guiding Principles\n${agentConfig.guidingPrinciples}\n\n`;
        if (agentConfig.tone || agentConfig.voice) {
          systemPrompt += `## Communication Style\n`;
          if (agentConfig.tone) systemPrompt += `Tone: ${agentConfig.tone}\n`;
          if (agentConfig.voice) systemPrompt += `Voice: ${agentConfig.voice}\n`;
          systemPrompt += "\n";
        }
        if (agentConfig.rules) systemPrompt += `## Rules\n${agentConfig.rules}\n\n`;
        if (agentConfig.boundaries) systemPrompt += `## Boundaries\n${agentConfig.boundaries}\n\n`;
      }

      if (providerConfig) {
        systemPrompt += `## Program Context\n`;
        if (providerConfig.title) systemPrompt += `Program: ${providerConfig.title}\n`;
        if (providerConfig.methodology) systemPrompt += `Methodology: ${providerConfig.methodology}\n`;
        if (session.initialStage) systemPrompt += `Current Stage: ${session.initialStage}\n`;
      }

      const selectedModel = agentConfig?.selectedModel || "google/gemini-2.5-flash";
      
      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...recentMessages.slice(-20).map((m) => ({
          role: m.role === "seeker" ? "user" : "assistant",
          content: m.content,
        })),
      ];

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      if (!OPENROUTER_API_KEY) {
        const agentResponse = await storage.createMessage({
          sessionId,
          role: "agent",
          content: "AI service is not configured. Please contact your administrator.",
        });
        return res.json({ message: agentResponse });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: aiMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content || "I apologize, I couldn't generate a response.";

      const agentMessage = await storage.createMessage({
        sessionId,
        role: "agent",
        content: aiContent,
      });

      res.json({ message: agentMessage });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:id/finish", requireAuth, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await storage.getMessagesBySessionId(sessionId);
      
      const engagement = await storage.getEngagementById(session.engagementId!);
      if (!engagement?.providerId) {
        return res.status(400).json({ error: "Invalid engagement" });
      }

      const providerConfig = await storage.getProviderConfigByProviderId(engagement.providerId);
      if (!providerConfig) {
        return res.status(400).json({ error: "Provider config not found" });
      }

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      if (!OPENROUTER_API_KEY) {
        await storage.updateSession(sessionId, { status: "ended", endedAt: new Date() });
        return res.json({ success: true, summary: null });
      }

      const transcriptForAI = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      }));

      const stagesList = ((providerConfig.stages as any[]) || []).map((s: any) => s.name).join(", ");

      const prompt = `Summarize this session for durable storage.

Output STRICT JSON ONLY:
{
  "session_summary": string,
  "assigned_stage": string,
  "key_insights": [ { "label": string, "insight": string, "score": number } ],
  "next_action": string,
  "trajectory_status": "steady"|"drifting"|"stalling"|"accelerating"
}

Inputs:
- transcript: ${JSON.stringify(transcriptForAI)}

Available stages: ${stagesList}

Only return JSON. No extra text.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert coaching session analyst. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      let summaryData;
      try {
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        summaryData = JSON.parse(cleanContent);
      } catch {
        summaryData = {
          sessionSummary: "Session completed",
          assignedStage: stagesList.split(",")[0]?.trim() || "Initial",
          keyInsights: [],
          nextAction: "Continue with next session",
          trajectoryStatus: "steady",
        };
      }

      const summary = await storage.createSummary({
        sessionId,
        assignedStage: summaryData.assigned_stage || summaryData.assignedStage,
        sessionSummary: summaryData.session_summary || summaryData.sessionSummary,
        keyInsights: summaryData.key_insights || summaryData.keyInsights || [],
        nextAction: summaryData.next_action || summaryData.nextAction,
        trajectoryStatus: summaryData.trajectory_status || summaryData.trajectoryStatus,
      });

      await storage.updateSession(sessionId, { status: "ended", endedAt: new Date() });

      res.json({ success: true, summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id/summary", requireAuth, async (req, res) => {
    try {
      const summary = await storage.getSummaryBySessionId(req.params.id);
      res.json(summary || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/onboarding-assign", requireAuth, async (req, res) => {
    try {
      const { answers, stages } = req.body;

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      if (!OPENROUTER_API_KEY) {
        return res.json({ 
          initial_stage: stages[0]?.name || "Initial", 
          rationale: "Assigned to starting stage" 
        });
      }

      const stageNames = stages.map((s: any) => s.name);

      const prompt = `Assign an initial stage for a new seeker.

Output STRICT JSON ONLY:
{
  "initial_stage": string,
  "rationale": string
}

Inputs:
- answers: ${JSON.stringify(answers)}
- provider_config.stages: ${JSON.stringify(stageNames)}

If ambiguous, choose the earliest relevant stage.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a stage assignment expert. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        return res.json({ initial_stage: stages[0]?.name || "Initial", rationale: "Default assignment" });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      try {
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(cleanContent);
        res.json(result);
      } catch {
        res.json({ initial_stage: stages[0]?.name || "Initial", rationale: "Default assignment" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/indicators", requireAuth, async (req, res) => {
    try {
      const indicators = await storage.getProgressIndicatorsByEngagementId(req.params.id);
      res.json(indicators);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
