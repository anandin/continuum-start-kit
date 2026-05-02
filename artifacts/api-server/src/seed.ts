import { db } from "./db";
import { users, profiles, userRoles, seekers, providerConfigs, providerAgentConfigs, engagements } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();

async function seed() {
  console.log("🌱 Seeding database with test accounts...\n");

  const passwordHash = await bcrypt.hash("test1234", 10);

  // Create Provider account
  console.log("Creating provider account...");
  
  let provider = await db.select().from(users).where(eq(users.email, "coach@haven.test")).then(r => r[0]);
  
  if (!provider) {
    const providerId = uuidv4();
    [provider] = await db.insert(users).values({
      id: providerId,
      email: "coach@haven.test",
      password: passwordHash,
    }).returning();

    await db.insert(profiles).values({
      id: uuidv4(),
      userId: provider.id,
      email: "coach@haven.test",
    });

    await db.insert(userRoles).values({
      userId: provider.id,
      role: "provider",
    });

    // Provider configuration
    await db.insert(providerConfigs).values({
      id: uuidv4(),
      providerId: provider.id,
      title: "Life Transformation Coaching",
      methodology: "I use a holistic approach combining cognitive behavioral techniques with mindfulness practices to help clients achieve lasting personal growth and fulfillment.",
      stages: JSON.stringify([
        { name: "Discovery", order: 1 },
        { name: "Awareness", order: 2 },
        { name: "Action", order: 3 },
        { name: "Integration", order: 4 },
        { name: "Mastery", order: 5 }
      ]),
    });

    // Provider agent configuration
    await db.insert(providerAgentConfigs).values({
      id: uuidv4(),
      providerId: provider.id,
      coreIdentity: "I am a warm, empathetic AI coaching companion trained in life transformation methodologies. I help seekers discover their inner strength and navigate personal growth journeys.",
      responseStyle: "conversational",
      therapeuticApproaches: ["CBT", "Mindfulness", "Positive Psychology"],
      sessionStructure: JSON.stringify({
        opening: "Start with a warm check-in",
        core: "Explore current challenges and insights",
        closing: "Summarize progress and set intentions"
      }),
      boundaryGuidelines: "I maintain professional boundaries while being supportive. I don't provide medical advice and refer to professionals when needed.",
    });

    console.log("✅ Provider created: coach@haven.test / test1234\n");
  } else {
    console.log("✅ Provider already exists: coach@haven.test / test1234\n");
  }

  // Create Seeker account
  console.log("Creating seeker account...");

  let seekerUser = await db.select().from(users).where(eq(users.email, "seeker@haven.test")).then(r => r[0]);
  
  if (!seekerUser) {
    const seekerUserId = uuidv4();
    const seekerId = uuidv4();

    [seekerUser] = await db.insert(users).values({
      id: seekerUserId,
      email: "seeker@haven.test",
      password: passwordHash,
    }).returning();

    await db.insert(profiles).values({
      id: uuidv4(),
      userId: seekerUser.id,
      email: "seeker@haven.test",
    });

    await db.insert(userRoles).values({
      userId: seekerUser.id,
      role: "seeker",
    });

    const [seeker] = await db.insert(seekers).values({
      id: seekerId,
      ownerId: seekerUser.id,
      currentPain: "Feeling stuck in my career and unsure about my next steps. I want to find more meaning and purpose in my work.",
      desiredOutcome: "I want to feel confident in my career direction and wake up excited about my work every day.",
      presentChallenge: "Making decisions feels overwhelming. I keep second-guessing myself.",
      recentWin: "I finally started journaling daily and it's helping me understand my thoughts better.",
    }).returning();

    // Create engagement between seeker and provider
    await db.insert(engagements).values({
      id: uuidv4(),
      seekerId: seeker.id,
      providerId: provider.id,
      status: "active",
    });

    console.log("✅ Seeker created: seeker@haven.test / test1234\n");
    console.log("✅ Engagement created between seeker and provider\n");
  } else {
    console.log("✅ Seeker already exists: seeker@haven.test / test1234\n");
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  TEST ACCOUNTS READY");
  console.log("═══════════════════════════════════════════════");
  console.log("");
  console.log("  Provider (Coach):");
  console.log("  📧 Email: coach@haven.test");
  console.log("  🔑 Password: test1234");
  console.log("");
  console.log("  Seeker (Client):");
  console.log("  📧 Email: seeker@haven.test");
  console.log("  🔑 Password: test1234");
  console.log("");
  console.log("═══════════════════════════════════════════════");
}

seed()
  .then(() => {
    console.log("\n✨ Seeding complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
