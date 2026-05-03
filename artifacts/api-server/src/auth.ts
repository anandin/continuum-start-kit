import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { pool } from "./db";
import connectPgSimple from "connect-pg-simple";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
    }
  }
}

async function ensureSessionTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
    `);
  } finally {
    client.release();
  }
}

export async function setupAuth(app: Express): Promise<void> {
  await ensureSessionTable();

  const PgSession = connectPgSimple(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "bloom-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, { id: user.id, email: user.email });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, { id: user.id, email: user.email });
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password, role } = req.body ?? {};

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Role defaults to "seeker" so a fresh signup lands in a fully usable
      // state (journal, progress, chat empty-states all work) instead of
      // hitting cryptic 403s from seeker-only endpoints. Clients that need
      // the provider path (web /auth/role, future provider invite flow)
      // pass role explicitly.
      const normalizedRole: "seeker" | "provider" =
        role === "provider" ? "provider" : "seeker";

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashedPassword });

      await storage.createProfile({ userId: user.id, email: user.email });
      try {
        await storage.createUserRole({ userId: user.id, role: normalizedRole });
        if (normalizedRole === "seeker") {
          await storage.createSeeker({ ownerId: user.id });
        }
      } catch (roleErr) {
        // Don't fail the registration over role bootstrap issues — the user
        // can still pick/repair their role via /auth/role on the web.
        // eslint-disable-next-line no-console
        console.warn("register: role bootstrap failed", roleErr);
      }

      req.login({ id: user.id, email: user.email }, (err) => {
        if (err) return next(err);
        res.status(201).json({
          user: { id: user.id, email: user.email },
          role: normalizedRole,
        });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ user: { id: user.id, email: user.email } });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}
