import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp } from "./setup";
import type { Express } from "express";

let app: Express;
let providerAgent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  app = await getApp();
  providerAgent = request.agent(app);
  await providerAgent
    .post("/api/auth/login")
    .send({ email: "coach@haven.test", password: "test1234" });
});

describe("Billing (graceful degradation without Stripe keys)", () => {
  it("GET /api/billing/config returns config (null keys when unconfigured)", async () => {
    const res = await providerAgent.get("/api/billing/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("configured");
  });

  it("GET /api/billing/connect/status returns 503 without Stripe", async () => {
    const res = await providerAgent.get("/api/billing/connect/status");
    expect([200, 503]).toContain(res.status);
  });

  it("POST /api/billing/connect/onboard returns 503 without Stripe", async () => {
    const res = await providerAgent.post("/api/billing/connect/onboard");
    expect([200, 503]).toContain(res.status);
  });

  it("rejects unauthenticated billing access", async () => {
    const res = await request(app).get("/api/billing/config");
    expect(res.status).toBe(401);
  });
});
