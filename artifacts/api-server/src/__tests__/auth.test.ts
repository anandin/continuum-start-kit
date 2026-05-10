import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp } from "./setup";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

describe("Auth", () => {
  const testEmail = `test-${Date.now()}@haven.test`;
  const testPassword = "testpass123";

  describe("POST /api/auth/register", () => {
    it("creates a new user and returns session", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testEmail, password: testPassword, role: "seeker" });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.role).toBe("seeker");
    });

    it("rejects duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it("rejects missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "a@b.com" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });

    it("rejects invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrong" });

      expect(res.status).toBe(401);
    });

    it("rejects nonexistent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@nowhere.test", password: "test" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/session", () => {
    it("returns user when authenticated", async () => {
      const agent = request.agent(app);
      await agent
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      const res = await agent.get("/api/auth/session");
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });

    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/auth/session");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("destroys session", async () => {
      const agent = request.agent(app);
      await agent
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });

      const logoutRes = await agent.post("/api/auth/logout");
      expect(logoutRes.status).toBe(200);

      const sessionRes = await agent.get("/api/auth/session");
      expect(sessionRes.status).toBe(401);
    });
  });
});
