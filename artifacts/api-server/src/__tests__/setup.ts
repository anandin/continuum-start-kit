import { createApp } from "../app";
import { ensureExtensions } from "../db";
import type { Express } from "express";

let app: Express | null = null;

export async function getApp(): Promise<Express> {
  if (app) return app;
  await ensureExtensions();
  app = await createApp();
  return app;
}
