import React, { useState } from "react";
import { Heart, ArrowRight, Lock, Stethoscope, Shield } from "lucide-react";

export function PragmaticStudio() {
  const [tab, setTab] = useState<"individuals" | "experts">("individuals");

  return (
    <div
      className="min-h-screen w-full bg-[#FAFAF7] text-[#1A1A1A] antialiased"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
            .ps-label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
            .ps-rule { border-color: #E5E5E0; }
            .ps-headline { letter-spacing: -0.03em; line-height: 0.95; font-weight: 700; }
            .ps-num { font-variant-numeric: tabular-nums; letter-spacing: -0.04em; }
          `,
        }}
      />

      <div className="mx-auto max-w-[1200px] px-8">
        {/* 1. Top nav */}
        <header className="flex items-center justify-between py-6 border-b ps-rule">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-[#298E89] flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[17px] tracking-tight">Haven</span>
          </div>
          <button className="text-[13px] font-semibold text-[#1A1A1A] hover:text-[#298E89] transition-colors">
            Sign in
          </button>
        </header>

        {/* 2. Audience tab toggle */}
        <div className="flex items-center gap-8 pt-10 pb-2 border-b ps-rule">
          <button
            onClick={() => setTab("individuals")}
            className={`pb-4 -mb-px text-[13px] font-semibold tracking-tight border-b-2 transition-colors ${
              tab === "individuals"
                ? "border-[#1A1A1A] text-[#1A1A1A]"
                : "border-transparent text-[#999999] hover:text-[#1A1A1A]"
            }`}
          >
            For Individuals
          </button>
          <button
            onClick={() => setTab("experts")}
            className={`pb-4 -mb-px text-[13px] font-semibold tracking-tight border-b-2 transition-colors ${
              tab === "experts"
                ? "border-[#1A1A1A] text-[#1A1A1A]"
                : "border-transparent text-[#999999] hover:text-[#1A1A1A]"
            }`}
          >
            For Experts
          </button>
        </div>

        {tab === "experts" ? (
          <div className="py-32 text-center text-[#666666] text-[14px]">
            For Experts — coming soon.
          </div>
        ) : (
          <>
            {/* 3. Hero */}
            <section className="pt-20 pb-24 grid grid-cols-12 gap-8 border-b ps-rule">
              <div className="col-span-12 md:col-span-9">
                <div className="ps-label text-[#298E89] mb-6">A coaching companion</div>
                <h1 className="ps-headline text-[56px] md:text-[68px] text-[#1A1A1A]">
                  A coaching companion built with the
                  <br />
                  people who do the work.
                </h1>
                <p className="mt-8 text-[17px] leading-relaxed text-[#666666] max-w-[640px]">
                  Haven works with your therapist or coach — between sessions, not in place of them.
                </p>
                <div className="mt-10 flex items-center gap-5">
                  <button className="bg-[#298E89] text-white px-6 py-3.5 text-[14px] font-semibold tracking-tight inline-flex items-center gap-2 hover:bg-[#1f6f6b] transition-colors">
                    Get Started <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                  <span className="text-[12px] text-[#999999]">
                    By invite only — your coach gets you in.
                  </span>
                </div>
              </div>
            </section>

            {/* 4. 3-card feature row */}
            <section className="py-16 border-b ps-rule">
              <div className="ps-label text-[#666666] mb-10">What it does</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E5E5E0]">
                {[
                  {
                    n: "01",
                    title: "Continuity that travels",
                    body: "Your coach's notes and direction follow you between sessions, so you pick up where you left off — not from scratch.",
                  },
                  {
                    n: "02",
                    title: "Clinician-built",
                    body: "Designed with practicing therapists. Every prompt and exercise was reviewed by someone who actually sits across from clients.",
                  },
                  {
                    n: "03",
                    title: "Private by default",
                    body: "Your data stays yours. Notes are encrypted, never sold, and only shared with the coach you choose.",
                  },
                ].map((f) => (
                  <div key={f.n} className="bg-[#FAFAF7] p-8">
                    <div className="ps-num text-[#999999] text-[13px] font-semibold mb-6">{f.n}</div>
                    <h3 className="text-[20px] font-bold tracking-tight mb-3 text-[#1A1A1A]">
                      {f.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed text-[#666666]">{f.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. How Haven Works */}
            <section className="py-16 border-b ps-rule">
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 md:col-span-4">
                  <div className="ps-label text-[#298E89] mb-4">How Haven works</div>
                  <h2 className="ps-headline text-[36px] text-[#1A1A1A]">
                    Three steps. No theatrics.
                  </h2>
                </div>
                <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { n: "01", t: "Connect", d: "with a coach who joins Haven." },
                    { n: "02", t: "Work", d: "between sessions, on your own terms." },
                    { n: "03", t: "Return", d: "and bring it back to your next session." },
                  ].map((s) => (
                    <div key={s.n} className="border-t-2 border-[#1A1A1A] pt-5">
                      <div className="ps-num text-[64px] font-bold text-[#1A1A1A] leading-none mb-4">
                        {s.n}
                      </div>
                      <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1">{s.t}</div>
                      <div className="text-[14px] text-[#666666] leading-snug">{s.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 6. Built on Trust */}
            <section className="py-16 border-b ps-rule">
              <div className="ps-label text-[#666666] mb-10">Built on trust</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {[
                  {
                    icon: Lock,
                    title: "Confidential",
                    body: "End-to-end encryption. We can't read your notes, and we won't try.",
                  },
                  {
                    icon: Stethoscope,
                    title: "Clinician-built",
                    body: "Reviewed by practicing therapists at every step. No wellness fluff.",
                  },
                  {
                    icon: Shield,
                    title: "Yours, end-to-end",
                    body: "Export, delete, or take your data with you. No lock-in, no exceptions.",
                  },
                ].map((t) => (
                  <div key={t.title} className="border-l ps-rule pl-5">
                    <t.icon className="w-4 h-4 text-[#298E89] mb-4" strokeWidth={2} />
                    <h3 className="text-[16px] font-bold tracking-tight mb-2 text-[#1A1A1A]">
                      {t.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[#666666]">{t.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 7. Closing CTA */}
            <section className="py-24 border-b ps-rule">
              <div className="grid grid-cols-12 gap-8 items-end">
                <div className="col-span-12 md:col-span-8">
                  <h2 className="ps-headline text-[48px] text-[#1A1A1A]">Start with Haven.</h2>
                  <p className="mt-5 text-[15px] text-[#666666] max-w-[520px]">
                    Joining requires an invitation from a coach or therapist.
                  </p>
                </div>
                <div className="col-span-12 md:col-span-4 md:text-right">
                  <button className="bg-[#298E89] text-white px-6 py-3.5 text-[14px] font-semibold tracking-tight inline-flex items-center gap-2 hover:bg-[#1f6f6b] transition-colors">
                    Get Started <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* 8. Footer */}
        <footer className="py-8 flex items-center justify-between text-[12px] text-[#999999]">
          <span>© {new Date().getFullYear()} Haven Labs, Inc.</span>
          <span className="ps-label text-[#999999]">v 1.0</span>
        </footer>
      </div>
    </div>
  );
}
