import React, { useState } from "react";
import { Heart, ArrowRight, Lock, Users, Clock } from "lucide-react";

export function QuietNightstand() {
  const [tab, setTab] = useState<"individuals" | "experts">("individuals");

  const bg = "#1A1612";
  const surface = "#241F1A";
  const text = "#ECE7DC";
  const muted = "#A39A8E";
  const hairline = "#3A352F";
  const amber = "#EAB04A";

  return (
    <div
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: "100vh",
        fontSize: "16px",
        lineHeight: 1.7,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500;600&display=swap');
        .qn-serif { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }
        .qn-link { color: ${text}; text-decoration: none; }
        .qn-amber-btn {
          background: ${amber};
          color: #1A1612;
          font-weight: 500;
          padding: 14px 26px;
          border-radius: 2px;
          font-size: 15px;
          letter-spacing: 0.01em;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: none;
          cursor: pointer;
          transition: background 200ms;
        }
        .qn-amber-btn:hover { background: #f0bd66; }
        .qn-ghost-btn {
          background: transparent;
          color: ${text};
          padding: 10px 18px;
          border: 1px solid ${hairline};
          border-radius: 2px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: border-color 200ms;
        }
        .qn-ghost-btn:hover { border-color: ${muted}; }
        .qn-tab {
          background: transparent;
          color: ${muted};
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          padding: 12px 4px;
          margin: 0 18px;
          cursor: pointer;
          border-bottom: 1px solid transparent;
          letter-spacing: 0.02em;
        }
        .qn-tab.active {
          color: ${text};
          border-bottom: 1px solid ${amber};
        }
        .qn-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: ${amber};
          display: inline-block;
          margin-right: 12px;
          flex-shrink: 0;
          margin-top: 12px;
        }
        .qn-numcircle {
          width: 38px; height: 38px; border-radius: 999px;
          border: 1px solid ${amber};
          color: ${amber};
          display: inline-flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          background: transparent;
          flex-shrink: 0;
        }
        @media (max-width: 760px) {
          .qn-feature-row, .qn-trust-row, .qn-steps { grid-template-columns: 1fr !important; gap: 36px !important; }
          .qn-hero-h { font-size: 42px !important; }
          .qn-section-h { font-size: 32px !important; }
        }
      `,
        }}
      />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
        {/* 1. Top nav */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
            paddingBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                border: `1px solid ${amber}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart style={{ width: 12, height: 12, color: amber }} strokeWidth={1.8} />
            </div>
            <span
              className="qn-serif"
              style={{ fontSize: 22, color: text, letterSpacing: 0.5 }}
            >
              Haven
            </span>
          </div>
          <button className="qn-ghost-btn">Sign in</button>
        </header>

        {/* 2. Audience tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            borderBottom: `1px solid ${hairline}`,
            marginBottom: 24,
          }}
        >
          <button
            className={`qn-tab ${tab === "individuals" ? "active" : ""}`}
            onClick={() => setTab("individuals")}
          >
            For Individuals
          </button>
          <button
            className={`qn-tab ${tab === "experts" ? "active" : ""}`}
            onClick={() => setTab("experts")}
          >
            For Experts
          </button>
        </div>

        {tab === "experts" ? (
          <div
            style={{
              padding: "120px 0",
              textAlign: "center",
              color: muted,
              fontSize: 15,
            }}
          >
            <p className="qn-serif" style={{ fontSize: 28, color: text, marginBottom: 8 }}>
              For Experts
            </p>
            <p>Coming soon.</p>
          </div>
        ) : (
          <>
            {/* 3. Hero */}
            <section
              style={{
                paddingTop: 96,
                paddingBottom: 112,
                maxWidth: 820,
                margin: "0 auto",
                textAlign: "center",
              }}
            >
              <h1
                className="qn-serif qn-hero-h"
                style={{
                  fontSize: 60,
                  lineHeight: 1.08,
                  color: text,
                  margin: 0,
                  marginBottom: 28,
                }}
              >
                Between sessions — without going it alone.
              </h1>
              <p
                style={{
                  color: muted,
                  fontSize: 17,
                  lineHeight: 1.7,
                  maxWidth: 620,
                  margin: "0 auto 40px",
                }}
              >
                Haven is a coaching companion built with practicing therapists.
                It remembers what you talked about with your coach, and it's here
                at 11 pm when you need to think out loud.
              </p>
              <button className="qn-amber-btn">
                Begin with Haven
                <ArrowRight style={{ width: 16, height: 16 }} strokeWidth={1.8} />
              </button>
            </section>

            {/* 4. 3-card feature row (hairline, amber dots) */}
            <section
              style={{
                paddingTop: 80,
                paddingBottom: 96,
                borderTop: `1px solid ${hairline}`,
              }}
            >
              <div
                className="qn-feature-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 56,
                }}
              >
                {[
                  {
                    title: "Picks up where you left off",
                    body:
                      "Your coach's notes carry over. Haven remembers what you've been working on, so you don't restart from zero each time.",
                  },
                  {
                    title: "Built with clinicians",
                    body:
                      "Designed alongside practicing therapists. Responses follow approaches your coach actually uses — not generic advice.",
                  },
                  {
                    title: "Quiet by default",
                    body:
                      "No notifications begging for attention. No streaks. Open it when you want to think; close it when you don't.",
                  },
                ].map((f) => (
                  <div key={f.title} style={{ display: "flex" }}>
                    <span className="qn-dot" />
                    <div>
                      <h3
                        className="qn-serif"
                        style={{
                          fontSize: 24,
                          color: text,
                          margin: 0,
                          marginBottom: 12,
                          lineHeight: 1.2,
                        }}
                      >
                        {f.title}
                      </h3>
                      <p style={{ color: muted, fontSize: 15, margin: 0, lineHeight: 1.7 }}>
                        {f.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. How Haven Works */}
            <section
              style={{
                paddingTop: 96,
                paddingBottom: 96,
                borderTop: `1px solid ${hairline}`,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 64 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: muted,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  How Haven Works
                </p>
                <h2
                  className="qn-serif qn-section-h"
                  style={{ fontSize: 40, color: text, margin: 0, lineHeight: 1.15 }}
                >
                  Three small steps.
                </h2>
              </div>

              <div
                className="qn-steps"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 48,
                  maxWidth: 980,
                  margin: "0 auto",
                }}
              >
                {[
                  {
                    n: "1",
                    title: "Match",
                    body:
                      "Your therapist or coach invites you. Haven mirrors their approach, not someone else's.",
                  },
                  {
                    n: "2",
                    title: "Meet",
                    body:
                      "Have a first conversation when you have a quiet moment. No prep required.",
                  },
                  {
                    n: "3",
                    title: "Keep going",
                    body:
                      "Return between sessions to think out loud. Your coach can see what's helpful.",
                  },
                ].map((s) => (
                  <div key={s.n}>
                    <div style={{ marginBottom: 20 }}>
                      <span className="qn-numcircle">{s.n}</span>
                    </div>
                    <h3
                      className="qn-serif"
                      style={{
                        fontSize: 26,
                        color: text,
                        margin: 0,
                        marginBottom: 10,
                      }}
                    >
                      {s.title}
                    </h3>
                    <p style={{ color: muted, fontSize: 15, margin: 0 }}>{s.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Built on Trust */}
            <section
              style={{
                paddingTop: 96,
                paddingBottom: 96,
                borderTop: `1px solid ${hairline}`,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 64 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: muted,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    margin: 0,
                    marginBottom: 16,
                  }}
                >
                  Built on Trust
                </p>
                <h2
                  className="qn-serif qn-section-h"
                  style={{ fontSize: 40, color: text, margin: 0 }}
                >
                  Made carefully, on purpose.
                </h2>
              </div>

              <div
                className="qn-trust-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 0,
                  maxWidth: 980,
                  margin: "0 auto",
                }}
              >
                {[
                  {
                    icon: Lock,
                    title: "Private",
                    body:
                      "Conversations are encrypted and stay between you and your coach. Never sold, never used to train models.",
                  },
                  {
                    icon: Users,
                    title: "Clinician-built",
                    body:
                      "Co-developed with licensed therapists. Reviewed for safety before any change reaches you.",
                  },
                  {
                    icon: Clock,
                    title: "At your pace",
                    body:
                      "There's no schedule, no streak, no badges. You set when and how often you show up.",
                  },
                ].map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.title}
                      style={{
                        padding: "8px 28px",
                        borderLeft: i === 0 ? "none" : `1px solid ${hairline}`,
                      }}
                    >
                      <Icon
                        style={{ width: 18, height: 18, color: muted, marginBottom: 18 }}
                        strokeWidth={1.5}
                      />
                      <h3
                        className="qn-serif"
                        style={{
                          fontSize: 22,
                          color: text,
                          margin: 0,
                          marginBottom: 10,
                        }}
                      >
                        {t.title}
                      </h3>
                      <p style={{ color: muted, fontSize: 14.5, margin: 0 }}>{t.body}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 7. Closing CTA band */}
            <section
              style={{
                paddingTop: 112,
                paddingBottom: 128,
                textAlign: "center",
                background: surface,
                marginLeft: -28,
                marginRight: -28,
                paddingLeft: 28,
                paddingRight: 28,
                marginTop: 40,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 1,
                  background: amber,
                  margin: "0 auto 36px",
                }}
              />
              <h2
                className="qn-serif qn-section-h"
                style={{
                  fontSize: 48,
                  color: text,
                  margin: 0,
                  marginBottom: 20,
                  lineHeight: 1.1,
                }}
              >
                Start when you're ready.
              </h2>
              <p
                style={{
                  color: muted,
                  fontSize: 16,
                  maxWidth: 480,
                  margin: "0 auto 36px",
                }}
              >
                Haven is by invitation from your coach or therapist.
              </p>
              <button className="qn-amber-btn">
                Get Started
                <ArrowRight style={{ width: 16, height: 16 }} strokeWidth={1.8} />
              </button>
            </section>
          </>
        )}

        {/* 8. Footer */}
        <footer
          style={{
            paddingTop: 36,
            paddingBottom: 40,
            textAlign: "center",
            color: muted,
            fontSize: 13,
            letterSpacing: 0.2,
          }}
        >
          © {new Date().getFullYear()} Haven. Made with care.
        </footer>
      </div>
    </div>
  );
}
