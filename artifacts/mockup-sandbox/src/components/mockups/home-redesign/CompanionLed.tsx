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

export function CompanionLed() {
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

        <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Top bar */}
          <header className="px-6 py-3 flex justify-between items-center">
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

          {/* Tiny greeting */}
          <div className="px-6 pt-1 pb-4">
            <p className="text-[12px] font-semibold tracking-wide text-[#666666]">
              Saturday evening · Alex
            </p>
          </div>

          {/* DOMINANT companion block */}
          <div className="px-6">
            <section className="relative bg-white border border-[#E5E5E0] rounded-2xl p-5 pl-6 overflow-hidden">
              {/* Left rule */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#164E36]" />

              {/* Header */}
              <div className="mb-4">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#164E36] mb-2">
                  This week with
                </span>
                <h1 className="text-[28px] font-bold tracking-tight leading-[1.05] text-[#1A1A1A]">
                  Dr. Maya Chen
                </h1>
                <div className="flex items-center gap-2 text-[12px] text-[#666666] font-medium mt-2">
                  <span>Stage 2 · Working through avoidance</span>
                </div>
                <div className="text-[12px] text-[#999999] font-medium">
                  Last met Thu 4/30
                </div>
              </div>

              {/* CTA */}
              <button className="w-full bg-[#164E36] text-white rounded-full py-3 px-4 font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[#0f3825] transition-colors mb-5">
                Continue session <ChevronRight className="w-4 h-4" />
              </button>

              {/* Insights */}
              <div className="mb-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-2">From Thursday</h3>
                <div className="space-y-2.5">
                  <div className="flex gap-3">
                    <span className="text-[#164E36] font-bold text-[12px] leading-snug">1</span>
                    <p className="text-[13px] leading-snug text-[#1A1A1A]">
                      You named perfectionism as the reason you avoid starting the report.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#164E36] font-bold text-[12px] leading-snug">2</span>
                    <p className="text-[13px] leading-snug text-[#1A1A1A]">
                      Rest still feels like something you have to earn.
                    </p>
                  </div>
                </div>
              </div>

              {/* Commitments */}
              <div className="mb-5 pt-4 border-t border-[#E5E5E0]">
                <div className="flex justify-between items-baseline mb-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Commitments</h3>
                  <span className="text-[11px] font-bold text-[#164E36]">1 / 3</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-[#164E36] bg-[#164E36] flex items-center justify-center mt-[2px] flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-[13px] leading-snug line-through text-[#666666]">
                      10-minute walk before noon
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-[#E5E5E0] mt-[2px] flex-shrink-0" />
                    <span className="text-[13px] leading-snug">
                      Text Mom back
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-[#E5E5E0] mt-[2px] flex-shrink-0" />
                    <span className="text-[13px] leading-snug">
                      Note one thing that landed in Thursday's session
                    </span>
                  </div>
                </div>
              </div>

              {/* Try this */}
              <div className="pt-4 border-t border-[#E5E5E0]">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#164E36] mb-1.5">Try this</h4>
                <p className="text-[13px] italic leading-snug text-[#1A1A1A]">
                  "Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone."
                </p>
              </div>
            </section>
          </div>

          {/* Demoted status strip */}
          <div className="px-6 mt-5">
            <div className="flex items-center gap-3 py-3 border-y border-[#E5E5E0]">
              {/* Today */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">Today</span>
                <span className="text-[13px] font-bold text-[#1A1A1A]">3<span className="text-[#999999] font-medium">/5</span></span>
                <div className="h-[18px] flex items-end gap-[2px]">
                  {sparkline.map((val, i) => (
                    <div
                      key={i}
                      className="w-[2px] rounded-t-[1px]"
                      style={{
                        height: (val / 5) * 18 + "px",
                        backgroundColor: i === sparkline.length - 1 ? '#164E36' : '#E5E5E0'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="w-[1px] h-6 bg-[#E5E5E0]" />
              {/* Sessions / Stage */}
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                <span>Sessions <span className="text-[#1A1A1A]">7</span></span>
                <span className="text-[#E5E5E0]">·</span>
                <span>Stage <span className="text-[#1A1A1A]">2</span></span>
              </div>
            </div>
            <p className="text-[12px] text-[#666666] font-medium mt-2 leading-snug">
              Slept badly. Long meeting at 2.
            </p>
          </div>

          {/* Progress link */}
          <div className="px-6 mt-5">
            <button className="w-full flex items-center justify-between group py-2">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-[#164E36]" />
                <span className="text-[14px] font-bold">View full progress</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#666666] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Bottom tab bar */}
        <nav className="absolute bottom-0 w-full h-[88px] bg-[#FAFAF7] border-t border-[#E5E5E0] flex justify-between px-8 pt-4 pb-8">
          <button className="flex flex-col items-center gap-1.5 text-[#164E36]">
            <Home className="w-6 h-6" fill="currentColor" />
            <span className="text-[10px] font-bold tracking-wide">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999] hover:text-[#1A1A1A] transition-colors">
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999] hover:text-[#1A1A1A] transition-colors">
            <Target className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Goals</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999] hover:text-[#1A1A1A] transition-colors">
            <Book className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">Journal</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-[#999999] hover:text-[#1A1A1A] transition-colors">
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-wide">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
