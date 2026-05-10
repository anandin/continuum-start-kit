import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp } from "./setup";
import type { Express } from "express";

let app: Express;
let providerAgent: ReturnType<typeof request.agent>;
let seekerAgent: ReturnType<typeof request.agent>;
let engagementId: string;

beforeAll(async () => {
  app = await getApp();

  providerAgent = request.agent(app);
  await providerAgent
    .post("/api/auth/login")
    .send({ email: "coach@haven.test", password: "test1234" });

  seekerAgent = request.agent(app);
  await seekerAgent
    .post("/api/auth/login")
    .send({ email: "seeker@haven.test", password: "test1234" });

  const engRes = await seekerAgent.get("/api/engagements");
  engagementId = engRes.body[0]?.id;
});

describe("Sessions", () => {
  let sessionId: string;

  it("POST /api/sessions creates a session", async () => {
    const res = await seekerAgent.post("/api/sessions").send({ engagementId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.status).toBe("active");
    sessionId = res.body.id;
  });

  it("GET /api/sessions/:id returns session", async () => {
    const res = await seekerAgent.get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
  });

  it("GET /api/sessions/:id/messages returns empty initially", async () => {
    const res = await seekerAgent.get(`/api/sessions/${sessionId}/messages`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects unauthenticated session creation", async () => {
    const res = await request(app).post("/api/sessions").send({ engagementId });

    expect(res.status).toBe(401);
  });

  it("POST /api/sessions/:id/finish ends the session", async () => {
    const res = await seekerAgent.post(`/api/sessions/${sessionId}/finish`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Engagements", () => {
  it("GET /api/engagements returns list", async () => {
    const res = await seekerAgent.get("/api/engagements");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /api/engagements/:id returns detail", async () => {
    const res = await seekerAgent.get(`/api/engagements/${engagementId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(engagementId);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/engagements");
    expect(res.status).toBe(401);
  });
});
