#!/usr/bin/env node
/**
 * Provision required PostgreSQL extensions before drizzle-kit push runs.
 *
 * drizzle-kit push will fail to create columns of type `vector(1536)` on a
 * fresh database because the `vector` type does not exist until pgvector is
 * installed. We create the extension here (idempotent) so the subsequent
 * push succeeds cleanly.
 *
 * Currently provisions:
 *   - vector (pgvector) — persona_examples.embedding, client_memory.embedding
 */

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ensure-extensions: DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("ensure-extensions: pgvector ready");
} catch (err) {
  console.error(
    "ensure-extensions: failed to provision pgvector:",
    err.message,
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
