import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { logger } from "./lib/logger";

export { db, pool };

/**
 * Ensure required PostgreSQL extensions are installed before any query that
 * depends on them runs. Currently:
 *   - vector (pgvector) — used by persona_examples.embedding and
 *     client_memory.embedding for L2 retrieval and L3 memory recall.
 *
 * Idempotent: CREATE EXTENSION IF NOT EXISTS is safe to run on every boot.
 * Failures are surfaced rather than swallowed so a misconfigured database
 * is loud at startup instead of silently degrading retrieval.
 */
let extensionsReady: Promise<void> | null = null;

export function ensureExtensions(): Promise<void> {
  if (extensionsReady) return extensionsReady;
  extensionsReady = (async () => {
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      logger.info("pgvector extension ensured");
    } catch (err) {
      logger.error({ err }, "failed to ensure pgvector extension");
      throw err;
    }
  })();
  return extensionsReady;
}
