import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import {
  messages as messagesTable,
  messageAttachments as messageAttachmentsTable,
  attachmentGrants as attachmentGrantsTable,
  clientMemory as clientMemoryTable,
  redactions as redactionsTable,
  safetyEvents as safetyEventsTable,
} from "@workspace/db";
import { eq, and, isNull, sql as dsql } from "drizzle-orm";
import { registerBillingRoutes } from "./billing";

/**
 * Build redacted snippets for internal (non-seeker-facing) LLM call audit
 * entries. We must record that a call happened (length + sha256) for
 * traceability, but storing raw transcript text would expand the PHI footprint
 * of safety_events beyond what is justified for safety telemetry.
 */
function internalAuditSnippet(text: string | undefined | null, label: string): string {
  if (!text) return `[redacted:${label}] empty`;
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 12);
  return `[redacted:${label}] len=${text.length} sha256=${hash}`;
}
import { z } from "zod/v4";
import type { Engagement, Goal, Session as DbSession, InsertMessageAttachment } from "@workspace/db";
import { runTwinTurn } from "../services/twinChat";
import { reflectAndWrite } from "../services/memory";
import { generateAndSaveBriefForEngagement } from "../services/sessionBriefs";
import {
  getSessionBriefById,
  getLatestSessionBriefForEngagement,
  listSessionBriefsForEngagement,
  markSessionBriefUsed,
} from "../services/sessionBriefStorage";
import {
  listPlaybooksByProvider,
  getPlaybookById,
  getDefaultPlaybookForProvider,
  createPlaybook,
  updatePlaybook,
  setDefaultPlaybook,
  duplicatePlaybook,
  listPersonaExamplesForPlaybook,
  seedStarterPlaybooksIfEmpty,
} from "../services/playbookStorage";
import {
  listSafetyEventsByProvider,
  listSafetyEventsByEngagement,
  createPersonaExample,
  listPersonaExamplesByProvider,
  deactivatePersonaExample,
  getPersonaExampleById,
  getClientMemoryById,
  listClientMemoryForSeekerOwner,
  redactClientMemoryBySourceMessage,
  logRedaction,
  createCalibrationSession,
  getCalibrationSession,
  listCalibrationSessionsByProvider,
  updateCalibrationSession,
  listClientMemoryByEngagement,
  redactClientMemory,
  updateClientMemory,
  listReviewQueueForProvider,
  getReviewItemForMessage,
  logSafetyEvent,
} from "../services/twinStorage";
import {
  embed,
  llmConfigured,
  transcribeAudio,
  transcriptionConfigured,
  synthesizeSpeech,
  ttsConfigured,
  type ChatMessage,
} from "../lib/llm";
import { runGuardedLLM, type SafetyDecision } from "../services/safety";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
const objectStorageService = new ObjectStorageService();
import { snapshotAgentVersion } from "../services/persona";
import { sendPushToUser } from "../lib/push";
import type {
  SyntheticClientProfile,
  CalibrationTurn,
  CalibrationLabel,
  ProviderConfigStage,
} from "../services/twinTypes";

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
  registerBillingRoutes(app);

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get("/api/healthz", (req, res) => {
    res.json({ status: "ok" });
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
        await snapshotAgentVersion({
          providerId: userId,
          reason: "agent_config_updated",
          createdBy: userId,
        });
        return res.json(updated);
      }

      const config = await storage.createProviderAgentConfig({
        providerId: userId,
        ...data,
      });
      await snapshotAgentVersion({
        providerId: userId,
        reason: "agent_config_created",
        createdBy: userId,
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
      const m = await assertEngagementMember(req, req.params.id);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      res.json(m.engagement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/sessions", requireAuth, async (req, res) => {
    try {
      const m = await assertEngagementMember(req, req.params.id);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      const sessions = await storage.getSessionsByEngagementId(req.params.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const { engagementId, initialStage } = req.body;
      if (!engagementId) return res.status(400).json({ error: "engagementId required" });
      const m = await assertEngagementMember(req, engagementId);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
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
      const m = await assertSessionMember(req, req.params.id);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      res.json(m.session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id/messages", requireAuth, async (req, res): Promise<void> => {
    try {
      const sessionId = String(req.params.id);
      const m = await assertSessionMember(req, sessionId);
      if (!m.ok) {
        res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
        return;
      }
      // Storage layer already strips content for redacted rows; clients get
      // redactedAt + empty content and render an italic placeholder.
      const rows = await storage.getMessagesBySessionId(sessionId);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seeker-only "Forget this": soft-redact a message and cascade to any L3
  // memory entries that were attributed to it. Audited via safety_events.
  app.post("/api/messages/:id/redact", requireAuth, async (req, res): Promise<void> => {
    try {
      const messageId = String(req.params.id);
      const msg = await storage.getMessageById(messageId);
      if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
      if (msg.role !== "seeker") {
        res.status(403).json({ error: "Only seeker messages can be redacted" });
        return;
      }
      if (!msg.sessionId) { res.status(400).json({ error: "Message has no session" }); return; }
      const m = await assertSessionMember(req, msg.sessionId);
      if (!m.ok) { res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error }); return; }
      // The session-member check passes for both provider and seeker; this
      // endpoint must be seeker-only, so verify ownership explicitly.
      let seekerUserId: string | null = null;
      if (m.engagement.seekerId) {
        const seeker = await storage.getSeekerById(m.engagement.seekerId);
        seekerUserId = seeker?.ownerId ?? null;
      }
      if (seekerUserId !== req.user!.id) {
        res.status(403).json({ error: "Only the seeker may redact their own messages" });
        return;
      }
      if (msg.redactedAt) { res.json({ ok: true, alreadyRedacted: true }); return; }

      const reason = typeof req.body?.reason === "string"
        ? String(req.body.reason).slice(0, 500)
        : null;

      // Atomic: overwrite + cascade + redactions rows + safety_events.
      const userId = req.user!.id;
      const sessionId = msg.sessionId;
      const engagementId = m.engagement.id;
      const providerId = m.engagement.providerId;
      // Snapshot attachment storage keys BEFORE the transaction so we can
      // physically delete the GCS blobs after the DB commits. We do the
      // blob deletion outside the SQL transaction (it's a network call to
      // GCS, can't be rolled back) but only after the row deletes
      // succeed, so a failed delete leaves nothing dangling in the DB.
      const attachmentRows = await db
        .select()
        .from(messageAttachmentsTable)
        .where(eq(messageAttachmentsTable.messageId, messageId));

      const { updated, cascadedIds } = await db.transaction(async (tx) => {
        // Drop attachment rows in the same atomic write as the content
        // overwrite so a coach reload mid-redact never sees an orphaned
        // attachment pointer.
        if (attachmentRows.length > 0) {
          await tx
            .delete(messageAttachmentsTable)
            .where(eq(messageAttachmentsTable.messageId, messageId));
        }
        const [updatedRow] = await tx
          .update(messagesTable)
          .set({ content: "", redactedAt: new Date(), redactedBy: userId })
          .where(eq(messagesTable.id, messageId))
          .returning();

        const cascadeRows = await tx
          .update(clientMemoryTable)
          .set({
            content: "",
            tags: [],
            embedding: null,
            redactedAt: new Date(),
            redactedBy: userId,
          })
          .where(
            and(
              isNull(clientMemoryTable.redactedAt),
              dsql`(
                ${clientMemoryTable.sourceMessageIds} ? ${messageId}
                OR (
                  ${clientMemoryTable.sessionId} = ${sessionId}
                  AND (
                    ${clientMemoryTable.sourceMessageIds} IS NULL
                    OR jsonb_array_length(${clientMemoryTable.sourceMessageIds}) = 0
                  )
                )
              )`,
            ),
          )
          .returning({ id: clientMemoryTable.id });
        const cIds = cascadeRows.map((r) => r.id);

        const [parent] = await tx
          .insert(redactionsTable)
          .values({
            scope: "message",
            targetId: messageId,
            seekerUserId: userId,
            engagementId,
            sessionId,
            parentId: null,
            reason,
          })
          .returning();
        if (cIds.length > 0) {
          await tx.insert(redactionsTable).values(
            cIds.map((memId) => ({
              scope: "memory" as const,
              targetId: memId,
              seekerUserId: userId,
              engagementId,
              sessionId,
              parentId: parent.id,
              reason: null,
            })),
          );
        }

        await tx.insert(safetyEventsTable).values({
          providerId,
          engagementId,
          sessionId,
          userId,
          stage: "redaction",
          decision: "redact",
          severity: "info",
          reason: `Seeker redacted message ${messageId}`,
        });
        if (cIds.length > 0) {
          await tx.insert(safetyEventsTable).values(
            cIds.map((memId) => ({
              providerId,
              engagementId,
              sessionId,
              userId,
              stage: "redaction",
              decision: "redact" as const,
              severity: "info" as const,
              reason: `Cascade-redacted client_memory ${memId} from message ${messageId}`,
            })),
          );
        }

        return { updated: updatedRow, cascadedIds: cIds };
      });

      // Best-effort blob purge. If GCS is briefly unavailable the rows
      // are already gone and any signed URL minted before the redact has
      // its 1h TTL — but the next time we sweep the bucket these orphans
      // will be obvious. We log instead of throwing because a 500 here
      // would mislead the seeker into thinking the redact didn't apply.
      if (attachmentRows.length > 0) {
        await Promise.all(
          attachmentRows.map((a) =>
            objectStorageService.deleteObjectEntity(a.storageKey).catch((err) => {
              req.log.warn(
                { err, messageId, storageKey: a.storageKey },
                "redact: blob delete failed (db rows already removed)",
              );
            }),
          ),
        );
      }

      req.log.info(
        { messageId, cascadedMemoryCount: cascadedIds.length, attachmentBlobsDeleted: attachmentRows.length },
        "seeker redacted message",
      );
      res.json({ ok: true, message: updated, cascadedMemoryIds: cascadedIds });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seeker memory inspector — every L3 entry the twin holds about the
  // requesting seeker, across all engagements they own.
  app.get("/api/seeker/memory", requireAuth, async (req, res) => {
    try {
      const rows = await listClientMemoryForSeekerOwner(req.user!.id);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/seeker/memory/:id/redact", requireAuth, async (req, res): Promise<void> => {
    try {
      const memId = String(req.params.id);
      const mem = await getClientMemoryById(memId);
      if (!mem) { res.status(404).json({ error: "Memory not found" }); return; }
      const engagement = await storage.getEngagementById(mem.engagementId);
      if (!engagement?.seekerId) { res.status(403).json({ error: "Forbidden" }); return; }
      const seeker = await storage.getSeekerById(engagement.seekerId);
      if (seeker?.ownerId !== req.user!.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (mem.redactedAt) { res.json({ ok: true, alreadyRedacted: true }); return; }
      const reason = typeof req.body?.reason === "string"
        ? String(req.body.reason).slice(0, 500)
        : null;
      const userId = req.user!.id;
      // Atomic: overwrite + redactions row + safety_events row.
      await db.transaction(async (tx) => {
        await tx
          .update(clientMemoryTable)
          .set({
            content: "",
            tags: [],
            embedding: null,
            redactedAt: new Date(),
            redactedBy: userId,
          })
          .where(eq(clientMemoryTable.id, memId));
        await tx.insert(redactionsTable).values({
          scope: "memory",
          targetId: mem.id,
          seekerUserId: userId,
          engagementId: engagement.id,
          sessionId: mem.sessionId,
          parentId: null,
          reason,
        });
        await tx.insert(safetyEventsTable).values({
          providerId: engagement.providerId,
          engagementId: engagement.id,
          sessionId: mem.sessionId,
          userId,
          stage: "redaction",
          decision: "redact",
          severity: "info",
          reason: `Seeker forgot memory entry ${mem.id}`,
        });
      });
      req.log.info({ memoryId: mem.id }, "seeker redacted memory entry");
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Server-enforced limits and allowlists. Anything outside these is
  // rejected before we read a single byte from GCS.
  const ALLOWED_IMAGE_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  const ALLOWED_AUDIO_MIME = new Set([
    "audio/m4a",
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
  ]);
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  const MAX_AUDIO_DURATION_S = 120;

  const attachmentSchema = z.object({
    kind: z.enum(["image", "audio"]),
    objectPath: z.string().min(1).startsWith("/objects/"),
    mime: z.string().min(1).max(120),
    sizeBytes: z.number().int().nonnegative().optional(),
    durationS: z.number().int().nonnegative().max(MAX_AUDIO_DURATION_S).optional(),
  });
  const attachmentArraySchema = z.array(attachmentSchema).max(8);

  // /api/chat — Therapist Twin orchestrated turn (L1 in → L2/L3 → LLM → L1 out → persist)
  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { sessionId, message, attachments } = req.body ?? {};
      // Attachments: photos render inline; voice memos are transcribed
      // server-side and the transcript is folded into `userMessage` so the
      // L1/L2/L3 safety + persona pipeline applies the same way it does
      // for typed input. At least one of (text, attachment) is required.
      const attachmentInput = attachmentArraySchema.parse(attachments ?? []);
      const typedText = typeof message === "string" ? message.trim() : "";
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      if (!typedText && attachmentInput.length === 0) {
        return res.status(400).json({ error: "message or attachments required" });
      }

      const m = await assertSessionMember(req, sessionId);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      const session = m.session;
      const engagement = m.engagement;
      if (!engagement?.providerId) {
        return res.status(400).json({ error: "Invalid engagement" });
      }

      // Seeker-only endpoint; provider-authored turns must use a dedicated
      // provider-send endpoint to keep audit/review semantics intact.
      let seekerUserId = req.user!.id;
      if (engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId) seekerUserId = seeker.ownerId;
      }
      if (seekerUserId !== req.user!.id) {
        return res.status(403).json({
          error: "Only the seeker may send messages on this endpoint. Providers cannot author Twin turns.",
        });
      }

      // Reject unsupported MIMEs before any I/O.
      for (const a of attachmentInput) {
        const allowed = a.kind === "image" ? ALLOWED_IMAGE_MIME : ALLOWED_AUDIO_MIME;
        if (!allowed.has(a.mime.toLowerCase())) {
          return res.status(415).json({ error: `Unsupported ${a.kind} type: ${a.mime}` });
        }
      }

      // Authorize every grant before any side effects.
      for (const a of attachmentInput) {
        const grant = await storage.getValidAttachmentGrant({
          objectPath: a.objectPath,
          userId: req.user!.id,
          sessionId,
          kind: a.kind,
          mime: a.mime,
        });
        if (!grant) {
          req.log.warn(
            { sessionId, objectPath: a.objectPath, kind: a.kind },
            "rejected attachment without valid upload grant (pre-validate)",
          );
          return res.status(403).json({ error: "Attachment grant invalid or already consumed" });
        }
      }

      // Stat every blob: confirms the upload completed and enforces
      // per-kind size limits before we read anything into memory.
      const stats = new Map<string, { sizeBytes: number; contentType: string | null }>();
      for (const a of attachmentInput) {
        const stat = await objectStorageService.statObjectEntity(a.objectPath);
        if (!stat.exists || !stat.sizeBytes || stat.sizeBytes <= 0) {
          return res.status(400).json({ error: "Upload not found or empty; please re-upload the attachment" });
        }
        const limit = a.kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
        if (stat.sizeBytes > limit) {
          return res.status(413).json({
            error: `${a.kind === "image" ? "Photo" : "Voice memo"} too large (max ${Math.round(limit / 1024 / 1024)} MB)`,
          });
        }
        if (stat.contentType && a.kind === "image" && !ALLOWED_IMAGE_MIME.has(stat.contentType.toLowerCase())) {
          return res.status(415).json({ error: `Uploaded blob content-type ${stat.contentType} not allowed for image` });
        }
        if (stat.contentType && a.kind === "audio" && !ALLOWED_AUDIO_MIME.has(stat.contentType.toLowerCase())) {
          return res.status(415).json({ error: `Uploaded blob content-type ${stat.contentType} not allowed for audio` });
        }
        stats.set(a.objectPath, { sizeBytes: stat.sizeBytes, contentType: stat.contentType });
      }

      // Audio MUST be transcribed before L1; fail closed otherwise.
      const hasAudio = attachmentInput.some((a) => a.kind === "audio");
      if (hasAudio && !transcriptionConfigured()) {
        return res.status(503).json({
          error: "Voice memo transcription is currently unavailable. Please send your message as text.",
        });
      }
      const transcripts: Array<{ idx: number; text: string; durationS: number | null }> = [];
      for (let i = 0; i < attachmentInput.length; i++) {
        const a = attachmentInput[i];
        if (a.kind !== "audio") continue;
        let text = "";
        let probedDurationS: number | null = null;
        try {
          const { buffer, contentType } = await objectStorageService.readObjectEntityBuffer(a.objectPath);
          const { parseBuffer } = await import("music-metadata");
          const meta = await parseBuffer(buffer, { mimeType: a.mime || contentType, size: buffer.length });
          const dur = meta.format.duration;
          if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
            probedDurationS = Math.round(dur);
            if (dur > MAX_AUDIO_DURATION_S + 2) {
              return res.status(413).json({
                error: `Voice memo too long (max ${MAX_AUDIO_DURATION_S}s)`,
              });
            }
          }
          const raw = await transcribeAudio({
            audioBase64: buffer.toString("base64"),
            mimeType: a.mime || contentType,
            filename: `voice-memo.${(a.mime || contentType).split("/")[1]?.split(";")[0] || "m4a"}`,
          });
          text = (raw ?? "").trim();
        } catch (err) {
          req.log.warn({ err, sessionId, objectPath: a.objectPath }, "voice memo transcription failed");
          return res.status(422).json({
            error: "We couldn't transcribe that voice memo. Please try again or type your message.",
          });
        }
        if (!text) {
          return res.status(422).json({
            error: "We couldn't make out any speech in that recording. Please try again.",
          });
        }
        transcripts.push({ idx: i, text, durationS: probedDurationS });
      }

      // Compose the seeker-visible content. Photo-only sends get a stable
      // placeholder so the row isn't empty in transcripts/exports.
      const transcriptParts = transcripts.map((t) => t.text).filter((t) => t.length > 0);
      const photoCount = attachmentInput.filter((a) => a.kind === "image").length;
      const composedParts: string[] = [];
      if (typedText) composedParts.push(typedText);
      composedParts.push(...transcriptParts);
      if (composedParts.length === 0 && photoCount > 0) {
        composedParts.push(photoCount === 1 ? "[shared a photo]" : `[shared ${photoCount} photos]`);
      }
      const composedMessage = composedParts.join("\n\n");

      // Atomic finalize: insert message, attachment rows, and consume
      // grants in one tx. Grant UPDATE WHERE consumedAt IS NULL detects
      // concurrent consumers and rolls back the whole tx.
      const seekerMsg = await db.transaction(async (tx) => {
        const [insertedMsg] = await tx
          .insert(messagesTable)
          .values({ sessionId, role: "seeker", content: composedMessage })
          .returning();
        if (attachmentInput.length > 0) {
          for (let i = 0; i < attachmentInput.length; i++) {
            const a = attachmentInput[i];
            const [grantRow] = await tx
              .update(attachmentGrantsTable)
              .set({ consumedAt: new Date(), messageId: insertedMsg.id })
              .where(
                and(
                  eq(attachmentGrantsTable.objectPath, a.objectPath),
                  eq(attachmentGrantsTable.userId, req.user!.id),
                  eq(attachmentGrantsTable.sessionId, sessionId),
                  eq(attachmentGrantsTable.kind, a.kind),
                  eq(attachmentGrantsTable.mime, a.mime),
                  isNull(attachmentGrantsTable.consumedAt),
                  dsql`${attachmentGrantsTable.expiresAt} >= now()`,
                ),
              )
              .returning();
            if (!grantRow) {
              throw new Error("ATTACHMENT_GRANT_RACE");
            }
          }
          const items: InsertMessageAttachment[] = attachmentInput.map((a, i) => ({
            messageId: insertedMsg.id,
            kind: a.kind,
            storageKey: a.objectPath,
            mime: a.mime,
            sizeBytes: a.sizeBytes ?? null,
            durationS: a.kind === "audio"
              ? (transcripts.find((t) => t.idx === i)?.durationS ?? a.durationS ?? null)
              : null,
            transcript: a.kind === "audio"
              ? (transcripts.find((t) => t.idx === i)?.text ?? "")
              : null,
          }));
          await tx.insert(messageAttachmentsTable).values(items);
        }
        return insertedMsg;
      }).catch((err) => {
        if (err?.message === "ATTACHMENT_GRANT_RACE") return null;
        throw err;
      });
      if (!seekerMsg) {
        req.log.warn({ sessionId }, "attachment grant race lost — no state persisted");
        return res.status(409).json({ error: "Attachment grant was consumed concurrently; please retry" });
      }
      const recentMessages = await storage.getMessagesBySessionId(sessionId);

      const result = await runTwinTurn({
        providerId: engagement.providerId,
        engagementId: engagement.id,
        sessionId,
        userId: seekerUserId,
        initialStage: session.initialStage,
        userMessage: composedMessage,
        recentMessages: recentMessages.slice(0, -1), // drop the message we just inserted
      });

      const agentMessage = await storage.createMessage({
        sessionId,
        role: "agent",
        content: result.reply,
      });

      // Best-effort push to the seeker so they see the reply if the app
      // was backgrounded while the model was reflecting. Never blocks the
      // response and never throws.
      void (async () => {
        try {
          const preview = result.reply.length > 140
            ? `${result.reply.slice(0, 137)}…`
            : result.reply;
          await sendPushToUser(seekerUserId, {
            title: "Your coach replied",
            body: preview,
            data: {
              type: "coach_message",
              engagementId: engagement.id,
              sessionId,
              messageId: agentMessage.id,
            },
          });
        } catch (err) {
          req.log.warn({ err, sessionId }, "push: agent reply notify failed");
        }
      })();

      // Provider alert on safety escalations / softens that flagged it
      if (result.alertProvider) {
        try {
          await storage.createAlert({
            providerId: engagement.providerId,
            engagementId: engagement.id,
            type: result.severity === "critical" ? "crisis_detected" : "safety_event",
            message:
              result.severity === "critical"
                ? "A client message triggered a crisis-level safety response. Please follow up promptly."
                : `A client message triggered a safety event (${result.decision}). Review when possible.`,
            isRead: false,
          });
        } catch {}
      }

      res.json({
        message: agentMessage,
        safety: {
          decision: result.decision,
          severity: result.severity,
          templated: result.templated,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // /api/attachments/upload-url — Issue a 15-minute signed PUT URL for the
  // seeker's client to upload a photo or voice memo blob directly to GCS.
  // We tie the request to a session the caller belongs to so we never
  // hand a writable URL to an unrelated third party. The returned
  // objectPath is what the client must echo back in the next /api/chat
  // call's `attachments` array.
  app.post("/api/attachments/upload-url", requireAuth, async (req, res) => {
    try {
      const body = z.object({
        sessionId: z.string().min(1),
        kind: z.enum(["image", "audio"]),
        mime: z.string().min(1).max(120),
      }).safeParse(req.body ?? {});
      if (!body.success) return res.status(400).json({ error: "Invalid request" });

      const m = await assertSessionMember(req, body.data.sessionId);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });

      // Seeker-only: only the seeker who owns this engagement can attach.
      let seekerUserId = req.user!.id;
      if (m.engagement.seekerId) {
        const seeker = await storage.getSeekerById(m.engagement.seekerId);
        if (seeker?.ownerId) seekerUserId = seeker.ownerId;
      }
      if (seekerUserId !== req.user!.id) {
        return res.status(403).json({ error: "Only the seeker may upload attachments" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      // Persist a binding so the next /api/chat call must present a
      // matching (objectPath, user, session, kind, mime). Without this
      // record the API server has no way to verify that a client-supplied
      // /objects/<id> path actually came from a grant we issued.
      // 15 minutes matches the signed PUT URL TTL.
      await storage.createAttachmentGrant({
        objectPath,
        userId: req.user!.id,
        sessionId: body.data.sessionId,
        kind: body.data.kind,
        mime: body.data.mime,
        ttlSec: 900,
      });
      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      req.log.error({ err: error }, "attachments/upload-url failed");
      res.status(500).json({ error: error.message });
    }
  });

  // /api/attachments/:id/url — Issue a short-lived signed GET URL for a
  // specific attachment, gated on session membership (so coaches reading
  // their inbox can also fetch). Browser/Expo loads the asset directly
  // from GCS so we don't proxy bytes through the API server.
  app.get("/api/attachments/:id/url", requireAuth, async (req, res) => {
    try {
      const att = await storage.getAttachmentById(req.params.id);
      if (!att) return res.status(404).json({ error: "Not found" });
      const parent = await storage.getMessageById(att.messageId);
      if (!parent?.sessionId) return res.status(404).json({ error: "Not found" });
      // Once the parent message is redacted, the attachment is dead too —
      // never mint a fresh signed URL for a forgotten artefact.
      if (parent.redactedAt) return res.status(410).json({ error: "Redacted" });
      const m = await assertSessionMember(req, parent.sessionId);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });

      const url = await objectStorageService.getObjectEntityDownloadURL(att.storageKey, 3600);
      res.json({ url, mime: att.mime, kind: att.kind });
    } catch (error: any) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      req.log.error({ err: error }, "attachments/:id/url failed");
      res.status(500).json({ error: error.message });
    }
  });

  // /api/voice/transcribe — Whisper transcription for voice messages.
  // The mobile client records audio (e.g. m4a/aac), base64-encodes it, and
  // POSTs it here. The transcript is returned to the client which then
  // sends it through /api/chat so all L1/L2/L3 safety, persona, and memory
  // logic still applies — there is no separate voice pipeline.
  //
  // Body limit is scoped to this route (and /api/voice/tts response payloads)
  // rather than applied globally — base64 audio can be large but only voice
  // endpoints need it. Whisper's hard cap is 25mb of raw audio; base64 adds
  // ~33% overhead, so we lift the JSON limit to 35mb to actually be able to
  // forward a full-cap recording.
  const voiceJson = express.json({ limit: "35mb" });
  app.post("/api/voice/transcribe", voiceJson, requireAuth, async (req, res) => {
    try {
      if (!transcriptionConfigured()) {
        return res.status(503).json({ error: "Voice transcription is not configured" });
      }
      const { audioBase64, mimeType, filename, language } = req.body ?? {};
      if (!audioBase64 || typeof audioBase64 !== "string") {
        return res.status(400).json({ error: "audioBase64 is required" });
      }
      const text = await transcribeAudio({
        audioBase64,
        mimeType: typeof mimeType === "string" ? mimeType : undefined,
        filename: typeof filename === "string" ? filename : undefined,
        language: typeof language === "string" ? language : undefined,
      });
      if (!text) {
        return res
          .status(422)
          .json({ error: "We couldn't understand that recording. Try again." });
      }
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // /api/voice/tts — Speak a coach (agent/provider) reply back to the
  // seeker. Locked down to: (1) the seeker who owns the engagement,
  // (2) a real persisted message in their session, (3) non-seeker roles
  // only. No arbitrary text-to-audio surface.
  app.post("/api/voice/tts", voiceJson, requireAuth, async (req, res) => {
    try {
      if (!ttsConfigured()) {
        return res.status(503).json({ error: "Voice playback is not configured" });
      }
      const { sessionId, messageId, voice, format } = req.body ?? {};
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "sessionId is required" });
      }
      if (!messageId || typeof messageId !== "string") {
        return res.status(400).json({ error: "messageId is required" });
      }
      const m = await assertSessionMember(req, sessionId);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });

      // Seeker-only: must be the owner of this engagement's seeker.
      const userId = req.user!.id;
      const engagement = m.engagement;
      let isSeeker = false;
      if (engagement.seekerId) {
        const seeker = await storage.getSeekerById(engagement.seekerId);
        if (seeker?.ownerId === userId) isSeeker = true;
      }
      if (!isSeeker) {
        return res.status(403).json({ error: "Only the seeker can play coach audio" });
      }

      const messages = await storage.getMessagesBySessionId(sessionId);
      const msg = messages.find((x) => x.id === messageId);
      if (!msg) return res.status(404).json({ error: "Message not found" });
      if (msg.role === "seeker") {
        return res.status(400).json({ error: "Only coach replies can be spoken" });
      }
      const spoken = msg.content;
      if (!spoken.trim()) {
        return res.status(400).json({ error: "Nothing to speak" });
      }

      const result = await synthesizeSpeech({
        text: spoken,
        voice: typeof voice === "string" ? voice : undefined,
        format:
          format === "mp3" ||
          format === "opus" ||
          format === "aac" ||
          format === "wav"
            ? format
            : undefined,
      });
      if (!result) {
        return res.status(502).json({ error: "Couldn't generate audio right now." });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:id/finish", requireAuth, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const auth = await assertSessionMember(req, sessionId);
      if (!auth.ok) return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      const session = auth.session;
      const engagement = auth.engagement;
      if (!engagement?.providerId) {
        return res.status(400).json({ error: "Invalid engagement" });
      }
      const messages = await storage.getMessagesBySessionId(sessionId);

      const providerConfig = await storage.getProviderConfigByProviderId(engagement.providerId);
      if (!providerConfig) {
        return res.status(400).json({ error: "Provider config not found" });
      }

      if (!llmConfigured()) {
        await storage.updateSession(sessionId, { status: "ended", endedAt: new Date() });
        return res.json({ success: true, summary: null });
      }

      const transcriptForAI = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      }));

      const stagesList = ((providerConfig.stages as ProviderConfigStage[] | null) ?? []).map((s) => s.name).join(", ");

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

      // Internal summarization via safety-wrapped LLM (fail-closed; skip on block).
      const guarded = await runGuardedLLM({
        purpose: "internal_provider",
        kind: "session_summary",
        ctx: {
          sessionId,
          engagementId: engagement.id,
          userId: req.user!.id,
          providerId: engagement.providerId,
        },
        messages: [
          { role: "system", content: "You are an expert coaching session analyst. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });
      const content = guarded.content;
      if (guarded.templated) {
        await storage.updateSession(sessionId, { status: "ended", endedAt: new Date() });
        return res.json({ success: true, summary: null, blockedBySafety: true });
      }
      await logSafetyEvent({
        sessionId,
        engagementId: engagement.id,
        userId: req.user!.id,
        providerId: engagement.providerId,
        stage: "internal_audit",
        decision: guarded.outputDecision,
        severity: guarded.outputDecision === "allow" ? "info" : "medium",
        reason: "internal_session_summary",
        classifierLabels: { internal: true, kind: "session_summary" },
        inputSnippet: internalAuditSnippet(prompt, "session_summary_prompt"),
        outputSnippet: internalAuditSnippet(content, "session_summary_output"),
        templateUsed: null,
        agentVersionId: null,
      });

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

      // L3 reflection: write durable client memory entries (best-effort)
      try {
        await reflectAndWrite({
          engagementId: engagement.id,
          sessionId,
          messages,
        });
      } catch {}

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
      const auth = await assertSessionMember(req, req.params.id);
      if (!auth.ok) return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      const summary = await storage.getSummaryBySessionId(req.params.id);
      res.json(summary || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/onboarding-assign", requireAuth, async (req, res) => {
    try {
      const { answers, stages } = req.body;

      if (!llmConfigured()) {
        return res.json({
          initial_stage: stages[0]?.name || "Initial",
          rationale: "Assigned to starting stage",
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

      // Internal stage-assignment via safety-wrapped LLM; fall back to default on block.
      let content = "";
      let guardedDecision: SafetyDecision = "allow";
      try {
        const guarded = await runGuardedLLM({
          purpose: "internal_provider",
          kind: "onboarding_assign",
          ctx: { userId: req.user!.id },
          messages: [
            { role: "system", content: "You are a stage assignment expert. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        });
        if (guarded.templated) {
          return res.json({ initial_stage: stages[0]?.name || "Initial", rationale: "Default assignment (safety gate)" });
        }
        content = guarded.content;
        guardedDecision = guarded.outputDecision;
      } catch {
        return res.json({ initial_stage: stages[0]?.name || "Initial", rationale: "Default assignment" });
      }
      await logSafetyEvent({
        sessionId: null,
        engagementId: null,
        userId: req.user!.id,
        providerId: null,
        stage: "internal_audit",
        decision: guardedDecision,
        severity: guardedDecision === "allow" ? "info" : "medium",
        reason: "internal_onboarding_assign",
        classifierLabels: { internal: true, kind: "onboarding_assign" },
        inputSnippet: internalAuditSnippet(prompt, "onboarding_assign_prompt"),
        outputSnippet: internalAuditSnippet(content, "onboarding_assign_output"),
        templateUsed: null,
        agentVersionId: null,
      });

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
      const auth = await assertEngagementMember(req, req.params.id);
      if (!auth.ok) return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      const indicators = await storage.getProgressIndicatorsByEngagementId(req.params.id);
      res.json(indicators);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Helper: ensure provider owns engagement
  // ============================================================
  type AuthOk<T> = { ok: true } & T;
  type AuthFail = { ok: false; error: string };

  async function assertProviderOwnsEngagement(
    req: Request,
    engagementId: string,
  ): Promise<AuthOk<{ engagement: Engagement }> | AuthFail> {
    const engagement = await storage.getEngagementById(engagementId);
    if (!engagement) return { ok: false, error: "Engagement not found" };
    if (engagement.providerId !== req.user!.id) return { ok: false, error: "Forbidden" };
    return { ok: true, engagement };
  }

  // Allow either the provider OR the engagement's seeker (its owner).
  async function assertEngagementMember(
    req: Request,
    engagementId: string,
  ): Promise<AuthOk<{ engagement: Engagement }> | AuthFail> {
    const engagement = await storage.getEngagementById(engagementId);
    if (!engagement) return { ok: false, error: "Engagement not found" };
    const userId = req.user!.id;
    if (engagement.providerId === userId) return { ok: true, engagement };
    if (engagement.seekerId) {
      const seeker = await storage.getSeekerById(engagement.seekerId);
      if (seeker?.ownerId === userId) return { ok: true, engagement };
    }
    return { ok: false, error: "Forbidden" };
  }

  // For session-scoped routes: load session, then check engagement membership.
  async function assertSessionMember(
    req: Request,
    sessionId: string,
  ): Promise<AuthOk<{ session: DbSession; engagement: Engagement }> | AuthFail> {
    const session = await storage.getSessionById(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    if (!session.engagementId) return { ok: false, error: "Forbidden" };
    const m = await assertEngagementMember(req, session.engagementId);
    if (!m.ok) return { ok: false, error: m.error };
    return { ok: true, session, engagement: m.engagement };
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
      // If the coach just marked this goal complete via the legacy path,
      // resolve any outstanding pending self-checkoffs so the
      // "to confirm" badge reflects reality.
      if (status === "completed" && goal.status !== "completed") {
        await storage.resolvePendingProgressForCompletedGoal(req.params.id, req.user!.id);
      }
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
  // GOAL PROGRESS — seeker self-checkoffs the coach can confirm
  // ============================================================

  // Helper: ensure caller is the seeker on the engagement that owns this goal.
  async function assertSeekerOwnsGoal(
    req: Request,
    goalId: string,
  ): Promise<AuthOk<{ goal: Goal; engagement: Engagement }> | AuthFail> {
    const goal = await storage.getGoalById(goalId);
    if (!goal) return { ok: false, error: "Goal not found" };
    const engagement = await storage.getEngagementById(goal.engagementId);
    if (!engagement) return { ok: false, error: "Engagement not found" };
    if (!engagement.seekerId) return { ok: false, error: "Forbidden" };
    const seeker = await storage.getSeekerById(engagement.seekerId);
    if (!seeker || seeker.ownerId !== req.user!.id) return { ok: false, error: "Forbidden" };
    return { ok: true, goal, engagement };
  }

  // Seeker marks a goal as "I think I did this" (idempotent toggle-on).
  // Body: { note?: string }
  app.post("/api/goals/:id/seeker-progress", requireAuth, async (req, res) => {
    try {
      const check = await assertSeekerOwnsGoal(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const { goal, engagement } = check;
      if (goal.status === "completed") {
        return res.status(400).json({ error: "Goal already completed" });
      }
      const note = typeof req.body?.note === "string" ? req.body.note.trim() || null : null;

      // If a pending self-checkoff already exists, update its note rather than
      // creating a duplicate so each (goal, seeker) pair has at most one
      // pending signal for the coach to confirm.
      const existing = await storage.getPendingGoalProgress(goal.id, req.user!.id);
      if (existing) {
        const updated = await storage.updateGoalProgress(existing.id, { note });
        return res.json(updated);
      }

      const created = await storage.createGoalProgress({
        goalId: goal.id,
        engagementId: engagement.id,
        seekerUserId: req.user!.id,
        note,
        status: "pending",
      });

      // Surface the self-checkoff in the coach's alerts inbox so they don't
      // have to keep the goals tab open to notice it.
      if (engagement.providerId) {
        try {
          await storage.createAlert({
            providerId: engagement.providerId,
            engagementId: engagement.id,
            type: "goal_self_checkoff",
            message: `Your client says they completed "${goal.title}". Confirm when ready.`,
            isRead: false,
          });
        } catch {}
      }

      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seeker undoes their self-checkoff (toggle-off). Only removes pending
  // entries — confirmed entries are part of the audit trail and stay put.
  app.delete("/api/goals/:id/seeker-progress", requireAuth, async (req, res) => {
    try {
      const check = await assertSeekerOwnsGoal(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      await storage.deletePendingGoalProgress(check.goal.id, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List all goal-progress signals on an engagement. Both the coach (to
  // review/confirm) and the seeker (so the mobile UI knows which goals are
  // currently checked off, even after reinstall) need this.
  app.get("/api/engagements/:id/goal-progress", requireAuth, async (req, res) => {
    try {
      const m = await assertEngagementMember(req, req.params.id);
      if (!m.ok) return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      const rows = await storage.getGoalProgressByEngagementId(req.params.id);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Coach one-tap "confirm complete": mark the progress entry confirmed AND
  // flip the underlying goal to completed in a single request.
  app.post("/api/goal-progress/:id/confirm", requireAuth, async (req, res) => {
    try {
      const progress = await storage.getGoalProgressById(req.params.id);
      if (!progress) return res.status(404).json({ error: "Progress not found" });
      const goal = await storage.getGoalById(progress.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      if (goal.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

      const result = await storage.confirmGoalProgress(progress.id, req.user!.id);
      if ("error" in result) {
        if (result.error === "not_found") {
          return res.status(404).json({ error: "Progress not found" });
        }
        // not_pending: already confirmed (race or double-tap). Return 409 so
        // the client can refresh rather than treating this as a hard failure.
        return res.status(409).json({ error: "Progress already confirmed" });
      }
      res.json({ progress: result.progress, goal: result.goal });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
  // COACH INBOX (triage queue)
  // ============================================================
  app.get("/api/coach/inbox", requireProvider, async (req, res) => {
    try {
      const rows = await storage.getCoachInboxRows(req.user!.id);
      res.json(rows);
    } catch (error: any) {
      req.log.error({ err: error }, "coach inbox load failed");
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/coach/inbox/:engagementId/handle", requireProvider, async (req, res) => {
    try {
      // Verify the engagement actually belongs to this coach before mutating.
      const engagement = await storage.getEngagementById(req.params.engagementId);
      if (!engagement || engagement.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      await storage.dismissCoachInboxRow(req.user!.id, req.params.engagementId);
      res.json({ success: true });
    } catch (error: any) {
      req.log.error({ err: error, engagementId: req.params.engagementId }, "coach inbox dismiss failed");
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PUSH NOTIFICATIONS
  // Mobile clients register their Expo push token here, can list/disable
  // their tokens, and the server uses these for coach-reply / check-in
  // delivery. Tokens are scoped to req.user — we never let clients touch
  // tokens that belong to a different user.
  // ============================================================
  app.post("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const { token, platform } = req.body as { token?: unknown; platform?: unknown };
      if (typeof token !== "string" || token.length < 8 || token.length > 256) {
        return res.status(400).json({ error: "token (string) is required" });
      }
      const allowed = new Set(["ios", "android", "web"]);
      const plat =
        typeof platform === "string" && allowed.has(platform) ? platform : null;
      // Don't pass `enabled` — storage uses the schema default for new
      // rows (enabled=true) and preserves the existing value on update,
      // so a user's prior opt-out is respected across logins/relaunches.
      const row = await storage.upsertPushToken({
        userId: req.user!.id,
        token,
        platform: plat,
      });
      res.json({ token: row });
    } catch (error: any) {
      req.log.warn({ err: error }, "push: upsert token failed");
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const tokens = await storage.getPushTokensByUserId(req.user!.id);
      const anyEnabled = tokens.some((t) => t.enabled);
      res.json({
        enabled: anyEnabled,
        tokens: tokens.map((t) => ({
          id: t.id,
          platform: t.platform,
          enabled: t.enabled,
          updatedAt: t.updatedAt,
        })),
      });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.patch("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body as { enabled?: unknown };
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled (boolean) is required" });
      }
      await storage.setPushTokensEnabledForUser(req.user!.id, enabled);
      res.json({ enabled });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const { token } = req.body as { token?: unknown };
      if (typeof token !== "string" || !token) {
        return res.status(400).json({ error: "token (string) is required" });
      }
      await storage.deletePushToken(token, req.user!.id);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // ============================================================
  // COACH → SEEKER DIRECT MESSAGES
  // The provider can send a text message OR a "check-in" nudge to a
  // seeker. We append it as a `provider`-role message in the latest
  // active session (creating one if needed) so it shows up in chat,
  // then push-notify the seeker so they see it on their phone.
  // ============================================================
  async function getOrCreateActiveSession(engagement: Engagement): Promise<DbSession> {
    const existing = await storage.getSessionsByEngagementId(engagement.id);
    const active = existing.find((s) => s.status === "active");
    if (active) return active;
    const providerConfig = engagement.providerId
      ? await storage.getProviderConfigByProviderId(engagement.providerId)
      : null;
    const stages = (providerConfig?.stages as ProviderConfigStage[] | null) ?? [];
    const initialStage = stages[0]?.name ?? "Initial";
    return storage.createSession({
      engagementId: engagement.id,
      initialStage,
      status: "active",
    });
  }

  async function deliverCoachMessage(
    req: Request,
    engagementId: string,
    rawContent: string,
    notif: { title: string; type: "coach_message" | "coach_check_in" },
  ) {
    const check = await assertProviderOwnsEngagement(req, engagementId);
    if (!check.ok) return { status: check.error === "Forbidden" ? 403 : 404, body: { error: check.error } };
    const engagement = check.engagement;
    const content = rawContent.trim();
    if (!content) return { status: 400, body: { error: "message is required" } };
    if (content.length > 4000) return { status: 400, body: { error: "message is too long" } };

    const session = await getOrCreateActiveSession(engagement);
    const message = await storage.createMessage({
      sessionId: session.id,
      role: "provider",
      content,
    });

    // Resolve seeker user id (owner of the seeker linked to this engagement).
    let seekerUserId: string | null = null;
    if (engagement.seekerId) {
      const seeker = await storage.getSeekerById(engagement.seekerId);
      seekerUserId = seeker?.ownerId ?? null;
    }

    let pushSent = 0;
    if (seekerUserId) {
      const preview = content.length > 140 ? `${content.slice(0, 137)}…` : content;
      try {
        const result = await sendPushToUser(seekerUserId, {
          title: notif.title,
          body: preview,
          data: {
            type: notif.type,
            engagementId: engagement.id,
            sessionId: session.id,
            messageId: message.id,
          },
        });
        pushSent = result.sent;
      } catch (err) {
        req.log.warn({ err, engagementId }, "push: coach message notify failed");
      }
    }

    return {
      status: 200,
      body: {
        message,
        sessionId: session.id,
        // notified reflects whether at least one device actually got the
        // push — provider UX should not claim delivery when no enabled
        // token exists or Expo rejected every recipient.
        notified: pushSent > 0,
        pushSent,
      },
    };
  }

  app.post("/api/engagements/:id/coach-message", requireProvider, async (req, res) => {
    try {
      const { message } = req.body as { message?: unknown };
      if (typeof message !== "string") {
        return res.status(400).json({ error: "message (string) is required" });
      }
      const r = await deliverCoachMessage(req, req.params.id, message, {
        title: "New message from your coach",
        type: "coach_message",
      });
      res.status(r.status).json(r.body);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/engagements/:id/check-in", requireProvider, async (req, res) => {
    try {
      const { message } = req.body as { message?: unknown };
      const text =
        typeof message === "string" && message.trim().length > 0
          ? message
          : "Just checking in — how are you doing today?";
      const r = await deliverCoachMessage(req, req.params.id, text, {
        title: "Check-in from your coach",
        type: "coach_check_in",
      });
      res.status(r.status).json(r.body);
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

      let onboardingChat = await storage.getActiveOnboardingChatByProviderId(userId);
      if (reset || !onboardingChat) {
        if (onboardingChat) {
          await storage.updateProviderOnboardingChat(onboardingChat.id, { status: "completed" });
        }
        onboardingChat = await storage.createProviderOnboardingChat({
          providerId: userId,
          messages: [],
          status: "in_progress",
          generatedConfig: null,
        });
      }

      const history = (onboardingChat.messages as Array<{ role: string; content: string }>) || [];
      if (message) history.push({ role: "user", content: message });

      if (!llmConfigured()) {
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

      const aiMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
      ];

      // First message bootstrap
      if (history.length === 0) {
        aiMessages.push({ role: "user", content: "Hi! I'm a new coach setting up my practice. Let's get started." });
      }

      // Provider-only setup conversation; safety-wrapped.
      const guardedChat = await runGuardedLLM({
        purpose: "internal_provider",
        kind: "provider_onboarding_chat",
        ctx: { userId, providerId: userId },
        messages: aiMessages,
        temperature: 0.8,
      });
      const aiContent = guardedChat.content || "Could you tell me more about your practice?";
      await logSafetyEvent({
        sessionId: null,
        engagementId: null,
        userId,
        providerId: userId,
        stage: "internal_audit",
        decision: guardedChat.outputDecision,
        severity: guardedChat.outputDecision === "allow" ? "info" : "medium",
        reason: "internal_provider_onboarding_chat",
        classifierLabels: { internal: true, kind: "provider_onboarding_chat" },
        inputSnippet: internalAuditSnippet(message, "provider_onboarding_chat_input"),
        outputSnippet: internalAuditSnippet(aiContent, "provider_onboarding_chat_output"),
        templateUsed: null,
        agentVersionId: null,
      });

      const readyToGenerate = aiContent.includes("[READY_TO_GENERATE]");
      const cleanContent = aiContent.replace(/\[READY_TO_GENERATE\]/g, "").trim();

      history.push({ role: "assistant", content: cleanContent });

      const updated = await storage.updateProviderOnboardingChat(onboardingChat.id, {
        messages: history,
      });

      res.json({ chat: updated, message: cleanContent, readyToGenerate });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/provider-onboarding/generate", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const onboardingChat = await storage.getActiveOnboardingChatByProviderId(userId);
      if (!onboardingChat) return res.status(404).json({ error: "No active onboarding chat" });

      const history = (onboardingChat.messages as Array<{ role: string; content: string }>) || [];
      if (history.length < 4) return res.status(400).json({ error: "Need more conversation first" });

      if (!llmConfigured()) return res.status(500).json({ error: "AI service not configured" });

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

      // Provider-only config synthesis; safety-wrapped.
      const guardedGen = await runGuardedLLM({
        purpose: "internal_provider",
        kind: "provider_onboarding_generate",
        ctx: { userId, providerId: userId },
        messages: [
          { role: "system", content: "You synthesize practice configs from coaching conversations. Always return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      });
      if (guardedGen.templated) {
        return res.status(400).json({ error: "Safety gate blocked config synthesis. Please revise the conversation." });
      }
      const content = guardedGen.content || "{}";
      await logSafetyEvent({
        sessionId: null,
        engagementId: null,
        userId,
        providerId: userId,
        stage: "internal_audit",
        decision: guardedGen.outputDecision,
        severity: guardedGen.outputDecision === "allow" ? "info" : "medium",
        reason: "internal_provider_onboarding_generate",
        classifierLabels: { internal: true, kind: "provider_onboarding_generate" },
        inputSnippet: internalAuditSnippet(prompt, "provider_onboarding_generate_prompt"),
        outputSnippet: internalAuditSnippet(content, "provider_onboarding_generate_output"),
        templateUsed: null,
        agentVersionId: null,
      });

      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let generated;
      try {
        generated = JSON.parse(cleaned);
      } catch {
        return res.status(500).json({ error: "AI returned invalid format. Please continue the conversation." });
      }

      const updated = await storage.updateProviderOnboardingChat(onboardingChat.id, {
        generatedConfig: generated,
      });

      res.json({ chat: updated, generatedConfig: generated });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/provider-onboarding/apply", requireProvider, async (req, res) => {
    try {
      const userId = req.user!.id;
      const chat = await storage.getActiveOnboardingChatByProviderId(userId);
      const config = (req.body.config ?? chat?.generatedConfig) as Record<string, unknown> | null;
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
      await snapshotAgentVersion({
        providerId: userId,
        reason: "onboarding_apply",
        createdBy: userId,
      });

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

  // ============================================================
  // THERAPIST TWIN — CONTROL TOWER (provider-only)
  // ============================================================

  // ---- Persona examples (L2 memory of approved responses) ----
  app.get("/api/twin/persona-examples", requireProvider, async (req, res) => {
    try {
      // When ?playbookId=... is supplied, scope to that playbook (verifying ownership).
      // Otherwise return all of the provider's active examples (legacy callers).
      const playbookId = typeof req.query.playbookId === "string" ? req.query.playbookId : null;
      if (playbookId) {
        const pb = await getPlaybookById(playbookId);
        if (!pb || pb.providerId !== req.user!.id) {
          return res.status(404).json({ error: "Playbook not found" });
        }
        const rows = await listPersonaExamplesForPlaybook(req.user!.id, playbookId);
        return res.json(rows);
      }
      const rows = await listPersonaExamplesByProvider(req.user!.id);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/twin/persona-examples", requireProvider, async (req, res) => {
    try {
      const { scenario, approvedResponse, rejectedResponse, notes, tags, source, playbookId } = req.body;
      if (!scenario || !approvedResponse) {
        return res.status(400).json({ error: "scenario and approvedResponse required" });
      }
      // Validate playbook ownership when supplied.
      let resolvedPlaybookId: string | null = null;
      if (playbookId) {
        const pb = await getPlaybookById(playbookId);
        if (!pb || pb.providerId !== req.user!.id) {
          return res.status(404).json({ error: "Playbook not found" });
        }
        resolvedPlaybookId = pb.id;
      }
      const embedding = await embed(`${scenario}\n${approvedResponse}`);
      const row = await createPersonaExample(
        {
          providerId: req.user!.id,
          playbookId: resolvedPlaybookId,
          source: source || "manual",
          scenario,
          approvedResponse,
          rejectedResponse: rejectedResponse || null,
          notes: notes || null,
          tags: Array.isArray(tags) ? tags : [],
          weight: 1.0,
          isActive: true,
        },
        embedding,
      );
      await snapshotAgentVersion({
        providerId: req.user!.id,
        reason: "persona_example_manual",
        createdBy: req.user!.id,
      });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ============================================================
  // Playbooks (L2) — coach-authored bundles of persona examples
  // ============================================================

  // List provider playbooks. Auto-seeds starter playbooks the first time a
  // provider opens the page so the feature isn't empty out of the box.
  app.get("/api/twin/playbooks", requireProvider, async (req, res) => {
    try {
      await seedStarterPlaybooksIfEmpty(req.user!.id);
      const includeArchived = req.query.includeArchived === "true";
      const rows = await listPlaybooksByProvider(req.user!.id, { includeArchived });
      res.json(rows);
    } catch (e: any) {
      req.log?.error?.({ err: e }, "playbooks_list_failed");
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/twin/playbooks/:id", requireProvider, async (req, res) => {
    try {
      const pb = await getPlaybookById(req.params.id);
      if (!pb || pb.providerId !== req.user!.id) return res.status(404).json({ error: "Not found" });
      res.json(pb);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/twin/playbooks", requireProvider, async (req, res) => {
    try {
      const { title, description, isDefault } = req.body as {
        title?: string;
        description?: string | null;
        isDefault?: boolean;
      };
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "title required" });
      }
      const row = await createPlaybook({
        providerId: req.user!.id,
        title: title.trim().slice(0, 200),
        description: description?.slice(0, 2000) ?? null,
        isDefault: Boolean(isDefault),
        isArchived: false,
      });
      res.json(row);
    } catch (e: any) {
      req.log?.error?.({ err: e }, "playbook_create_failed");
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH for rename / description edit / archive toggle.
  app.patch("/api/twin/playbooks/:id", requireProvider, async (req, res) => {
    try {
      const pb = await getPlaybookById(req.params.id);
      if (!pb || pb.providerId !== req.user!.id) return res.status(404).json({ error: "Not found" });
      const { title, description, isArchived } = req.body as {
        title?: string;
        description?: string | null;
        isArchived?: boolean;
      };
      const patch: Partial<{ title: string; description: string | null; isArchived: boolean }> = {};
      if (typeof title === "string" && title.trim()) patch.title = title.trim().slice(0, 200);
      if (description !== undefined) patch.description = description?.slice(0, 2000) ?? null;
      if (typeof isArchived === "boolean") patch.isArchived = isArchived;
      const row = await updatePlaybook(req.params.id, patch);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Promote to default. Demotes the previous default in the same transaction.
  app.post("/api/twin/playbooks/:id/default", requireProvider, async (req, res) => {
    try {
      const pb = await getPlaybookById(req.params.id);
      if (!pb || pb.providerId !== req.user!.id) return res.status(404).json({ error: "Not found" });
      const row = await setDefaultPlaybook(req.user!.id, req.params.id);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Clone a playbook + all its active examples. Embeddings are copied across
  // so retrieval works on the duplicate immediately without re-embedding.
  app.post("/api/twin/playbooks/:id/duplicate", requireProvider, async (req, res) => {
    try {
      const pb = await getPlaybookById(req.params.id);
      if (!pb || pb.providerId !== req.user!.id) return res.status(404).json({ error: "Not found" });
      const titleOverride = typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim().slice(0, 200)
        : `${pb.title} (copy)`;
      const dup = await duplicatePlaybook(req.user!.id, req.params.id, titleOverride);
      if (!dup) return res.status(500).json({ error: "Duplication failed" });
      res.json(dup);
    } catch (e: any) {
      req.log?.error?.({ err: e }, "playbook_duplicate_failed");
      res.status(500).json({ error: e.message });
    }
  });

  // Assign a playbook (or unassign with playbookId=null) to an engagement.
  app.patch("/api/engagements/:id/playbook", requireProvider, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, req.params.id);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const { playbookId } = req.body as { playbookId?: string | null };
      let resolved: string | null = null;
      if (playbookId) {
        const pb = await getPlaybookById(playbookId);
        if (!pb || pb.providerId !== req.user!.id) return res.status(404).json({ error: "Playbook not found" });
        resolved = pb.id;
      }
      const updated = await storage.updateEngagement(req.params.id, { playbookId: resolved });
      res.json(updated);
    } catch (e: any) {
      req.log?.error?.({ err: e }, "engagement_set_playbook_failed");
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/twin/persona-examples/:id", requireProvider, async (req, res) => {
    try {
      const ex = await getPersonaExampleById(req.params.id);
      if (!ex) return res.status(404).json({ error: "Not found" });
      if (ex.providerId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      await deactivatePersonaExample(req.params.id);
      await snapshotAgentVersion({
        providerId: req.user!.id,
        reason: "persona_example_deactivated",
        createdBy: req.user!.id,
      });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Calibration sessions (synthetic-client interview) ----
  // Spec-compliant aliases. The original implementation lives under
  // /api/twin/calibration/*; we expose /api/calibration/* as well so callers
  // following the public spec keep working without code changes.
  app.use(async (req, res, next) => {
    // Preserve querystring; req.path strips it but req.url still carries it.
    const qIdx = req.url.indexOf("?");
    const qs = qIdx >= 0 ? req.url.slice(qIdx) : "";

    // /api/calibration/* aliases. /correct has its own handler (always
    // persists "this_is_me") so do NOT rewrite to /approve here.
    if (req.path === "/api/calibration/start" && req.method === "POST") {
      req.url = `/api/twin/calibration${qs}`;
    } else if (req.path.startsWith("/api/calibration/")) {
      const m = req.path.match(/^\/api\/calibration\/([^/]+)\/(turn)$/);
      if (m) {
        req.url = `/api/twin/calibration/${m[1]}/${m[2]}${qs}`;
      }
    }

    // /api/review-queue[/:messageId/label] aliases for the spec contract.
    if (req.path === "/api/review-queue" && req.method === "GET") {
      req.url = `/api/twin/review-queue${qs}`;
    } else {
      const labelMatch = req.path.match(/^\/api\/review-queue\/([^/]+)\/label$/);
      if (labelMatch && req.method === "POST") {
        req.url = `/api/twin/review-queue/${labelMatch[1]}/label${qs}`;
      }
    }

    // /api/clients/:engagementId/memory[/:entryId] aliases.
    // Provider ownership is enforced by the underlying handler; for item
    // aliases we additionally enforce that the entry belongs to the path
    // engagementId so a forged path can't act on another client's memory.
    const memList = req.path.match(/^\/api\/clients\/([^/]+)\/memory$/);
    if (memList && req.method === "GET") {
      req.url = `/api/twin/memory/${memList[1]}${qs}`;
      return next();
    }
    const memItem = req.path.match(/^\/api\/clients\/([^/]+)\/memory\/([^/]+)$/);
    if (memItem && (req.method === "PATCH" || req.method === "DELETE")) {
      const pathEngagementId = memItem[1];
      const entryId = memItem[2];
      try {
        const mem = await getClientMemoryById(entryId);
        if (!mem || mem.engagementId !== pathEngagementId) {
          return res.status(404).json({ error: "Not found" });
        }
      } catch {
        // Invalid UUID or DB error — treat as not found rather than leaking details.
        return res.status(404).json({ error: "Not found" });
      }
      req.url = `/api/twin/memory/${entryId}${qs}`;
    }
    next();
  });

  app.post("/api/twin/calibration", requireProvider, async (req, res) => {
    try {
      const { scenarioName, syntheticClientProfile } = req.body;
      const profile: SyntheticClientProfile = (syntheticClientProfile as SyntheticClientProfile | undefined) ?? {
        presenting: "feeling stuck at work",
        tone: "anxious but reflective",
      };
      const row = await createCalibrationSession({
        providerId: req.user!.id,
        scenarioName: scenarioName || "Untitled scenario",
        syntheticClientProfile: profile,
        transcript: [] satisfies CalibrationTurn[],
        status: "in_progress",
      });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/twin/calibration", requireProvider, async (req, res) => {
    try {
      const rows = await listCalibrationSessionsByProvider(req.user!.id);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/twin/calibration/:id", requireProvider, async (req, res) => {
    try {
      const row = await getCalibrationSession(req.params.id);
      if (!row || row.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Generate the next synthetic-client utterance + the AI's draft response.
  app.post("/api/twin/calibration/:id/turn", requireProvider, async (req, res) => {
    try {
      const calib = await getCalibrationSession(req.params.id);
      if (!calib || calib.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Not found" });
      }
      const transcript: CalibrationTurn[] = (calib.transcript as CalibrationTurn[] | null) ?? [];

      // 1. Client utterance: therapist-authored (if posted) else synthetic.
      const profile = calib.syntheticClientProfile as SyntheticClientProfile;
      const therapistAuthored = typeof req.body?.clientMessage === "string"
        ? req.body.clientMessage.trim()
        : "";
      let clientUtterance: string;
      if (therapistAuthored.length > 0) {
        clientUtterance = therapistAuthored.slice(0, 4000);
      } else {
        const clientHistory = transcript
          .map((t) => `Client: ${t.client}\nTherapist Twin: ${t.draft}${t.approvedEdit ? ` (therapist approved as: ${t.approvedEdit})` : ""}`)
          .join("\n\n");
        const clientPrompt = `You are role-playing a synthetic client for a therapist's AI calibration.\n\nClient profile: ${JSON.stringify(profile)}\n\nConversation so far:\n${clientHistory || "(none)"}\n\nSpeak the client's NEXT message in 1-3 sentences. Stay in character. Output only the message text.`;
        try {
          const simGuarded = await runGuardedLLM({
            purpose: "internal_calibration",
            kind: "synthetic_client_utterance",
            ctx: { providerId: req.user!.id, userId: req.user!.id },
            temperature: 0.8,
            messages: [
              { role: "system", content: "You are a research-grade client simulator. Be realistic, not theatrical." },
              { role: "user", content: clientPrompt },
            ],
          });
          clientUtterance = simGuarded.content.trim();
        } catch {
          return res.status(503).json({ error: "Safety audit unavailable; please retry" });
        }
      }

      // 2. Twin draft using the production persona path; calibration uses null FK ids.
      const draftResult = await runTwinTurn({
        providerId: req.user!.id,
        engagementId: null,
        sessionId: null,
        userId: req.user!.id,
        initialStage: null,
        userMessage: clientUtterance,
        recentMessages: [],
      });

      const newTurn: CalibrationTurn = {
        client: clientUtterance,
        draft: draftResult.reply,
        templated: draftResult.templated,
        decision: draftResult.decision as SafetyDecision,
        approvedEdit: null,
        label: null,
      };
      const updated = await updateCalibrationSession(calib.id, {
        transcript: [...transcript, newTurn],
      });
      res.json({ session: updated, turn: newTurn });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Therapist labels / edits a calibration turn — writes a persona_example.
  app.post("/api/twin/calibration/:id/approve", requireProvider, async (req, res) => {
    try {
      const calib = await getCalibrationSession(req.params.id);
      if (!calib || calib.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Not found" });
      }
      const { turnIndex, label, approvedEdit, tags } = req.body as {
        turnIndex?: number;
        label?: CalibrationLabel;
        approvedEdit?: string;
        tags?: string[];
      };
      const transcript: CalibrationTurn[] = (calib.transcript as CalibrationTurn[] | null) ?? [];
      if (typeof turnIndex !== "number" || !transcript[turnIndex]) {
        return res.status(400).json({ error: "Invalid turnIndex" });
      }
      const turn = transcript[turnIndex];
      transcript[turnIndex] = {
        ...turn,
        label: label ?? null,
        approvedEdit: approvedEdit || turn.draft,
      };

      // Persist every label as persona_examples (positives active+indexed, negatives inactive).
      if (label) {
        const isPositive = label === "this_is_me" || label === "needs_edit";
        const finalApproved = isPositive ? (approvedEdit || turn.draft) : null;
        const embedding = isPositive && finalApproved
          ? await embed(`${turn.client}\n${finalApproved}`)
          : null;
        const labelTag = `label:${label}`;
        const userTags = Array.isArray(tags) ? tags : [];
        // Calibration is provider-wide (no engagement). Drop into the
        // provider's default playbook so the example is owned by something
        // and shows up in the editor; coach can move it later.
        const defaultPb = await getDefaultPlaybookForProvider(req.user!.id);
        await createPersonaExample(
          {
            providerId: req.user!.id,
            playbookId: defaultPb?.id ?? null,
            source: "calibration",
            label,
            scenario: turn.client,
            approvedResponse: finalApproved,
            rejectedResponse: isPositive
              ? (label === "needs_edit" ? turn.draft : null)
              : turn.draft,
            notes: null,
            tags: userTags.includes(labelTag) ? userTags : [...userTags, labelTag],
            weight: isPositive ? 1.0 : 0,
            isActive: isPositive,
          },
          embedding,
        );
        await snapshotAgentVersion({
          providerId: req.user!.id,
          reason: `calibration_approve:${label}`,
          createdBy: req.user!.id,
        });
      }

      // "Never say this" triggers a safety event so it shows in the audit log
      if (label === "never_say_this") {
        await logSafetyEvent({
          providerId: req.user!.id,
          stage: "review_label",
          decision: "block_with_template",
          severity: "high",
          reason: "calibration_never_say_this",
          classifierLabels: { source: "calibration", turnIndex },
          inputSnippet: turn.client?.slice(0, 500) ?? null,
          outputSnippet: turn.draft?.slice(0, 500) ?? null,
          templateUsed: null,
          agentVersionId: null,
          sessionId: null,
          engagementId: null,
          userId: req.user!.id,
        });
      }

      const updated = await updateCalibrationSession(calib.id, { transcript });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /**
   * POST /api/calibration/:id/correct — body: { turnIndex, approvedEdit?, tags? }
   * Always writes the corrected text as a "this_is_me" persona_example.
   */
  app.post("/api/calibration/:id/correct", requireProvider, async (req, res) => {
    try {
      const calib = await getCalibrationSession(req.params.id);
      if (!calib || calib.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Not found" });
      }
      const { turnIndex, approvedEdit, tags } = req.body as {
        turnIndex?: number;
        approvedEdit?: string;
        tags?: string[];
      };
      const transcript: CalibrationTurn[] =
        (calib.transcript as CalibrationTurn[] | null) ?? [];
      if (typeof turnIndex !== "number" || !transcript[turnIndex]) {
        return res.status(400).json({ error: "Invalid turnIndex" });
      }
      const turn = transcript[turnIndex];
      const finalText = (typeof approvedEdit === "string" && approvedEdit.length > 0)
        ? approvedEdit
        : turn.draft;

      transcript[turnIndex] = {
        ...turn,
        label: "this_is_me",
        approvedEdit: finalText,
      };

      const userTags = Array.isArray(tags) ? tags : [];
      const labelTag = "label:this_is_me";
      const embedding = await embed(`${turn.client}\n${finalText}`);
      const defaultPb = await getDefaultPlaybookForProvider(req.user!.id);
      await createPersonaExample(
        {
          providerId: req.user!.id,
          playbookId: defaultPb?.id ?? null,
          source: "calibration",
          label: "this_is_me",
          scenario: turn.client,
          approvedResponse: finalText,
          rejectedResponse: finalText !== turn.draft ? turn.draft : null,
          notes: null,
          tags: userTags.includes(labelTag) ? userTags : [...userTags, labelTag],
          weight: 1.0,
          isActive: true,
        },
        embedding,
      );
      await snapshotAgentVersion({
        providerId: req.user!.id,
        reason: "calibration_correct",
        createdBy: req.user!.id,
      });

      const updated = await updateCalibrationSession(calib.id, { transcript });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/twin/calibration/:id/complete", requireProvider, async (req, res) => {
    try {
      const calib = await getCalibrationSession(req.params.id);
      if (!calib || calib.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Not found" });
      }
      const updated = await updateCalibrationSession(calib.id, {
        status: "completed",
        completedAt: new Date(),
      });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Memory inspector (L3) ----
  app.get("/api/twin/memory/:engagementId", requireProvider, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, req.params.engagementId);
      if (!check.ok) return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      const rows = await listClientMemoryByEngagement(req.params.engagementId);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/twin/memory/:id", requireProvider, async (req, res) => {
    try {
      const mem = await getClientMemoryById(req.params.id);
      if (!mem) return res.status(404).json({ error: "Not found" });
      const ownerCheck = await assertProviderOwnsEngagement(req, mem.engagementId);
      if (!ownerCheck.ok) return res.status(ownerCheck.error === "Forbidden" ? 403 : 404).json({ error: ownerCheck.error });
      // Redaction is one-way; provider can't mutate forgotten rows.
      if (mem.redactedAt) return res.status(410).json({ error: "Memory entry already redacted" });
      await redactClientMemory(req.params.id, req.user!.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Edit a memory entry; recomputes embedding when content changes.
  app.patch("/api/twin/memory/:id", requireProvider, async (req, res) => {
    try {
      const mem = await getClientMemoryById(req.params.id);
      if (!mem) return res.status(404).json({ error: "Not found" });
      const ownerCheck = await assertProviderOwnsEngagement(req, mem.engagementId);
      if (!ownerCheck.ok) return res.status(ownerCheck.error === "Forbidden" ? 403 : 404).json({ error: ownerCheck.error });
      if (mem.redactedAt) return res.status(410).json({ error: "Memory entry already redacted" });
      const { content, tags, importance, kind } = req.body as {
        content?: string;
        tags?: string[];
        importance?: number;
        kind?: string;
      };
      const patch: Partial<{ kind: string; content: string; tags: string[]; importance: number }> = {};
      if (typeof content === "string" && content.trim().length > 0) patch.content = content.slice(0, 240);
      if (Array.isArray(tags)) patch.tags = tags.slice(0, 4).map(String);
      if (typeof importance === "number") patch.importance = Math.min(1, Math.max(0, importance));
      if (typeof kind === "string") patch.kind = kind;
      const newEmbedding = patch.content ? await embed(patch.content) : null;
      const updated = await updateClientMemory(req.params.id, patch, newEmbedding);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Safety event audit log (L1) ----
  // Provider-wide audit (used by AuditLog page).
  app.get("/api/twin/safety-events", requireProvider, async (req, res) => {
    try {
      const rows = await listSafetyEventsByProvider(req.user!.id, 200);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Per-client (engagement-scoped) audit log. Provider must own the engagement.
  app.get("/api/clients/:engagementId/safety-events", requireProvider, async (req, res) => {
    try {
      const ownerCheck = await assertProviderOwnsEngagement(req, req.params.engagementId);
      if (!ownerCheck.ok) {
        return res.status(ownerCheck.error === "Forbidden" ? 403 : 404).json({ error: ownerCheck.error });
      }
      const rows = await listSafetyEventsByEngagement(req.params.engagementId, 200);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Review queue (sample recent agent messages for therapist labeling) ----
  app.get("/api/twin/review-queue", requireProvider, async (req, res) => {
    try {
      const items = await listReviewQueueForProvider(req.user!.id, 20);
      res.json(items);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Therapist labels a sampled message: this_is_me / not_me / never_say_this / needs_edit.
  // Approved/edited samples are written to persona_examples (source: review_queue).
  // "never_say_this" also writes a safety_event so it surfaces in the audit log.
  app.post("/api/twin/review-queue/:messageId/label", requireProvider, async (req, res) => {
    try {
      const { messageId } = req.params;
      // Only label/approvedEdit/tags are trusted from the client; the rest
      // (draft, scenario, engagementId, sessionId) is loaded server-side.
      const VALID_LABELS = ["this_is_me", "not_me", "never_say_this", "needs_edit"] as const;
      type ReviewLabel = (typeof VALID_LABELS)[number];
      const { label, approvedEdit, tags } = req.body as {
        label?: string;
        approvedEdit?: string;
        tags?: string[];
      };
      if (!label || !(VALID_LABELS as readonly string[]).includes(label)) {
        return res.status(400).json({
          error: `label is required and must be one of: ${VALID_LABELS.join(", ")}`,
        });
      }
      const safeLabel = label as ReviewLabel;
      if (approvedEdit !== undefined && typeof approvedEdit !== "string") {
        return res.status(400).json({ error: "approvedEdit must be a string" });
      }
      if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))) {
        return res.status(400).json({ error: "tags must be an array of strings" });
      }

      const item = await getReviewItemForMessage(messageId);
      if (!item) {
        return res.status(404).json({ error: "Message not found" });
      }
      // Verify the provider owns the engagement this message came from.
      const ownerCheck = await assertProviderOwnsEngagement(req, item.engagementId);
      if (!ownerCheck.ok) {
        return res
          .status(ownerCheck.error === "Forbidden" ? 403 : 404)
          .json({ error: ownerCheck.error });
      }

      const draft = item.draft;
      const scenario = item.scenario;

      // Persist every label as persona_examples (positives active+indexed,
      // negatives inactive). never_say_this also writes a safety_event.
      const isPositive = safeLabel === "this_is_me" || safeLabel === "needs_edit";
      const finalApproved = isPositive ? (approvedEdit || draft) : null;
      const embedding = isPositive && finalApproved
        ? await embed(`${scenario}\n${finalApproved}`)
        : null;
      const labelTag = `label:${safeLabel}`;
      const userTags = Array.isArray(tags) ? tags : [];
      // Attribute the labeled example to the engagement's playbook (or the
      // provider's default if the engagement has none assigned). Keeps the
      // example surface-able from the same playbook the AI is actually
      // pulling from for that client.
      const reviewedEng = ownerCheck.engagement;
      const defaultPb = reviewedEng.playbookId ? null : await getDefaultPlaybookForProvider(req.user!.id);
      const reviewPlaybookId = reviewedEng.playbookId ?? defaultPb?.id ?? null;
      await createPersonaExample(
        {
          providerId: req.user!.id,
          playbookId: reviewPlaybookId,
          source: "review_queue",
          label: safeLabel,
          scenario: scenario || "(prior context unavailable)",
          approvedResponse: finalApproved,
          rejectedResponse: isPositive
            ? (safeLabel === "needs_edit" ? draft : null)
            : draft,
          notes: null,
          tags: userTags.includes(labelTag) ? userTags : [...userTags, labelTag],
          weight: isPositive ? 1.0 : 0,
          isActive: isPositive,
        },
        embedding,
      );
      await snapshotAgentVersion({
        providerId: req.user!.id,
        reason: `review_queue_label:${safeLabel}`,
        createdBy: req.user!.id,
      });

      if (safeLabel === "never_say_this") {
        await logSafetyEvent({
          providerId: req.user!.id,
          stage: "review_label",
          decision: "block_with_template",
          severity: "high",
          reason: "review_never_say_this",
          classifierLabels: { source: "review_queue", messageId },
          inputSnippet: scenario.slice(0, 500),
          outputSnippet: draft.slice(0, 500),
          templateUsed: null,
          agentVersionId: null,
          sessionId: item.sessionId,
          engagementId: item.engagementId,
          userId: req.user!.id,
        });
      }

      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ============================================================
  // MOOD CHECK-INS (seeker daily 1-5 + optional note)
  // ============================================================

  // Server-derived YYYY-MM-DD (UTC). Keeps "one per day" deterministic.
  function todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function shiftYmd(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }

  function clampDays(raw: unknown, def: number, max: number): number {
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(Math.floor(n), max);
  }

  // Seeker upserts today's mood entry.
  app.post("/api/mood/today", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const seeker = await storage.getSeekerByOwnerId(userId);
      if (!seeker) {
        return res.status(403).json({ error: "Only seekers can log mood entries" });
      }

      const bodySchema = z.object({
        score: z.number().int().min(1).max(5),
        note: z.string().max(280).optional().nullable(),
        engagementId: z.string().uuid().optional().nullable(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid mood entry", details: parsed.error.flatten() });
      }
      const { score, note, engagementId } = parsed.data;

      // If an engagement is provided, ensure this seeker actually owns it.
      let engagementIdToStore: string | null = null;
      if (engagementId) {
        const engagement = await storage.getEngagementById(engagementId);
        if (!engagement || engagement.seekerId !== seeker.id) {
          return res.status(403).json({ error: "Forbidden engagement" });
        }
        engagementIdToStore = engagement.id;
      } else {
        // Best-effort: attach the seeker's most recent active engagement so
        // their coach automatically sees the mood trend.
        const engagements = await storage.getEngagementsBySeekerId(seeker.id);
        const active = engagements.find((e) => (e.status ?? "active") === "active") ?? engagements[0];
        engagementIdToStore = active?.id ?? null;
      }

      const entry = await storage.upsertMoodEntry({
        seekerId: seeker.id,
        engagementId: engagementIdToStore,
        day: todayYmd(),
        score,
        note: note ?? null,
      });
      return res.json(entry);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Seeker reads their own recent mood history.
  app.get("/api/mood/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const seeker = await storage.getSeekerByOwnerId(userId);
      if (!seeker) {
        return res.json({ today: null, entries: [] });
      }
      const days = clampDays(req.query.days, 14, 90);
      // Inclusive window: shift back days-1 so days=14 yields a 14-day window.
      const sinceDay = shiftYmd(days - 1);
      const entries = await storage.getMoodEntriesBySeekerId(seeker.id, sinceDay);
      const today = todayYmd();
      const todayEntry = entries.find((e) => e.day === today) ?? null;
      return res.json({ today: todayEntry, entries });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Single rolled-up snapshot for the seeker progress view.
  // Returns sessions completed, daily check-in streak (forgiving), goals
  // checked off this week, and a 30-day mood series — in one call.
  app.get("/api/seeker/progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const moodWindowDays = clampDays(req.query.moodDays, 30, 90);
      const snapshot = await storage.getSeekerProgressSnapshot(userId, { moodWindowDays });
      return res.json(snapshot);
    } catch (error: any) {
      req.log.error({ err: error }, "Failed to load seeker progress snapshot");
      return res.status(500).json({ error: error.message });
    }
  });

  // Coach (or seeker on their own engagement) reads mood history for an engagement.
  app.get("/api/engagements/:id/mood", requireAuth, async (req: Request, res: Response) => {
    try {
      const engagementIdParam = String(req.params.id);
      const m = await assertEngagementMember(req, engagementIdParam);
      if (!m.ok) {
        return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      }
      const days = clampDays(req.query.days, 14, 90);
      const sinceDay = shiftYmd(days - 1);
      const entries = await storage.getMoodEntriesByEngagementId(engagementIdParam, sinceDay);
      const latest = entries.length > 0 ? entries[entries.length - 1] : null;
      return res.json({ latest, entries });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // REFLECTION JOURNAL (seeker entries + coach prompt library)
  // ============================================================

  const STARTER_PROMPTS: Array<{ text: string; category: string }> = [
    { text: "What's one thing that surprised you this week?", category: "weekly" },
    { text: "Describe a moment today when you felt fully present.", category: "daily" },
    { text: "What is one small step you can take tomorrow toward something that matters to you?", category: "daily" },
    { text: "What feeling has been hardest to sit with this week, and what does it want you to know?", category: "weekly" },
    { text: "Who or what are you grateful for right now, and why?", category: "general" },
    { text: "What's one thing you'd like to bring to your next session?", category: "session-prep" },
  ];

  let starterSeedAttempted = false;
  async function ensureStarterPromptsSeeded(): Promise<void> {
    if (starterSeedAttempted) return;
    starterSeedAttempted = true;
    try {
      // Always upsert — the partial unique index makes this a no-op when all
      // starters already exist, and recovers the missing ones from partial
      // states. Avoids the count==0 race that earlier versions had.
      await storage.seedGlobalStarterPrompts(STARTER_PROMPTS);
    } catch {
      // Best-effort; let the next request retry by clearing the flag.
      starterSeedAttempted = false;
    }
  }

  // ---- Coach prompt library ----

  // Coach lists their library (own + global starters).
  app.get("/api/journal/prompts", requireProvider, async (req: Request, res: Response) => {
    try {
      await ensureStarterPromptsSeeded();
      const includeArchived = req.query.includeArchived === "true";
      const prompts = await storage.listJournalPromptsForCoach(req.user!.id, includeArchived);
      return res.json(prompts);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Coach creates a prompt (optionally tied to a specific client engagement).
  app.post("/api/journal/prompts", requireProvider, async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        text: z.string().min(3).max(500),
        category: z.string().max(40).optional(),
        engagementId: z.string().uuid().optional().nullable(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prompt", details: parsed.error.flatten() });
      }
      const { text, category, engagementId } = parsed.data;

      // If client-specific, ensure this provider owns the engagement.
      if (engagementId) {
        const engagement = await storage.getEngagementById(engagementId);
        if (!engagement || engagement.providerId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden engagement" });
        }
      }

      const prompt = await storage.createJournalPrompt({
        providerId: req.user!.id,
        engagementId: engagementId ?? null,
        text,
        category: category ?? "general",
        isArchived: false,
      });
      return res.json(prompt);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Coach edits or archives one of their own prompts. Global starters are read-only.
  app.patch("/api/journal/prompts/:id", requireProvider, async (req: Request, res: Response) => {
    try {
      const promptId = String(req.params.id);
      const existing = await storage.getJournalPromptById(promptId);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (!existing.providerId || existing.providerId !== req.user!.id) {
        return res.status(403).json({ error: "Cannot modify this prompt" });
      }
      const bodySchema = z.object({
        text: z.string().min(3).max(500).optional(),
        category: z.string().max(40).optional(),
        engagementId: z.string().uuid().nullable().optional(),
        isArchived: z.boolean().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });
      }
      // If switching to a client-specific prompt, ensure ownership.
      if (parsed.data.engagementId) {
        const engagement = await storage.getEngagementById(parsed.data.engagementId);
        if (!engagement || engagement.providerId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden engagement" });
        }
      }
      const updated = await storage.updateJournalPrompt(promptId, parsed.data);
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ---- Seeker journal ----

  // Seeker lists prompts available to them (starters + their coach's library + assigned).
  app.get("/api/journal/prompts/available", requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureStarterPromptsSeeded();
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) {
        // Non-seekers (coaches without a seeker profile) just see the global starters.
        const starters = await storage.listAvailableJournalPromptsForSeeker(null, null);
        return res.json(starters);
      }
      const engagements = await storage.getEngagementsBySeekerId(seeker.id);
      const active = engagements.find((e) => (e.status ?? "active") === "active") ?? engagements[0];
      const prompts = await storage.listAvailableJournalPromptsForSeeker(
        active?.providerId ?? null,
        active?.id ?? null,
      );
      return res.json(prompts);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Seeker reads their own journal entries (private + shared).
  app.get("/api/journal/entries/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) return res.json([]);
      const entries = await storage.listJournalEntriesBySeekerId(seeker.id);
      return res.json(entries);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Seeker creates a new entry. Optionally seeded by a prompt and shared with the coach.
  app.post("/api/journal/entries", requireAuth, async (req: Request, res: Response) => {
    try {
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) {
        return res.status(403).json({ error: "Only seekers can write journal entries" });
      }
      const bodySchema = z.object({
        body: z.string().min(1).max(10000),
        promptId: z.string().uuid().optional().nullable(),
        engagementId: z.string().uuid().optional().nullable(),
        sharedWithCoach: z.boolean().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
      }
      const { body, promptId, engagementId, sharedWithCoach } = parsed.data;

      // Resolve engagement: explicit id (must belong to seeker) or auto-attach active.
      let engagementIdToStore: string | null = null;
      let providerIdForPromptCheck: string | null = null;
      if (engagementId) {
        const engagement = await storage.getEngagementById(engagementId);
        if (!engagement || engagement.seekerId !== seeker.id) {
          return res.status(403).json({ error: "Forbidden engagement" });
        }
        engagementIdToStore = engagement.id;
        providerIdForPromptCheck = engagement.providerId;
      } else {
        const seekerEngagements = await storage.getEngagementsBySeekerId(seeker.id);
        const active = seekerEngagements.find((e) => (e.status ?? "active") === "active") ?? seekerEngagements[0];
        engagementIdToStore = active?.id ?? null;
        providerIdForPromptCheck = active?.providerId ?? null;
      }

      // If a prompt is referenced, ensure it's actually available to this seeker
      // (global starter, their coach's library, or assigned to their engagement).
      if (promptId) {
        const available = await storage.listAvailableJournalPromptsForSeeker(
          providerIdForPromptCheck,
          engagementIdToStore,
        );
        if (!available.some((p) => p.id === promptId)) {
          return res.status(403).json({ error: "Prompt not available to you" });
        }
      }

      const entry = await storage.createJournalEntry({
        seekerId: seeker.id,
        engagementId: engagementIdToStore,
        promptId: promptId ?? null,
        body,
        sharedWithCoach: !!sharedWithCoach,
      });
      return res.json(entry);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Seeker updates an entry: edit body or toggle share. Once shared, body is locked.
  app.patch("/api/journal/entries/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const entryId = String(req.params.id);
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) return res.status(403).json({ error: "Forbidden" });
      const existing = await storage.getJournalEntryById(entryId);
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.seekerId !== seeker.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const bodySchema = z.object({
        body: z.string().min(1).max(10000).optional(),
        sharedWithCoach: z.boolean().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });
      }
      const { body, sharedWithCoach } = parsed.data;

      // Once shared, body is immutable and sharing cannot be revoked.
      if (existing.sharedWithCoach) {
        if (typeof body === "string" && body !== existing.body) {
          return res.status(409).json({ error: "Entry is already shared and cannot be edited" });
        }
        if (sharedWithCoach === false) {
          return res.status(409).json({ error: "Sharing cannot be revoked" });
        }
      }

      const patch: Partial<{ body: string; sharedWithCoach: boolean; sharedAt: Date | null }> = {};
      if (typeof body === "string") patch.body = body;
      if (sharedWithCoach === true && !existing.sharedWithCoach) {
        patch.sharedWithCoach = true;
        patch.sharedAt = new Date();
      }
      const updated = await storage.updateJournalEntry(entryId, patch);
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Coach (or seeker on their own engagement) reads shared journal entries.
  app.get("/api/engagements/:id/journal", requireAuth, async (req: Request, res: Response) => {
    try {
      const engagementIdParam = String(req.params.id);
      const m = await assertEngagementMember(req, engagementIdParam);
      if (!m.ok) {
        return res.status(m.error === "Forbidden" ? 403 : 404).json({ error: m.error });
      }
      const entries = await storage.listSharedJournalEntriesByEngagementId(engagementIdParam);
      return res.json(entries);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Daily inter-session AI micro-nudges
  // ============================================================
  // Lazy-generated on first GET per day so we don't need a cron. The mobile
  // app polls `/api/nudges/today` when the home tab opens; the response is
  // either today's nudge (existing or freshly composed) or null when nudges
  // are suppressed (active high-severity safety event in the last 24h, or
  // the seeker has no engagement yet).

  app.get("/api/nudges/today", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      // Only seekers receive nudges. Providers/coaches get null silently.
      const seeker = await storage.getSeekerByOwnerId(userId);
      if (!seeker) {
        return res.json({ nudge: null });
      }
      const { generateOrFetchTodaysNudge } = await import("../services/nudges");
      const nudge = await generateOrFetchTodaysNudge(userId);
      return res.json({ nudge });
    } catch (error: any) {
      req.log.error({ err: error }, "GET /api/nudges/today failed");
      return res.status(500).json({ error: error.message });
    }
  });

  // Seeker-only nudge preferences (on/off + local hour-of-day window).
  // GET creates an implicit defaults-row response so the mobile app can
  // render the toggle without requiring a prior write.
  app.get("/api/seeker/nudge-prefs", requireAuth, async (req: Request, res: Response) => {
    try {
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) return res.status(403).json({ error: "Seekers only" });
      const { getNudgePrefs, DEFAULT_NUDGE_PREFS } = await import("../services/nudgeStorage");
      const prefs = await getNudgePrefs(req.user!.id);
      return res.json(prefs ?? { userId: req.user!.id, ...DEFAULT_NUDGE_PREFS });
    } catch (error: any) {
      req.log.error({ err: error }, "GET /api/seeker/nudge-prefs failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/seeker/nudge-prefs", requireAuth, async (req: Request, res: Response) => {
    try {
      const seeker = await storage.getSeekerByOwnerId(req.user!.id);
      if (!seeker) return res.status(403).json({ error: "Seekers only" });
      const schema = z.object({
        enabled: z.boolean().optional(),
        windowStartHour: z.number().int().min(0).max(23).optional(),
        windowEndHour: z.number().int().min(0).max(23).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid prefs", details: parsed.error.flatten() });
      }
      const { upsertNudgePrefs } = await import("../services/nudgeStorage");
      const updated = await upsertNudgePrefs(req.user!.id, parsed.data);
      return res.json(updated);
    } catch (error: any) {
      req.log.error({ err: error }, "PATCH /api/seeker/nudge-prefs failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/nudges/:id/respond", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const idParam = String(req.params.id);

      const bodySchema = z.object({
        action: z.enum(["done", "skip", "snooze"]),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid action", details: parsed.error.flatten() });
      }

      const { getNudgeById, respondToNudge } = await import("../services/nudgeStorage");
      const existing = await getNudgeById(idParam);
      if (!existing) {
        return res.status(404).json({ error: "Nudge not found" });
      }
      // Authz: only the owning seeker can respond to their own nudge.
      if (existing.seekerUserId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updated = await respondToNudge(idParam, parsed.data.action);
      return res.json({ nudge: updated });
    } catch (error: any) {
      req.log.error({ err: error }, "POST /api/nudges/:id/respond failed");
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Session prep briefs (Task #17)
  // Coach reads an AI-composed brief before a session. Briefs are
  // saved (not regenerated per view); the coach hits "Generate" to
  // refresh, and "Mark used in session" once they've worked from it.
  // All routes are coach-only — even the GETs — because briefs may
  // surface clinical synthesis that isn't appropriate for the seeker.
  // ============================================================
  app.post("/api/engagements/:id/briefs/generate", requireProvider, async (req, res) => {
    try {
      const engagementId = String(req.params.id);
      const auth = await assertProviderOwnsEngagement(req, engagementId);
      if (!auth.ok) {
        return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      }
      const result = await generateAndSaveBriefForEngagement({
        engagementId,
        providerId: req.user!.id,
      });
      if ("error" in result) {
        return res.status(500).json({ error: result.error });
      }
      return res.json({ brief: result.brief });
    } catch (error: any) {
      req.log.error({ err: error }, "POST /api/engagements/:id/briefs/generate failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/briefs/latest", requireProvider, async (req, res) => {
    try {
      const engagementId = String(req.params.id);
      const auth = await assertProviderOwnsEngagement(req, engagementId);
      if (!auth.ok) {
        return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      }
      const brief = await getLatestSessionBriefForEngagement(engagementId);
      return res.json({ brief: brief ?? null });
    } catch (error: any) {
      req.log.error({ err: error }, "GET /api/engagements/:id/briefs/latest failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/briefs", requireProvider, async (req, res) => {
    try {
      const engagementId = String(req.params.id);
      const auth = await assertProviderOwnsEngagement(req, engagementId);
      if (!auth.ok) {
        return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      }
      const briefs = await listSessionBriefsForEngagement(engagementId);
      return res.json({ briefs });
    } catch (error: any) {
      req.log.error({ err: error }, "GET /api/engagements/:id/briefs failed");
      return res.status(500).json({ error: error.message });
    }
  });

  const markBriefUsedSchema = z.object({
    sessionId: z.string().uuid().optional().nullable(),
  });

  app.post("/api/briefs/:id/used", requireProvider, async (req, res) => {
    try {
      const briefId = String(req.params.id);
      const existing = await getSessionBriefById(briefId);
      if (!existing) return res.status(404).json({ error: "Brief not found" });
      // Authz: must be the provider who owns the brief's engagement.
      const auth = await assertProviderOwnsEngagement(req, existing.engagementId);
      if (!auth.ok) {
        return res.status(auth.error === "Forbidden" ? 403 : 404).json({ error: auth.error });
      }
      const parsed = markBriefUsedSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      }
      // If a sessionId is supplied, sanity-check it belongs to this engagement
      // so callers can't tag a brief with a session from another client.
      if (parsed.data.sessionId) {
        const session = await storage.getSessionById(parsed.data.sessionId);
        if (!session || session.engagementId !== existing.engagementId) {
          return res.status(400).json({ error: "Session does not belong to this engagement" });
        }
      }
      const result = await markSessionBriefUsed(briefId, {
        sessionId: parsed.data.sessionId ?? null,
      });
      if ("error" in result) {
        if (result.error === "already_used") {
          // Idempotent: return the existing used brief rather than 409 so
          // the UI can refresh state without special-casing the race.
          const refreshed = await getSessionBriefById(briefId);
          return res.json({ brief: refreshed, alreadyUsed: true });
        }
        return res.status(404).json({ error: result.error });
      }
      return res.json({ brief: result.brief });
    } catch (error: any) {
      req.log.error({ err: error }, "POST /api/briefs/:id/used failed");
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // USER TIMEZONE
  // ============================================================
  // Clients call this on login / app start with their detected IANA zone
  // (Intl.DateTimeFormat().resolvedOptions().timeZone) so we can render
  // calendar invites and 1-hour reminders in the seeker's local time
  // even when the request that triggers the email comes from the coach.
  app.patch("/api/user/timezone", requireAuth, async (req, res) => {
    try {
      const { timezone } = req.body as { timezone?: unknown };
      if (typeof timezone !== "string" || timezone.length === 0 || timezone.length > 64) {
        return res.status(400).json({ error: "timezone (string) is required" });
      }
      // Validate against ICU's tz database before persisting so we never
      // store garbage that would later blow up Intl.DateTimeFormat.
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      } catch {
        return res.status(400).json({ error: "Invalid IANA time zone" });
      }
      const user = await storage.updateUserTimezone(req.user!.id, timezone);
      return res.json({ timezone: user?.timezone ?? timezone });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // SCHEDULED SESSIONS — Task #18 (calendar invites)
  // ============================================================
  // Coach proposes 1–3 candidate slots; seeker confirms one; either side
  // may reschedule (replaces the slots) or cancel (with a reason). On
  // confirm/reschedule/cancel we email a real .ics to both parties so
  // the event lands in their existing calendar app — no two-way sync.

  function parseSlots(input: unknown): { ok: true; slots: string[] } | { ok: false; error: string } {
    if (!Array.isArray(input)) return { ok: false, error: "proposedSlots must be an array" };
    if (input.length < 1 || input.length > 3) {
      return { ok: false, error: "proposedSlots must contain 1–3 slots" };
    }
    const out: string[] = [];
    for (const raw of input) {
      if (typeof raw !== "string") return { ok: false, error: "slots must be ISO strings" };
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: `invalid slot: ${raw}` };
      }
      if (d.getTime() < Date.now() - 60_000) {
        return { ok: false, error: "slots must be in the future" };
      }
      out.push(d.toISOString());
    }
    return { ok: true, slots: out };
  }

  app.post("/api/engagements/:id/scheduled-sessions", requireAuth, async (req, res) => {
    try {
      const check = await assertProviderOwnsEngagement(req, String(req.params.id));
      if (!check.ok) {
        return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      }
      const { engagement } = check;
      if (!engagement.seekerId) {
        return res.status(400).json({ error: "Engagement has no seeker" });
      }
      const seeker = await storage.getSeekerById(engagement.seekerId);
      if (!seeker?.ownerId) {
        return res.status(400).json({ error: "Engagement seeker has no owner" });
      }
      const body = req.body as {
        proposedSlots?: unknown;
        timezone?: unknown;
        durationMinutes?: unknown;
        title?: unknown;
      };
      const slots = parseSlots(body.proposedSlots);
      if (!slots.ok) return res.status(400).json({ error: slots.error });
      const tz = typeof body.timezone === "string" ? body.timezone : "UTC";
      const dur =
        typeof body.durationMinutes === "number" && body.durationMinutes >= 5 && body.durationMinutes <= 480
          ? Math.round(body.durationMinutes)
          : 50;
      const title = typeof body.title === "string" ? body.title.slice(0, 200) : "Therapy session";
      const { proposeSlots } = await import("../services/scheduling");
      const row = await proposeSlots({
        engagementId: engagement.id,
        providerId: req.user!.id,
        seekerUserId: seeker.ownerId,
        proposedSlots: slots.slots,
        timezone: tz,
        durationMinutes: dur,
        title,
        createdBy: req.user!.id,
      });
      return res.json({ scheduledSession: row });
    } catch (error: any) {
      req.log.warn({ err: error }, "POST /api/engagements/:id/scheduled-sessions failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/engagements/:id/scheduled-sessions", requireAuth, async (req, res) => {
    try {
      const check = await assertEngagementMember(req, String(req.params.id));
      if (!check.ok) {
        return res.status(check.error === "Forbidden" ? 403 : 404).json({ error: check.error });
      }
      const { scheduledSessionStorage } = await import("../services/scheduledSessionStorage");
      const rows = await scheduledSessionStorage.listForEngagement(check.engagement.id);
      return res.json({ scheduledSessions: rows });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/me/scheduled-sessions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { scheduledSessionStorage } = await import("../services/scheduledSessionStorage");
      const { maybeFireReminderForSeeker } = await import("../services/scheduling");
      // Fire-and-forget reminder check for seekers (no-op for coaches —
      // they don't have rows where seekerUserId === their id).
      void maybeFireReminderForSeeker(userId).catch(() => {});
      const rows = await scheduledSessionStorage.listUpcomingForUser(userId);
      return res.json({ scheduledSessions: rows });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scheduled-sessions/:id/confirm", requireAuth, async (req, res) => {
    try {
      const { scheduledSessionStorage } = await import("../services/scheduledSessionStorage");
      const { confirmSlot } = await import("../services/scheduling");
      const row = await scheduledSessionStorage.getById(String(req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      // Only the seeker can confirm; coaches use reschedule if they need
      // to change things post-proposal.
      if (row.seekerUserId !== req.user!.id) {
        return res.status(403).json({ error: "Only the seeker can confirm a slot" });
      }
      // Strict state-machine guard: confirm only legal from `proposed`.
      // Re-confirming an already-confirmed row would mutate confirmedAt
      // without a reschedule transition and silently bump icsSeq, so
      // we reject it here. Users who need to change time should use
      // the reschedule endpoint.
      if (row.status !== "proposed") {
        return res
          .status(409)
          .json({ error: `Cannot confirm — session is ${row.status}` });
      }
      const body = req.body as { slot?: unknown; timezone?: unknown };
      if (typeof body.slot !== "string") {
        return res.status(400).json({ error: "slot (ISO string) is required" });
      }
      const chosen = new Date(body.slot);
      if (Number.isNaN(chosen.getTime())) {
        return res.status(400).json({ error: "invalid slot" });
      }
      // Reject confirmation of a slot that has already passed.
      // Without this guard, a stale proposal whose times all aged
      // out could still be confirmed and create a "confirmed"
      // session in the past — visible as upcoming in every UI.
      // Server-side enforcement is required because the seeker's
      // client clock cannot be trusted.
      if (chosen.getTime() <= Date.now()) {
        return res.status(409).json({
          error:
            "That time has already passed. Ask your coach to propose new times.",
        });
      }
      const slotIso = chosen.toISOString();
      const proposedIso = ((row.proposedSlots ?? []) as unknown[]).map((s) => {
        try {
          return new Date(String(s)).toISOString();
        } catch {
          return "";
        }
      });
      if (!proposedIso.includes(slotIso)) {
        return res.status(400).json({ error: "slot is not one of the proposed times" });
      }
      // Capture seeker's reported timezone for any future re-render of
      // this row (coach proposed in their tz; seeker's own tz lives on
      // the user record — we update it lazily here).
      if (typeof body.timezone === "string" && body.timezone.length > 0 && body.timezone.length < 64) {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
          await storage.updateUserTimezone(req.user!.id, body.timezone);
        } catch {
          // ignore invalid zones from the client
        }
      }
      // Pre-confirm billing gate. Fails closed: any error here surfaces
      // as 500 rather than silently allowing an unbilled booking.
      {
        const { billingStorage } = await import("../services/billingStorage");
        const eb = await billingStorage.getEngagementBilling(row.engagementId);
        if (eb?.status === "past_due" || eb?.status === "incomplete") {
          return res.status(402).json({
            error:
              "Payment needs attention. Please add or update your payment method on the Payment tab before booking new sessions.",
          });
        }
        if (!eb?.tierId) {
          const tiers = await billingStorage.listTiersForProvider(row.providerId, { activeOnly: true });
          if (tiers.length > 0) {
            return res.status(402).json({
              error:
                "Please choose a payment tier on the Payment tab before booking sessions.",
            });
          }
        } else {
          // Tier is selected — require a saved card before booking so
          // per-session charges (and the first monthly invoice) can't
          // produce a confirmed-but-unpaid session.
          const tier = await billingStorage.getTierById(eb.tierId);
          if (tier && !eb.stripePaymentMethodId) {
            return res.status(402).json({
              error:
                "Please add a payment method on the Payment tab before booking sessions.",
            });
          }
        }
      }
      const updated = await confirmSlot(row.id, chosen);
      // confirmSlot returns undefined when the atomic update missed
      // because someone else confirmed first.
      if (!updated) {
        // Atomic update missed — could be another concurrent confirm,
        // a reschedule that swapped proposed slots, or a cancel.
        return res.status(409).json({
          error:
            "Could not confirm — the session may have been rescheduled, cancelled, or just confirmed by someone else. Please refresh.",
        });
      }
      // Per-session charge fires after the atomic confirm. Failures
      // flip engagement → past_due (blocking the next confirm) and
      // surface as a billingWarning; the booked session is not rolled
      // back — the seeker resolves payment async on the Payment tab.
      let billingWarning: string | null = null;
      try {
        const { chargePerSession } = await import("../services/billing");
        const out = await chargePerSession({
          engagementId: row.engagementId,
          seekerUserId: row.seekerUserId,
          providerId: row.providerId,
          scheduledSessionId: row.id,
        });
        if (!out.ok) {
          const k = out.error.kind;
          // Surface every billing failure to the seeker; chargePerSession
          // already flips the engagement to past_due so the next confirm
          // is blocked until the issue is fixed.
          if (k !== "not_configured") {
            billingWarning =
              k === "account_incomplete"
                ? "Coach hasn't finished Stripe onboarding — payment will be retried later."
                : k === "stripe_error"
                  ? `Payment failed: ${out.error.message}. Please update your card on the Payment tab.`
                  : "Payment failed. Please check the Payment tab.";
            req.log.warn({ kind: k, id: row.id }, "billing: per-session charge unsuccessful");
          }
        }
      } catch (chargeErr: any) {
        req.log.warn(
          { err: chargeErr?.message ?? String(chargeErr), id: row.id },
          "billing: per-session charge errored after confirm",
        );
        billingWarning = "Payment couldn't be processed — please check your Payment tab.";
      }
      return res.json({ scheduledSession: updated, billingWarning });
    } catch (error: any) {
      req.log.warn({ err: error }, "POST /api/scheduled-sessions/:id/confirm failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scheduled-sessions/:id/reschedule", requireAuth, async (req, res) => {
    try {
      const { scheduledSessionStorage } = await import("../services/scheduledSessionStorage");
      const { rescheduleSession } = await import("../services/scheduling");
      const row = await scheduledSessionStorage.getById(String(req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const isCoach = row.providerId === req.user!.id;
      const isSeeker = row.seekerUserId === req.user!.id;
      if (!isCoach && !isSeeker) return res.status(403).json({ error: "Forbidden" });
      if (row.status === "cancelled") {
        return res.status(409).json({ error: "Session is cancelled" });
      }
      const body = req.body as {
        proposedSlots?: unknown;
        timezone?: unknown;
        durationMinutes?: unknown;
        title?: unknown;
      };
      const slots = parseSlots(body.proposedSlots);
      if (!slots.ok) return res.status(400).json({ error: slots.error });
      const updated = await rescheduleSession(row.id, {
        proposedSlots: slots.slots,
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        durationMinutes:
          typeof body.durationMinutes === "number" && body.durationMinutes >= 5 && body.durationMinutes <= 480
            ? Math.round(body.durationMinutes)
            : undefined,
        title: typeof body.title === "string" ? body.title.slice(0, 200) : undefined,
      });
      return res.json({ scheduledSession: updated });
    } catch (error: any) {
      req.log.warn({ err: error }, "POST /api/scheduled-sessions/:id/reschedule failed");
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scheduled-sessions/:id/cancel", requireAuth, async (req, res) => {
    try {
      const { scheduledSessionStorage } = await import("../services/scheduledSessionStorage");
      const { cancelSession } = await import("../services/scheduling");
      const row = await scheduledSessionStorage.getById(String(req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      const isCoach = row.providerId === req.user!.id;
      const isSeeker = row.seekerUserId === req.user!.id;
      if (!isCoach && !isSeeker) return res.status(403).json({ error: "Forbidden" });
      if (row.status === "cancelled") {
        return res.json({ scheduledSession: row });
      }
      const body = req.body as { reason?: unknown };
      const reason =
        typeof body.reason === "string" && body.reason.trim().length > 0
          ? body.reason.trim().slice(0, 500)
          : "No reason provided";
      const updated = await cancelSession(row.id, req.user!.id, reason);
      return res.json({ scheduledSession: updated });
    } catch (error: any) {
      req.log.warn({ err: error }, "POST /api/scheduled-sessions/:id/cancel failed");
      return res.status(500).json({ error: error.message });
    }
  });
}
