import { createApp } from "./app";
import { ensureExtensions } from "./db";
import { logger } from "./lib/logger";
import { startReminderCron } from "./services/scheduling";
import { loadStripeCredentialsFromConnector } from "./lib/stripe";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Provision required PostgreSQL extensions (pgvector) BEFORE the app boots.
// Failing fast here prevents the server from coming up with broken L2/L3
// retrieval against a database that doesn't have the vector type installed.
ensureExtensions()
  .then(() => loadStripeCredentialsFromConnector())
  .then(() => createApp())
  .then((app) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      // Start the 1h-before scheduled-session reminder cron once the
      // server is accepting connections. Runs every 60s; idempotent.
      startReminderCron();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize app (extensions or app)");
    process.exit(1);
  });
