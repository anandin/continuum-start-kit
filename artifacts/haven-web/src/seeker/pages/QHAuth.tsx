import React, { useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useQHTheme, FONT, SERIF, HAND } from "../lib/theme";
import QHButton from "../components/QHButton";
import LampGlow from "../components/LampGlow";
import ThemeToggle from "../components/ThemeToggle";

type Mode = "login" | "register";
type Role = "seeker" | "provider";

export default function QHAuth() {
  const { theme } = useQHTheme();
  const navigate = useNavigate();
  const uid = useId();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("seeker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> =
        mode === "login"
          ? { email, password }
          : { email, password, role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || data.error || `Request failed (${res.status})`,
        );
      }

      const data = await res.json();
      const effectiveRole = data.role ?? role;

      if (effectiveRole === "provider") {
        navigate("/provider/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 48,
    padding: "0 16px",
    borderRadius: 14,
    border: `1px solid ${theme.borderSoft}`,
    background: theme.surface,
    color: theme.text,
    fontFamily: FONT,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 600,
    color: theme.textSoft,
    marginBottom: 6,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: theme.pageGrad,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LampGlow top={-100} />

      {/* Top bar */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px 0",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg
            width={24}
            height={28}
            viewBox="0 0 24 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 1 L22 7 L22 17 Q22 24 12 27 Q2 24 2 17 L2 7 Z"
              fill={theme.accent}
              opacity={0.18}
              stroke={theme.accent}
              strokeWidth={1.5}
              id={`${uid}-shield`}
            />
          </svg>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 400,
              color: theme.text,
              letterSpacing: "-0.01em",
            }}
          >
            Haven
          </span>
        </div>

        <ThemeToggle />
      </div>

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 28px 48px",
        }}
      >
        {/* Greeting */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 26,
            color: theme.accent,
            margin: "0 0 8px",
          }}
        >
          {mode === "login" ? "welcome back" : "let's begin"}
        </p>

        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 30,
            fontWeight: 400,
            color: theme.text,
            margin: "0 0 32px",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {mode === "login"
            ? "Sign in to your space"
            : "Create your safe space"}
        </h1>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 380,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <label htmlFor={`${uid}-email`} style={labelStyle}>
              Email
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`${uid}-password`} style={labelStyle}>
              Password
            </label>
            <input
              id={`${uid}-password`}
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={
                mode === "login" ? "Your password" : "Choose a password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </div>

          {mode === "register" && (
            <div>
              <label style={labelStyle}>I am a…</label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["seeker", "provider"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1,
                      height: 46,
                      borderRadius: 14,
                      border: `1.5px solid ${role === r ? theme.accent : theme.borderSoft}`,
                      background:
                        role === r ? theme.iconChipBg : theme.surface,
                      color: role === r ? theme.accent : theme.muted,
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {r === "seeker" ? "Seeker" : "Provider"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: theme.accent,
                margin: 0,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <QHButton type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating your space…"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </QHButton>
        </form>

        {/* Toggle link */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: theme.muted,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          {mode === "login"
            ? "Don\u2019t have an account? "
            : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: theme.accent,
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              padding: 0,
            }}
          >
            {mode === "login" ? "Get started" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
