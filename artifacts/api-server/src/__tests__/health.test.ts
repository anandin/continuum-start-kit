import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp } from "./setup";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

describe("Health", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /api/healthz returns ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
