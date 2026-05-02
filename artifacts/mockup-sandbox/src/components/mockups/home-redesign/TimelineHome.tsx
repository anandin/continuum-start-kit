import React from "react";
import {
  Heart,
  User,
  Check,
  Home,
  MessageSquare,
  Target,
  Book,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

export function TimelineHome() {
  const sparkline = [4, 3, 3, 2, 4, 3, 2, 3, 3, 2, 3, 3, 3, 3];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E5E5E0] p-8">
      <div
        className="flex flex-col bg-[#FAFAF7] text-[#1A1A1A] font-sans antialiased relative overflow-hidden shadow-2xl rounded-[40px] border-8 border-white"
        style={{
          width: "390px",
          height: "844px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&display=swap');
        ` }} />

        {/* Top Status Bar Simulator */}
        <div className="h-12 w-full flex justify-between items-end px-6 pb-2 text-[11px] font-medium tracking-wide">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2.5 border border-current rounded-[2px]" />
            <div className="w-3.5 h-2.5 border border-current rounded-[2px]" />
            <div className="w-5 h-2.5 border border-current rounded-[2px] bg-current" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {/* Top bar */}
          <header className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#164E36] flex items-center justify-center">
                <Heart className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg tracking-tight">Haven</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-[#E5E5E0] flex items-center justify-center text-[#1A1A1A]">
              <User className="w-4 h-4" />
            </button>
          </header>

          {/* Greeting + at-a-glance compact header */}
          <div className="px-6 mt-2 mb-6">
            <h1 className="text-[22px] font-bold tracking-tight leading-none mb-2 text-[#1A1A1A]">
              Good evening, Alex.
            </h1>
            <p className="text-[#666666] text-[13px] leading-snug font-medium">
              Your last session was Thursday — you set 3 things to try.
            </p>
            <div className="mt-4 pt-4 border-t border-[#E5E5E0] flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-[#666666]">
              <span>Sessions <span className="text-[#1A1A1A] ml-1">7</span></span>
              <span className="text-[#E5E5E0]">/</span>
              <span>Stage <span className="text-[#1A1A1A] ml-1 normal-case tracking-normal">2</span></span>
              <span className="text-[#E5E5E0]">/</span>
              <span className="normal-case tracking-normal text-[#1A1A1A]">Working through avoidance</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pl-10 pr-6">
            {/* Vertical spine */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[#E5E5E0]" />

            {/* Station 1: THU 4/30 — Last session (anchor block) */}
            <section className="relative pb-10">
              <span
                className="absolute left-[-26px] top-1.5 w-[11px] h-[11px] rounded-full bg-[#164E36] ring-4 ring-[#FAFAF7]"
                aria-hidden
              />
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                Thu 4/30 · Last session
              </div>
              <h2 className="text-[20px] font-bold tracking-tight leading-tight mt-2 mb-1">
                This week with Dr. Maya Chen
              </h2>
              <p className="text-[13px] text-[#666666] font-medium mb-5">
                Stage 2 · Working through avoidance
              </p>

              {/* Insights */}
              <div className="space-y-4 mb-5">
                <div className="flex gap-3">
                  <span className="text-[#164E36] font-bold text-[13px] leading-relaxed">1</span>
                  <p className="text-[14px] leading-relaxed border-l-2 border-[#164E36] pl-3">
                    You named perfectionism as the reason you avoid starting the report.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="text-[#164E36] font-bold text-[13px] leading-relaxed">2</span>
                  <p className="text-[14px] leading-relaxed border-l-2 border-[#164E36] pl-3">
                    Rest still feels like something you have to earn.
                  </p>
                </div>
              </div>

              {/* Try this */}
              <div className="bg-white border border-[#E5E5E0] rounded-lg p-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#164E36] mb-2">Try this</h4>
                <p className="text-[14px] italic leading-relaxed text-[#1A1A1A]">
                  "Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone."
                </p>
              </div>
            </section>

            {/* Station 2: THIS WEEK — 3 things to try */}
            <section className="relative pb-10">
              <span
                className="absolute left-[-26px] top-1.5 w-[11px] h-[11px] rounded-full bg-[#164E36] ring-4 ring-[#FAFAF7]"
                aria-hidden
              />
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                  This week · 3 things to try
                </div>
                <span className="text-[11px] font-bold text-[#164E36]">1 / 3</span>
              </div>
              <div className="space-y-2.5 mt-3">
                <div className="flex items-start gap-3">
                  <div className="w-[18px] h-[18px] rounded border-2 border-[#164E36] bg-[#164E36] flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[14px] leading-tight pt-0.5 line-through text-[#666666]">
                    10-minute walk before noon
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-[18px] h-[18px] rounded border-2 border-[#E5E5E0] mt-0.5 flex-shrink-0" />
                  <span className="text-[14px] leading-tight pt-0.5">
                    Text Mom back
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-[18px] h-[18px] rounded border-2 border-[#E5E5E0] mt-0.5 flex-shrink-0" />
                  <span className="text-[14px] leading-tight pt-0.5">
                    Note one thing that landed in Thursday's session
                  </span>
                </div>
              </div>
            </section>

            {/* Station 3: TODAY — Sat evening */}
            <section className="relative pb-10">
              <span
                className="absolute left-[-26px] top-1.5 w-[11px] h-[11px] rounded-full bg-[#164E36] ring-4 ring-[#FAFAF7]"
                aria-hidden
              />
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                Today · Sat evening
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex-shrink-0 text-xl font-bold text-[#164E36] leading-none pt-0.5">
                  3<span className="text-[14px] text-[#999999]">/5</span>
                </div>
                <p className="text-[14px] font-medium leading-snug flex-1">
                  Slept badly. Long meeting at 2.
                </p>
              </div>
              <div className="h-[28px] w-full mt-4 flex items-end justify-between">
                {sparkline.map((val, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-t-sm"
                    style={{
                      height: (val / 5) * 100 + "%",
                      backgroundColor: i === 13 ? "#164E36" : "#E5E5E0",
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-[#999999] tracking-wider mt-1">
                <span>14 days ago</span>
                <span>Now</span>
              </div>
              <button className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#164E36]">
                Continue session <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </section>

            {/* Station 4: NEXT — Session 8 (future) */}
            <section className="relative pb-2">
              <span
                className="absolute left-[-26px] top-1.5 w-[11px] h-[11px] rounded-full bg-[#FAFAF7] border-2 border-[#E5E5E0]"
                aria-hidden
              />
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#999999]">
                Next · Session 8
              </div>
              <p className="text-[13px] text-[#999999] font-medium mt-1.5">
                Not yet scheduled
              </p>
            </section>
          </div>

          {/* Progress link */}
          <div className="px-6 mt-8 pt-5 border-t border-[#E5E5E0]">
            <button className="w-full flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-[#164E36]" />
                <span className="text-[15px] font-bold">View full progress</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#666666]" />
            </button>
          </div>
        </div>

        {/* Bottom tab bar */}
        <nav className="absolute bottom-0 w-full h-[88px] bg-[#FAFAF7] border-t border-[#E5E5E0] flex justify-between px-8 pt-4 pb-8">
          <button className="flex flex-col items-center gap-1.5 text-[#164E36]">
            <Home className="w-6 h-6" fill="currentColor" />
            <span className="text-[10px] font-bold tracking-wide">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999]">
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999]">
            <Target className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Goals</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999]">
            <Book className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Journal</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999]">
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
