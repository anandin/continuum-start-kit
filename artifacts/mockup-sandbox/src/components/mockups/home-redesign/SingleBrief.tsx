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

export function SingleBrief() {
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
        <div className="h-9 w-full flex justify-between items-end px-6 pb-1.5 text-[11px] font-medium tracking-wide">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2.5 border border-current rounded-[2px]" />
            <div className="w-3.5 h-2.5 border border-current rounded-[2px]" />
            <div className="w-5 h-2.5 border border-current rounded-[2px] bg-current" />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="px-5 py-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#164E36] flex items-center justify-center">
                <Heart className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-[15px] tracking-tight">Haven</span>
            </div>
            <button className="w-7 h-7 rounded-full bg-[#E5E5E0] flex items-center justify-center text-[#1A1A1A]">
              <User className="w-3.5 h-3.5" />
            </button>
          </header>

          {/* Greeting band */}
          <section className="px-5 pt-2 pb-3">
            <h1 className="text-[24px] font-bold tracking-tight leading-none mb-1.5 text-[#1A1A1A]">
              Good evening, Alex.
            </h1>
            <p className="text-[#666666] text-[13px] leading-snug font-medium">
              Your last session was Thursday — you set 3 things to try.
            </p>
          </section>

          {/* At-a-glance band */}
          <section className="px-5 py-3 border-t border-[#E5E5E0] flex items-center gap-4">
            <div className="flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-[#666666] font-bold mb-0.5">Sessions</span>
              <span className="text-[17px] font-bold leading-none">7</span>
            </div>
            <div className="w-px h-7 bg-[#E5E5E0]" />
            <div className="flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-[#666666] font-bold mb-0.5">Stage</span>
              <span className="text-[13px] font-semibold leading-tight">Stage 2 · Avoidance</span>
            </div>
            <div className="w-px h-7 bg-[#E5E5E0]" />
            <div className="flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-[#666666] font-bold mb-0.5">Coach</span>
              <span className="text-[13px] font-semibold leading-tight">Dr. Chen</span>
            </div>
          </section>

          {/* Today check-in band */}
          <section className="px-5 py-3 border-t border-[#E5E5E0]">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#666666] font-bold">Today</span>
              <span className="text-[10px] uppercase tracking-wider text-[#999999] font-bold">14-day mood</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[20px] font-bold text-[#164E36] leading-none">
                3<span className="text-[12px] text-[#999999]">/5</span>
              </div>
              <p className="text-[13px] font-medium leading-snug flex-1 text-[#1A1A1A]">
                Slept badly. Long meeting at 2.
              </p>
              <div className="h-6 flex items-end gap-[2px] flex-shrink-0">
                {sparkline.map((val, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-t-sm"
                    style={{
                      height: (val / 5) * 24 + "px",
                      backgroundColor: i === sparkline.length - 1 ? '#164E36' : '#E5E5E0'
                    }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Session companion band */}
          <section className="px-5 py-3 border-t border-[#E5E5E0]">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-[15px] font-bold tracking-tight text-[#1A1A1A] leading-none">
                This week with Dr. Maya Chen
              </h2>
              <span className="text-[11px] text-[#666666] font-medium">Thu 4/30</span>
            </div>

            <button className="w-full bg-[#164E36] text-white rounded-full py-2 px-4 font-bold text-[13px] flex items-center justify-center gap-1.5 hover:bg-[#0f3825] transition-colors mb-3">
              Continue session <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Insights — compact rows */}
            <div className="mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1.5">Insights</h3>
              <ol className="space-y-1">
                <li className="flex gap-2 text-[12px] leading-snug">
                  <span className="text-[#164E36] font-bold flex-shrink-0">1</span>
                  <span className="text-[#1A1A1A]">You named perfectionism as the reason you avoid starting the report.</span>
                </li>
                <li className="flex gap-2 text-[12px] leading-snug">
                  <span className="text-[#164E36] font-bold flex-shrink-0">2</span>
                  <span className="text-[#1A1A1A]">Rest still feels like something you have to earn.</span>
                </li>
              </ol>
            </div>

            {/* Commitments — compact one-line rows */}
            <div className="mb-2">
              <div className="flex items-baseline justify-between mb-1.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Commitments</h3>
                <span className="text-[11px] font-bold text-[#164E36]">1 / 3</span>
              </div>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-[3px] border border-[#164E36] bg-[#164E36] flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[12px] leading-tight line-through text-[#999999]">10-minute walk before noon</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-[3px] border border-[#E5E5E0] flex-shrink-0" />
                  <span className="text-[12px] leading-tight text-[#1A1A1A]">Text Mom back</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-[3px] border border-[#E5E5E0] flex-shrink-0" />
                  <span className="text-[12px] leading-tight text-[#1A1A1A]">Note one thing that landed in Thursday's session</span>
                </li>
              </ul>
            </div>

            {/* Try this — small italic line */}
            <p className="text-[12px] italic leading-snug text-[#666666] pt-2 border-t border-[#E5E5E0]">
              <span className="not-italic font-bold uppercase tracking-wider text-[10px] text-[#164E36] mr-1.5">Try</span>
              "Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone."
            </p>
          </section>

          {/* Progress link band */}
          <section className="px-5 py-3 border-t border-[#E5E5E0] mt-auto">
            <button className="w-full flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#164E36]" />
                <span className="text-[13px] font-bold">View full progress</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#666666] group-hover:translate-x-1 transition-transform" />
            </button>
          </section>
        </div>

        {/* Bottom tab bar */}
        <nav className="w-full h-[72px] bg-[#FAFAF7] border-t border-[#E5E5E0] flex justify-between px-7 pt-2.5 pb-6 flex-shrink-0">
          <button className="flex flex-col items-center gap-1 text-[#164E36]">
            <Home className="w-5 h-5" fill="currentColor" />
            <span className="text-[9px] font-bold tracking-wide">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#999999]">
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wide">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#999999]">
            <Target className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wide">Goals</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#999999]">
            <Book className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wide">Journal</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#999999]">
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wide">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
