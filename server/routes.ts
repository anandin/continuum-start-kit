import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function requireProvider(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const role = await storage.getUserRoleByUserId(req.user.id);
    if (role?.role !== "provider") {
      return res.status(403).json({ error: "Provider access required" });
    }
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

  app.get("/api/provider-config", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getProviderConfigByProviderId(userId);
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider-config", requireProvider, async (req, res) => {
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

  app.get("/api/provider-agent-config", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getProviderAgentConfigByProviderId(userId);
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider-agent-config", requireProvider, async (req, res) => {
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

      const trajectory = (summaryData.trajectory_status || summaryData.trajectoryStatus || "").toLowerCase();
      if (trajectory === "drifting" || trajectory === "stalling") {
        try {
          await storage.createAlert({
            providerId: engagement.providerId,
            engagementId: engagement.id,
            type: "trajectory_change",
            message: `A client's trajectory shifted to "${trajectory}". Consider reaching out.`,
            isRead: false,
          });
        } catch {}
      }

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

  // ============================================================
  // Helper: ensure provider owns engagement
  // ============================================================
  async function assertProviderOwnsEngagement(req: Request, engagementId: string): Promise<{ ok: boolean; engagement?: any; error?: string }> {
    const engagement = await storage.getEngagementById(engagementId);
    if (!engagement) return { ok: false, error: "Engagement not found" };
    if (engagement.providerId !== req.user!.id) return { ok: false, error: "Forbidden" };
    return { ok: true, engagement };
  }

  // ============================================================
  // CLIENT NOTES
  // ============================================================
  app.get("/api/engagements/:id/notes", requireAuth, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const notes = await storage.getClientNotesByEngagementId(req.params.id);
      res.json(notes);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/engagements/:id/notes", requireAuth, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const { content, sessionId } = req.body;
      if (!content) return res.status(400).json({ error: "content required" });
      const note = await storage.createClientNote({
        engagementId: req.params.id,
        providerId: req.user!.id,
        sessionId: sessionId || null,
        content,
        isPrivate: true,
      });
      res.json(note);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const note = await storage.getClientNoteById(req.params.id);
      if (!note) return res.status(404).json({ error: "Note not found" });
      if (note.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      const updated = await storage.updateClientNote(req.params.id, { content: req.body.content });
      res.json(updated);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const note = await storage.getClientNoteById(req.params.id);
      if (!note) return res.status(404).json({ error: "Note not found" });
      if (note.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteClientNote(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // GOALS
  // ============================================================
  app.get("/api/engagements/:id/goals", requireAuth, async (req, res) => {
    try {
      const engagement = await storage.getEngagementById(req.params.id);
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });
      // Allow both provider and seeker (owner) to view goals
      const userId = req.user!.id;
      let allowed = engagement.providerId === userId;
      if (!allowed && engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId === userId) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
      const goals = await storage.getGoalsByEngagementId(req.params.id);
      res.json(goals);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/engagements/:id/goals", requireAuth, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const { title, description, dueDate } = req.body;
      if (!title) return res.status(400).json({ error: "title required" });
      const goal = await storage.createGoal({
        engagementId: req.params.id,
        providerId: req.user!.id,
        title,
        description: description || null,
        status: "active",
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      res.json(goal);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const goal = await storage.getGoalById(req.params.id);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      if (goal.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      const { title, description, status, dueDate } = req.body;
      const updated = await storage.updateGoal(req.params.id, {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      });
      res.json(updated);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const goal = await storage.getGoalById(req.params.id);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      if (goal.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteGoal(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // INTAKE FORMS
  // ============================================================
  app.get("/api/intake-forms", requireProvider, async (req, res) => {
    try {
      const forms = await storage.getIntakeFormsByProviderId(req.user!.id);
      res.json(forms);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/intake-forms/by-provider/:providerId", requireAuth, async (req, res) => {
    try {
      const forms = await storage.getIntakeFormsByProviderId(req.params.providerId);
      const active = forms.filter(f => f.isActive);
      res.json(active);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/intake-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getIntakeFormById(req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });
      const userId = req.user!.id;
      // Provider owns it, or seeker has an engagement with this provider
      if (form.providerId !== userId) {
        const seeker = await storage.getSeekerByOwnerId(userId);
        let allowed = false;
        if (seeker) {
          const engagements = await storage.getEngagementsBySeekerId(seeker.id);
          allowed = engagements.some(e => e.providerId === form.providerId);
        }
        if (!allowed) return res.status(403).json({ error: "Forbidden" });
      }
      res.json(form);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/intake-forms", requireProvider, async (req, res) => {
    try {
      const { title, description, questions } = req.body;
      if (!title || !Array.isArray(questions)) return res.status(400).json({ error: "title and questions required" });
      const form = await storage.createIntakeForm({
        providerId: req.user!.id,
        title,
        description: description || null,
        questions,
        isActive: true,
      });
      res.json(form);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/intake-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getIntakeFormById(req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });
      if (form.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      const updated = await storage.updateIntakeForm(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/intake-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getIntakeFormById(req.params.id);
      if (!form) return res.status(404).json({ error: "Form not found" });
      if (form.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteIntakeForm(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // INTAKE RESPONSES
  // ============================================================
  app.post("/api/intake-responses", requireAuth, async (req, res) => {
    try {
      const { intakeFormId, engagementId, answers } = req.body;
      if (!intakeFormId || !engagementId || !answers) return res.status(400).json({ error: "missing fields" });
      const engagement = await storage.getEngagementById(engagementId);
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });
      // Only the seeker on this engagement can submit
      if (!engagement.seekerId) return res.status(400).json({ error: "Invalid engagement" });
      const seeker = await storage.getSeekerById(engagement.seekerId);
      if (!seeker || seeker.ownerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      // Verify the form belongs to this engagement's provider (no cross-provider submissions)
      const form = await storage.getIntakeFormById(intakeFormId);
      if (!form) return res.status(404).json({ error: "Form not found" });
      if (form.providerId !== engagement.providerId) return res.status(403).json({ error: "Form does not belong to this provider" });
      const response = await storage.createIntakeResponse({
        intakeFormId,
        engagementId,
        seekerId: engagement.seekerId,
        answers,
      });
      // alert provider
      if (engagement.providerId) {
        try {
          await storage.createAlert({
            providerId: engagement.providerId,
            engagementId,
            type: "new_intake_response",
            message: "A client completed an intake form.",
            isRead: false,
          });
        } catch {}
      }
      res.json(response);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/engagements/:id/intake", requireAuth, async (req, res) => {
    try {
      const engagement = await storage.getEngagementById(req.params.id);
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });
      const userId = req.user!.id;
      let allowed = engagement.providerId === userId;
      if (!allowed && engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId === userId) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
      const response = await storage.getIntakeResponseByEngagementId(req.params.id);
      res.json(response || null);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // RESOURCES
  // ============================================================
  app.get("/api/resources", requireProvider, async (req, res) => {
    try {
      const resources = await storage.getResourcesByProviderId(req.user!.id);
      res.json(resources);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/resources", requireProvider, async (req, res) => {
    try {
      const { title, description, type, url, content } = req.body;
      if (!title || !type) return res.status(400).json({ error: "title and type required" });
      if (!["link", "document", "exercise"].includes(type)) return res.status(400).json({ error: "invalid type" });
      const resource = await storage.createResource({
        providerId: req.user!.id,
        title,
        description: description || null,
        type,
        url: url || null,
        content: content || null,
      });
      res.json(resource);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/resources/:id", requireProvider, async (req, res) => {
    try {
      const resource = await storage.getResourceById(req.params.id);
      if (!resource) return res.status(404).json({ error: "Resource not found" });
      if (resource.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      const updated = await storage.updateResource(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/resources/:id", requireProvider, async (req, res) => {
    try {
      const resource = await storage.getResourceById(req.params.id);
      if (!resource) return res.status(404).json({ error: "Resource not found" });
      if (resource.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteResource(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/resources/:id/assign", requireProvider, async (req, res) => {
    try {
      const resource = await storage.getResourceById(req.params.id);
      if (!resource) return res.status(404).json({ error: "Resource not found" });
      if (resource.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      const { engagementId } = req.body;
      if (!engagementId) return res.status(400).json({ error: "engagementId required" });
      const check = await assertProviderOwnsEngagement(req, engagementId);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const assignment = await storage.createResourceAssignment({
        resourceId: req.params.id,
        engagementId,
      });
      res.json(assignment);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/engagements/:id/resources", requireAuth, async (req, res) => {
    try {
      const engagement = await storage.getEngagementById(req.params.id);
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });
      const userId = req.user!.id;
      let allowed = engagement.providerId === userId;
      if (!allowed && engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId === userId) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
      const assignments = await storage.getResourceAssignmentsByEngagementId(req.params.id);
      res.json(assignments);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/resource-assignments/:id/view", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getResourceAssignmentById(req.params.id);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const engagement = await storage.getEngagementById(assignment.engagementId);
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });
      const userId = req.user!.id;
      let allowed = engagement.providerId === userId;
      if (!allowed && engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId === userId) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
      await storage.markResourceViewed(req.params.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // ALERTS
  // ============================================================
  app.get("/api/alerts", requireProvider, async (req, res) => {
    try {
      const alerts = await storage.getAlertsByProviderId(req.user!.id);
      res.json(alerts);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/alerts/unread-count", requireProvider, async (req, res) => {
    try {
      const count = await storage.getUnreadAlertCountByProviderId(req.user!.id);
      res.json({ count });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/alerts/:id/read", requireProvider, async (req, res) => {
    try {
      await storage.markAlertRead(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.put("/api/alerts/read-all", requireProvider, async (req, res) => {
    try {
      await storage.markAllAlertsRead(req.user!.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // PROVIDER AI CONVERSATIONAL ONBOARDING
  // ============================================================
  app.get("/api/provider-onboarding/status", requireProvider, async (req, res) => {
    try {
      const chat = await storage.getActiveOnboardingChatByProviderId(req.user!.id);
      res.json(chat || null);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/provider-onboarding/chat", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { message, reset } = req.body;

      let chat = await storage.getActiveOnboardingChatByProviderId(userId);
      if (reset || !chat) {
        if (chat) {
          await storage.updateProviderOnboardingChat(chat.id, { status: "completed" });
        }
        chat = await storage.createProviderOnboardingChat({
          providerId: userId,
          messages: [],
          status: "in_progress",
          generatedConfig: null,
        });
      }

      const history = (chat.messages as Array<{ role: string; content: string }>) || [];
      if (message) history.push({ role: "user", content: message });

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "AI service not configured" });
      }

      const systemPrompt = `You are Haven's friendly setup guide. You're helping a coach or therapist set up their practice on Haven through a warm, natural conversation.

Your job: ask 6-8 thoughtful questions across these areas, ONE AT A TIME (never combine questions):
1. What kind of work they do (coaching focus, therapy modality, who they serve)
2. Their methodology or approach (named frameworks, philosophies, signature methods)
3. How they typically structure client journeys (stages, phases, milestones)
4. What progress looks like for their clients (signals, outcomes, themes)
5. Their communication style and tone (warm, structured, playful, etc.)
6. Their non-negotiables (boundaries, ethics, what they avoid)
7. What they want their AI assistant to be like (a name, vibe, personality)

Style: warm, curious, never clinical. Short messages. Use the coach's own language.

When you have enough information (after about 6-8 exchanges), respond with EXACTLY this token on its own line: [READY_TO_GENERATE]
Then offer one short closing message like "I think I have a great picture of your practice. Let me put it all together..."

Until [READY_TO_GENERATE], just keep the conversation going naturally. Do NOT generate the config — that's a separate step.`;

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...history.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
      ];

      // First message bootstrap
      if (history.length === 0) {
        aiMessages.push({ role: "user", content: "Hi! I'm a new coach setting up my practice. Let's get started." });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: aiMessages, temperature: 0.8 }),
      });
      if (!response.ok) throw new Error(`AI API error: ${response.status}`);
      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content || "Could you tell me more about your practice?";

      const readyToGenerate = aiContent.includes("[READY_TO_GENERATE]");
      const cleanContent = aiContent.replace(/\[READY_TO_GENERATE\]/g, "").trim();

      history.push({ role: "assistant", content: cleanContent });

      const updated = await storage.updateProviderOnboardingChat(chat.id, {
        messages: history,
      });

      res.json({ chat: updated, message: cleanContent, readyToGenerate });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/provider-onboarding/generate", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const chat = await storage.getActiveOnboardingChatByProviderId(userId);
      if (!chat) return res.status(404).json({ error: "No active onboarding chat" });

      const history = (chat.messages as Array<{ role: string; content: string }>) || [];
      if (history.length < 4) return res.status(400).json({ error: "Need more conversation first" });

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "AI service not configured" });

      const transcript = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const prompt = `Based on this onboarding conversation with a coach/therapist, generate their full Haven practice configuration.

Conversation:
${transcript}

Output STRICT JSON ONLY (no markdown, no commentary):
{
  "title": "Short program/practice title (e.g. 'Career Clarity Coaching')",
  "methodology": "1-2 sentence description of their approach",
  "stages": [
    { "name": "Stage Name", "description": "what happens here" }
  ],
  "labels": ["tag1", "tag2"],
  "summaryTemplate": ["What they discussed", "Key insight", "Next action"],
  "taggingRules": ["rule 1", "rule 2"],
  "trajectoryRules": ["signal of progress", "signal of stalling"],
  "agent": {
    "providerName": "Coach's name (or 'Your Coach' if not given)",
    "providerTitle": "Their title (e.g. 'Career Coach')",
    "coreIdentity": "Who the AI assistant is (1-2 sentences)",
    "guidingPrinciples": "Key principles the assistant follows",
    "tone": "Tone descriptor (e.g. warm, curious, grounded)",
    "voice": "Voice descriptor (e.g. uses simple language, asks open questions)",
    "rules": "Things the assistant always does",
    "boundaries": "Things the assistant never does"
  }
}

Aim for 4-6 stages that reflect their actual journey. Use the coach's own language wherever possible.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You synthesize practice configs from coaching conversations. Always return valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
      });
      if (!response.ok) throw new Error(`AI API error: ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let generated;
      try {
        generated = JSON.parse(cleaned);
      } catch {
        return res.status(500).json({ error: "AI returned invalid format. Please continue the conversation." });
      }

      const updated = await storage.updateProviderOnboardingChat(chat.id, {
        generatedConfig: generated,
      });

      res.json({ chat: updated, generatedConfig: generated });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/provider-onboarding/apply", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const chat = await storage.getActiveOnboardingChatByProviderId(userId);
      const config = req.body.config || (chat?.generatedConfig as any);
      if (!config) return res.status(400).json({ error: "No config to apply" });

      // Upsert provider_configs
      const existingProviderConfig = await storage.getProviderConfigByProviderId(userId);
      const providerConfigData = {
        providerId: userId,
        title: config.title || "My Practice",
        methodology: config.methodology || "",
        stages: config.stages || [],
        labels: config.labels || [],
        summaryTemplate: config.summaryTemplate || [],
        taggingRules: config.taggingRules || [],
        trajectoryRules: config.trajectoryRules || [],
      };
      if (existingProviderConfig) {
        await storage.updateProviderConfig(existingProviderConfig.id, providerConfigData);
      } else {
        await storage.createProviderConfig(providerConfigData);
      }

      // Upsert agent config
      const agent = config.agent || {};
      const existingAgent = await storage.getProviderAgentConfigByProviderId(userId);
      const agentData = {
        providerId: userId,
        providerName: agent.providerName || null,
        providerTitle: agent.providerTitle || null,
        coreIdentity: agent.coreIdentity || null,
        guidingPrinciples: agent.guidingPrinciples || null,
        tone: agent.tone || null,
        voice: agent.voice || null,
        rules: agent.rules || null,
        boundaries: agent.boundaries || null,
        avatarUrl: existingAgent?.avatarUrl || null,
        selectedModel: existingAgent?.selectedModel || "google/gemini-2.5-flash",
      };
      if (existingAgent) {
        await storage.updateProviderAgentConfig(existingAgent.id, agentData);
      } else {
        await storage.createProviderAgentConfig(agentData);
      }

      if (chat) {
        await storage.updateProviderOnboardingChat(chat.id, { status: "completed" });
      }

      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // ANALYTICS
  // ============================================================
  app.get("/api/analytics/practice-overview", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const engagements = await storage.getEngagementsByProviderId(userId);
      const totalClients = engagements.length;
      const activeClients = engagements.filter(e => e.status === "active").length;

      let totalSessions = 0;
      let endedSessions = 0;
      const stageDistribution: Record<string, number> = {};
      const trajectoryCounts: Record<string, number> = { steady: 0, drifting: 0, stalling: 0, accelerating: 0 };
      const sessionsPerWeek: Record<string, number> = {};

      for (const e of engagements) {
        const sessions = await storage.getSessionsByEngagementId(e.id);
        totalSessions += sessions.length;
        for (const s of sessions) {
          if (s.status === "ended") endedSessions++;
          if (s.startedAt) {
            const week = new Date(s.startedAt).toISOString().slice(0, 10);
            sessionsPerWeek[week] = (sessionsPerWeek[week] || 0) + 1;
          }
          const summary = await storage.getSummaryBySessionId(s.id);
          if (summary?.assignedStage) {
            stageDistribution[summary.assignedStage] = (stageDistribution[summary.assignedStage] || 0) + 1;
          }
          if (summary?.trajectoryStatus && trajectoryCounts[summary.trajectoryStatus] !== undefined) {
            trajectoryCounts[summary.trajectoryStatus]++;
          }
        }
      }

      const avgSessionsPerClient = totalClients ? +(totalSessions / totalClients).toFixed(1) : 0;

      res.json({
        totalClients,
        activeClients,
        totalSessions,
        endedSessions,
        avgSessionsPerClient,
        stageDistribution,
        trajectoryCounts,
        sessionsPerWeek,
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // SCHEDULE / DASHBOARD AT-A-GLANCE
  // ============================================================
  app.get("/api/schedule/overview", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const engagements = await storage.getEngagementsByProviderId(userId);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      const recentSessions: Array<any> = [];
      const inactiveClients: Array<any> = [];
      const overdueGoals: Array<any> = [];

      for (const e of engagements) {
        const sessions = await storage.getSessionsByEngagementId(e.id);
        const lastSession = sessions[0];
        if (lastSession?.startedAt) {
          recentSessions.push({
            engagementId: e.id,
            sessionId: lastSession.id,
            startedAt: lastSession.startedAt,
            status: lastSession.status,
          });
          const lastTime = new Date(lastSession.startedAt).getTime();
          if (now - lastTime > sevenDays && e.status === "active") {
            inactiveClients.push({ engagementId: e.id, lastActivity: lastSession.startedAt });
          }
        } else if (e.status === "active") {
          inactiveClients.push({ engagementId: e.id, lastActivity: e.createdAt });
        }
        const goals = await storage.getGoalsByEngagementId(e.id);
        for (const g of goals) {
          if (g.status === "active" && g.dueDate && new Date(g.dueDate).getTime() < now) {
            overdueGoals.push({ engagementId: e.id, goalId: g.id, title: g.title, dueDate: g.dueDate });
          }
        }
      }

      recentSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      res.json({
        recentSessions: recentSessions.slice(0, 10),
        inactiveClients,
        overdueGoals,
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // PUBLIC PROVIDER PROFILE (no auth required)
  // ============================================================
  app.get("/api/public/provider/:providerId", async (req, res) => {
    try {
      const providerId = req.params.providerId;
      const config = await storage.getProviderConfigByProviderId(providerId);
      const agent = await storage.getProviderAgentConfigByProviderId(providerId);
      if (!config && !agent) return res.status(404).json({ error: "Provider not found" });
      res.json({
        providerId,
        title: config?.title || agent?.providerTitle || "Coach",
        methodology: config?.methodology || "",
        stages: config?.stages || [],
        labels: config?.labels || [],
        providerName: agent?.providerName || "",
        providerTitle: agent?.providerTitle || "",
        avatarUrl: agent?.avatarUrl || "",
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
}
