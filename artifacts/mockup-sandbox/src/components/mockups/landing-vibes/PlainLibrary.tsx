import React, { useState } from "react";
import { Heart, Lock, Users, BookOpen, ArrowUpRight } from "lucide-react";

export function PlainLibrary() {
  const [tab, setTab] = useState<"individuals" | "experts">("individuals");

  const cream = "#FBF7EE";
  const ink = "#3A312A";
  const muted = "#7A6E62";
  const rule = "#E5DDD0";
  const accent = "#A87455";

  return (
    <div
      style={{
        backgroundColor: cream,
        color: ink,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      className="min-h-screen w-full"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');
            .pl-serif { font-family: 'Cormorant Garamond', 'Lora', Georgia, serif; font-feature-settings: "liga","dlig"; }
            .pl-rule { border-color: ${rule}; }
            .pl-link-underline { background-image: linear-gradient(${accent}, ${accent}); background-size: 100% 1px; background-repeat: no-repeat; background-position: 0 100%; }
          `,
        }}
      />

      <div className="mx-auto" style={{ maxWidth: 1180 }}>
        {/* 1. Top nav */}
        <header
          className="flex items-center justify-between px-8 pt-8 pb-6 border-b pl-rule"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: ink }}
            >
              <Heart className="w-3 h-3" style={{ color: cream }} strokeWidth={2} />
            </div>
            <span className="pl-serif text-[22px] tracking-wide" style={{ color: ink }}>
              Haven
            </span>
          </div>
          <button
            className="text-[13px] tracking-wide"
            style={{ color: muted }}
          >
            Sign in
          </button>
        </header>

        {/* 2. Audience tab toggle */}
        <div className="px-8 pt-10">
          <div className="flex gap-8 text-[13px] uppercase tracking-[0.18em]">
            <button
              onClick={() => setTab("individuals")}
              className="pb-2"
              style={{
                color: tab === "individuals" ? ink : muted,
                borderBottom: tab === "individuals" ? `1px solid ${ink}` : "1px solid transparent",
              }}
            >
              For individuals
            </button>
            <button
              onClick={() => setTab("experts")}
              className="pb-2"
              style={{
                color: tab === "experts" ? ink : muted,
                borderBottom: tab === "experts" ? `1px solid ${ink}` : "1px solid transparent",
              }}
            >
              For experts
            </button>
          </div>
        </div>

        {tab === "experts" ? (
          <div className="px-8 py-32 text-center">
            <p className="pl-serif italic text-2xl" style={{ color: muted }}>
              For practicing clinicians — coming soon.
            </p>
          </div>
        ) : (
          <>
            {/* 3. Hero */}
            <section className="px-8 pt-24 pb-28">
              <p
                className="text-[12px] uppercase tracking-[0.24em] mb-10"
                style={{ color: muted }}
              >
                A coaching companion · Est. 2024
              </p>
              <h1
                className="pl-serif"
                style={{
                  fontSize: "68px",
                  lineHeight: 1.05,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  maxWidth: 900,
                  color: ink,
                }}
              >
                Between sessions, somewhere to keep going.
              </h1>
              <p
                className="mt-10 text-[17px] leading-[1.7] font-light"
                style={{ color: muted, maxWidth: 620 }}
              >
                Haven is a coaching companion built with practicing therapists.
                It remembers your work and meets you between appointments.
              </p>
              <div className="mt-12 flex items-center gap-8">
                <button
                  className="px-7 py-3.5 text-[14px] tracking-wide"
                  style={{
                    backgroundColor: accent,
                    color: cream,
                    borderRadius: 2,
                  }}
                >
                  Start with Haven
                </button>
                <a
                  className="text-[14px] pl-link-underline pb-0.5"
                  style={{ color: ink }}
                  href="#how"
                >
                  How it works
                </a>
              </div>
            </section>

            {/* 4. Three feature cells */}
            <section className="px-8 py-24 border-t pl-rule">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-12">
                {[
                  {
                    Icon: BookOpen,
                    title: "Continuity",
                    body:
                      "Your coach's notes carry between sessions. You don't have to start over each time.",
                  },
                  {
                    Icon: Users,
                    title: "Built with clinicians",
                    body:
                      "Made alongside therapists, not retrofitted. Their language and methods are the foundation.",
                  },
                  {
                    Icon: Lock,
                    title: "Yours alone",
                    body:
                      "Private by default. You decide what is saved, what is shared, and what is forgotten.",
                  },
                ].map(({ Icon, title, body }) => (
                  <div key={title}>
                    <Icon className="w-5 h-5 mb-6" strokeWidth={1.25} style={{ color: ink }} />
                    <h3
                      className="pl-serif text-[26px] mb-3"
                      style={{ fontWeight: 500, color: ink, lineHeight: 1.2 }}
                    >
                      {title}
                    </h3>
                    <p className="text-[15px] leading-[1.7] font-light" style={{ color: muted }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. How Haven Works */}
            <section id="how" className="px-8 py-24 border-t pl-rule">
              <p
                className="text-[12px] uppercase tracking-[0.24em] mb-8"
                style={{ color: muted }}
              >
                How Haven works
              </p>
              <h2
                className="pl-serif mb-16"
                style={{
                  fontSize: "44px",
                  fontWeight: 400,
                  lineHeight: 1.15,
                  color: ink,
                  maxWidth: 720,
                }}
              >
                Three small steps, taken at a human pace.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-14">
                {[
                  {
                    num: "I",
                    title: "Match.",
                    body:
                      "A coach or therapist invites you in. You begin with someone who already knows your situation.",
                  },
                  {
                    num: "II",
                    title: "Meet.",
                    body:
                      "Talk through what is on your mind. Haven listens, and remembers what matters for next time.",
                  },
                  {
                    num: "III",
                    title: "Keep going.",
                    body:
                      "Between appointments, return when you need to. Pick up exactly where you left off.",
                  },
                ].map(({ num, title, body }) => (
                  <div key={num}>
                    <div
                      className="pl-serif italic mb-5"
                      style={{
                        fontSize: 36,
                        color: accent,
                        fontWeight: 500,
                        lineHeight: 1,
                      }}
                    >
                      {num}.
                    </div>
                    <h3
                      className="pl-serif text-[24px] mb-3"
                      style={{ fontWeight: 500, color: ink }}
                    >
                      {title}
                    </h3>
                    <p className="text-[15px] leading-[1.7] font-light" style={{ color: muted }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Built on Trust */}
            <section className="px-8 py-24 border-t pl-rule">
              <p
                className="text-[12px] uppercase tracking-[0.24em] mb-8"
                style={{ color: muted }}
              >
                Built on trust
              </p>
              <h2
                className="pl-serif mb-16"
                style={{
                  fontSize: "44px",
                  fontWeight: 400,
                  lineHeight: 1.15,
                  color: ink,
                  maxWidth: 760,
                }}
              >
                Quiet, careful, and answerable to you.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-12">
                {[
                  {
                    label: "Confidential",
                    body:
                      "End-to-end encrypted. Notes are kept only when you ask. Nothing is sold, ever.",
                  },
                  {
                    label: "Made with clinicians",
                    body:
                      "Designed in practice with licensed therapists who use it with their own clients.",
                  },
                  {
                    label: "At your pace",
                    body:
                      "No streaks. No nudges. No metrics that turn care into a game. You set the rhythm.",
                  },
                ].map(({ label, body }) => (
                  <div key={label} className="border-t pl-rule pt-6">
                    <h4
                      className="pl-serif text-[22px] mb-3"
                      style={{ fontWeight: 500, color: ink }}
                    >
                      {label}
                    </h4>
                    <p className="text-[15px] leading-[1.7] font-light" style={{ color: muted }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 7. Closing CTA */}
            <section className="px-8 py-32 border-t pl-rule text-center">
              <h2
                className="pl-serif mx-auto"
                style={{
                  fontSize: "56px",
                  fontWeight: 400,
                  lineHeight: 1.1,
                  color: ink,
                  maxWidth: 720,
                }}
              >
                Start when you're ready.
              </h2>
              <p
                className="mt-8 text-[16px] leading-[1.7] font-light mx-auto"
                style={{ color: muted, maxWidth: 520 }}
              >
                Haven is by invitation from a coach or therapist.
              </p>
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  className="px-7 py-3.5 text-[14px] tracking-wide inline-flex items-center gap-2"
                  style={{
                    backgroundColor: accent,
                    color: cream,
                    borderRadius: 2,
                  }}
                >
                  Get started <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </section>

            {/* 8. Footer */}
            <footer className="px-8 py-10 border-t pl-rule">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="text-[12px]" style={{ color: muted }}>
                  © {new Date().getFullYear()} Haven Studio. All rights reserved.
                </p>
                <p
                  className="pl-serif italic text-[13px]"
                  style={{ color: muted }}
                >
                  Haven is not a substitute for therapy.
                </p>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
