import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes/routes";
import { handleStripeWebhook } from "./services/billingWebhook";

export async function createApp(): Promise<Express> {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors({ origin: true, credentials: true }));
  // Stripe webhook MUST receive the raw request body to verify the
  // signature, so it gets its own express.raw() parser BEFORE the
  // default JSON parser is installed. Same pattern as the voice
  // endpoints below — those skip the default parser too.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );
  // Voice endpoints accept base64 audio bodies that can far exceed the
  // default 100kb JSON cap, so they install their own larger-limit parser
  // at the route level. Skip the default JSON parser for /api/voice/*
  // and /api/stripe/webhook so the route-scoped parsers actually read
  // the body.
  const defaultJson = express.json();
  const defaultUrlEncoded = express.urlencoded({ extended: true });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/voice/")) return next();
    if (req.path === "/api/stripe/webhook") return next();
    return defaultJson(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/voice/")) return next();
    if (req.path === "/api/stripe/webhook") return next();
    return defaultUrlEncoded(req, res, next);
  });

  await setupAuth(app);
  registerRoutes(app);

  return app;
}
