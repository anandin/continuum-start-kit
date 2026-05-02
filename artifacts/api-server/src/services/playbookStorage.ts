import { db } from "../db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import {
  playbooks,
  personaExamples,
  type InsertPlaybook,
  type Playbook,
  type PersonaExample,
} from "@workspace/db";
import { embed } from "../lib/llm";
import { logger } from "../lib/logger";

// ============================================================
// Coach playbooks (L2) — named bundles of persona_examples that
// drive the AI's tone for a recurring situation. Each engagement
// can be assigned a playbook; otherwise the provider's default
// playbook is used (and if none is set, all provider examples).
// ============================================================

export async function listPlaybooksByProvider(
  providerId: string,
  opts?: { includeArchived?: boolean },
): Promise<Playbook[]> {
  const includeArchived = opts?.includeArchived ?? false;
  const where = includeArchived
    ? eq(playbooks.providerId, providerId)
    : and(eq(playbooks.providerId, providerId), eq(playbooks.isArchived, false));
  return db.select().from(playbooks).where(where).orderBy(desc(playbooks.isDefault), desc(playbooks.createdAt));
}

export async function getPlaybookById(id: string): Promise<Playbook | undefined> {
  const [row] = await db.select().from(playbooks).where(eq(playbooks.id, id)).limit(1);
  return row;
}

export async function getDefaultPlaybookForProvider(providerId: string): Promise<Playbook | undefined> {
  const [row] = await db
    .select()
    .from(playbooks)
    .where(and(
      eq(playbooks.providerId, providerId),
      eq(playbooks.isDefault, true),
      eq(playbooks.isArchived, false),
    ))
    .limit(1);
  return row;
}

export async function createPlaybook(data: InsertPlaybook): Promise<Playbook> {
  // If this is being created as the default, demote any existing default first
  // so the "exactly one default" invariant holds.
  return db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx.update(playbooks)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(playbooks.providerId, data.providerId), eq(playbooks.isDefault, true)));
    }
    const [row] = await tx.insert(playbooks).values(data).returning();
    return row;
  });
}

export async function updatePlaybook(
  id: string,
  patch: Partial<{ title: string; description: string | null; isArchived: boolean }>,
): Promise<Playbook | undefined> {
  const [row] = await db.update(playbooks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(playbooks.id, id))
    .returning();
  return row;
}

// Promote a playbook to default in one transaction so two playbooks can never
// both hold isDefault=true.
export async function setDefaultPlaybook(providerId: string, playbookId: string): Promise<Playbook | undefined> {
  return db.transaction(async (tx) => {
    await tx.update(playbooks)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(playbooks.providerId, providerId), eq(playbooks.isDefault, true)));
    const [row] = await tx.update(playbooks)
      .set({ isDefault: true, isArchived: false, updatedAt: new Date() })
      .where(and(eq(playbooks.id, playbookId), eq(playbooks.providerId, providerId)))
      .returning();
    return row;
  });
}

// Clone a playbook + every active persona_example inside it. The new playbook
// is never default and never archived. Returns the new playbook.
export async function duplicatePlaybook(
  providerId: string,
  sourceId: string,
  newTitle: string,
): Promise<Playbook | undefined> {
  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(playbooks).where(eq(playbooks.id, sourceId)).limit(1);
    if (!source || source.providerId !== providerId) return undefined;
    const [created] = await tx.insert(playbooks).values({
      providerId,
      title: newTitle,
      description: source.description,
      isDefault: false,
      isArchived: false,
    }).returning();
    // Copy active examples; embeddings are reused via raw SQL so we don't have
    // to re-embed (and so vector retrieval keeps working immediately).
    await tx.execute(sql`
      INSERT INTO ${personaExamples}
        (provider_id, playbook_id, source, label, scenario, approved_response,
         rejected_response, notes, tags, weight, embedding, is_active)
      SELECT provider_id, ${created.id}, source, label, scenario, approved_response,
             rejected_response, notes, tags, weight, embedding, is_active
      FROM ${personaExamples}
      WHERE playbook_id = ${sourceId} AND is_active = true
    `);
    return created;
  });
}

// Persona example listing scoped to a playbook (or unscoped legacy rows when
// playbookId is null). Used by both the Playbooks UI and the persona compiler.
export async function listPersonaExamplesForPlaybook(
  providerId: string,
  playbookId: string | null,
): Promise<PersonaExample[]> {
  const where = playbookId
    ? and(
      eq(personaExamples.providerId, providerId),
      eq(personaExamples.isActive, true),
      eq(personaExamples.playbookId, playbookId),
    )
    : and(
      eq(personaExamples.providerId, providerId),
      eq(personaExamples.isActive, true),
      isNull(personaExamples.playbookId),
    );
  return db.select().from(personaExamples).where(where).orderBy(desc(personaExamples.createdAt));
}

// ============================================================
// Starter playbook seed library
// ============================================================

interface StarterPlaybook {
  title: string;
  description: string;
  examples: Array<{
    scenario: string;
    approvedResponse: string;
    notes: string | null;
    tags: string[];
  }>;
}

const STARTER_PLAYBOOKS: StarterPlaybook[] = [
  {
    title: "First session — intake & welcome",
    description: "Warm onboarding for a brand-new client. Sets expectations, normalizes nervousness, invites them to share at their own pace.",
    examples: [
      {
        scenario: "I'm not really sure what to talk about. This is my first time.",
        approvedResponse: "That's a completely normal place to start. There's no right thing to bring in — sometimes it's easiest to just describe what your week has felt like, even in a few words. We can take it from there together.",
        notes: "Lead with normalization, then offer a low-stakes opening.",
        tags: ["intake", "welcome", "first-session"],
      },
      {
        scenario: "I don't know if therapy is going to help me.",
        approvedResponse: "It's fair to wonder. A lot of people show up unsure — and that uncertainty itself can be useful information. What would feel like a small sign, even a few weeks in, that this is worth your time?",
        notes: "Validate the doubt; turn it into a concrete success criterion.",
        tags: ["intake", "ambivalence"],
      },
    ],
  },
  {
    title: "Weekly check-in",
    description: "For ongoing clients dropping in between sessions. Keeps it grounded, returns to working themes, leaves room for them to lead.",
    examples: [
      {
        scenario: "Nothing major happened this week, just the usual stuff.",
        approvedResponse: "The 'usual stuff' is often where the most useful patterns live. What part of the week is sitting with you most right now — even if it feels small?",
        notes: "Don't accept 'nothing' — gently surface the texture of the week.",
        tags: ["check-in", "weekly"],
      },
      {
        scenario: "I've been doing okay, I think.",
        approvedResponse: "I hear the 'I think' in there. What would have to be true for you to feel sure?",
        notes: "Notice the hedge; invite them to interrogate it.",
        tags: ["check-in", "reflection"],
      },
    ],
  },
  {
    title: "Harm reduction & crisis-adjacent",
    description: "For clients sharing risky behaviors or moments of crisis. Stays calm, never lectures, prioritizes connection and safety planning over judgment.",
    examples: [
      {
        scenario: "I drank way more than I meant to last night.",
        approvedResponse: "Thank you for telling me. That takes some honesty. Before we get into what happened — how are you feeling right now, in your body and in your head?",
        notes: "Reward the disclosure, ground in the present, then explore.",
        tags: ["harm-reduction", "substance"],
      },
      {
        scenario: "I had a really dark night and I'm scared of myself.",
        approvedResponse: "I'm really glad you're telling me this. You're not in trouble for having that night — and you're not alone with it now. Are you safe at this moment? And if things tipped further, who is the first person you'd reach for?",
        notes: "Never moralize. Always check current safety + name a support contact.",
        tags: ["crisis", "safety-plan"],
      },
    ],
  },
  {
    title: "Celebrating progress",
    description: "For clients reporting a win, a breakthrough, or a streak. Reflects it back specifically, lets them own the credit, anchors what made it work.",
    examples: [
      {
        scenario: "I actually went to the party and I didn't leave early!",
        approvedResponse: "That's huge — and it's not nothing. What was different this time about how you talked to yourself before going in?",
        notes: "Name the win specifically, then surface the mechanism so they can repeat it.",
        tags: ["celebration", "progress"],
      },
      {
        scenario: "I had my first full week without a panic attack in months.",
        approvedResponse: "A full week. I want to make sure that lands — months of carrying that, and this week was different. What do you think you did, even quietly, that helped?",
        notes: "Slow down so the win actually registers. Then credit them.",
        tags: ["celebration", "anxiety", "milestone"],
      },
    ],
  },
];

// Seed the 4 starter playbooks for a provider that has zero. Idempotent: only
// runs if the provider currently has no playbooks at all (archived included
// in the count so re-seeding doesn't happen after they've cleaned up).
export async function seedStarterPlaybooksIfEmpty(providerId: string): Promise<Playbook[]> {
  const existing = await db.select({ id: playbooks.id }).from(playbooks).where(eq(playbooks.providerId, providerId)).limit(1);
  if (existing.length > 0) return [];

  // Pre-compute embeddings BEFORE opening any transaction. Vector search
  // requires `embedding IS NOT NULL`; without these, the seeded examples
  // would never surface in persona compilation.
  const embeddedExamples = await Promise.all(
    STARTER_PLAYBOOKS.map(async (sp) => ({
      sp,
      examples: await Promise.all(
        sp.examples.map(async (ex) => ({
          ex,
          embedding: await embed(`${ex.scenario}\n${ex.approvedResponse}`).catch((err) => {
            logger.warn({ err, scenario: ex.scenario.slice(0, 60) }, "starter example embed failed; will fall back to lexical retrieval");
            return null;
          }),
        })),
      ),
    })),
  );

  const created: Playbook[] = [];
  for (let i = 0; i < embeddedExamples.length; i++) {
    const { sp, examples } = embeddedExamples[i];
    const playbook = await db.transaction(async (tx) => {
      const [pb] = await tx.insert(playbooks).values({
        providerId,
        title: sp.title,
        description: sp.description,
        // Pin the first starter ("First session — intake & welcome") as default.
        isDefault: i === 0,
        isArchived: false,
      }).returning();
      for (const { ex, embedding } of examples) {
        const base = {
          providerId,
          playbookId: pb.id,
          source: "manual" as const,
          scenario: ex.scenario,
          approvedResponse: ex.approvedResponse,
          notes: ex.notes,
          tags: ex.tags,
          weight: 1.0,
          isActive: true,
        };
        await tx.insert(personaExamples).values(embedding ? { ...base, embedding } : base);
      }
      return pb;
    });
    created.push(playbook);
  }
  return created;
}
