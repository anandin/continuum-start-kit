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

describe("Goals", () => {
  let goalId: string;

  it("POST /api/engagements/:id/goals creates a goal", async () => {
    const res = await providerAgent
      .post(`/api/engagements/${engagementId}/goals`)
      .send({
        title: "Set work boundaries",
        description: "Practice saying no to tasks outside scope",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.title).toBe("Set work boundaries");
    goalId = res.body.id;
  });

  it("GET /api/engagements/:id/goals lists goals", async () => {
    const res = await providerAgent.get(
      `/api/engagements/${engagementId}/goals`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((g: any) => g.id === goalId)).toBe(true);
  });

  it("PUT /api/goals/:id updates a goal", async () => {
    const res = await providerAgent
      .put(`/api/goals/${goalId}`)
      .send({ title: "Updated goal title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated goal title");
  });

  it("DELETE /api/goals/:id removes a goal", async () => {
    const res = await providerAgent.delete(`/api/goals/${goalId}`);
    expect(res.status).toBe(200);
  });
});

describe("Notes", () => {
  let noteId: string;

  it("POST /api/engagements/:id/notes creates a note", async () => {
    const res = await providerAgent
      .post(`/api/engagements/${engagementId}/notes`)
      .send({ content: "Client showed strong motivation today" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.content).toBe("Client showed strong motivation today");
    noteId = res.body.id;
  });

  it("GET /api/engagements/:id/notes lists notes", async () => {
    const res = await providerAgent.get(
      `/api/engagements/${engagementId}/notes`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("PUT /api/notes/:id updates a note", async () => {
    const res = await providerAgent
      .put(`/api/notes/${noteId}`)
      .send({ content: "Updated note content" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated note content");
  });

  it("DELETE /api/notes/:id removes a note", async () => {
    const res = await providerAgent.delete(`/api/notes/${noteId}`);
    expect(res.status).toBe(200);
  });
});

describe("Mood", () => {
  it("POST /api/mood/today creates mood entry", async () => {
    const res = await seekerAgent
      .post("/api/mood/today")
      .send({ score: 4, note: "Feeling better about work" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
  });

  it("GET /api/mood/me returns mood data", async () => {
    const res = await seekerAgent.get("/api/mood/me");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
