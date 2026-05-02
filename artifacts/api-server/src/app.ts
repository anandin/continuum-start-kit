import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes/routes";

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
  // Voice endpoints accept base64 audio bodies that can far exceed the
  // default 100kb JSON cap, so they install their own larger-limit parser
  // at the route level. Skip the default JSON parser for /api/voice/* so
  // the route-scoped parser is the one that actually reads the body.
  const defaultJson = express.json();
  const defaultUrlEncoded = express.urlencoded({ extended: true });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/voice/")) return next();
    return defaultJson(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/voice/")) return next();
    return defaultUrlEncoded(req, res, next);
  });

  await setupAuth(app);
  registerRoutes(app);

  return app;
}
