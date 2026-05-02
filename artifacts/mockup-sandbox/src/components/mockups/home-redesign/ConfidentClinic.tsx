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
  Edit2
} from "lucide-react";

export function ConfidentClinic() {
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

          <div className="px-6 space-y-10 mt-2">
            {/* Greeting block */}
            <section>
              <h1 className="text-[32px] font-bold tracking-tight leading-none mb-2 text-[#1A1A1A]">
                Good evening, Alex.
              </h1>
              <p className="text-[#666666] text-[15px] leading-snug font-medium">
                Your last session was Thursday — you set 3 things to try.
              </p>
            </section>

            {/* At-a-glance row */}
            <section className="flex gap-4 items-baseline border-b border-[#E5E5E0] pb-6">
              <div className="flex-1">
                <span className="block text-[11px] uppercase tracking-wider text-[#666666] font-bold mb-1">Sessions</span>
                <span className="text-xl font-bold">7</span>
              </div>
              <div className="w-[1px] h-8 bg-[#E5E5E0]" />
              <div className="flex-[2]">
                <span className="block text-[11px] uppercase tracking-wider text-[#666666] font-bold mb-1">Stage</span>
                <span className="text-[15px] font-semibold leading-tight">Working through avoidance</span>
              </div>
            </section>

            {/* Today's check-in */}
            <section className="space-y-3">
              <div className="flex justify-between items-baseline">
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#666666]">Today</h2>
                <button className="text-[#164E36] flex items-center gap-1 text-[13px] font-semibold hover:opacity-70 transition-opacity">
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
              <div className="bg-white border border-[#E5E5E0] p-4 rounded-lg flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-xl font-bold text-[#164E36] leading-none pt-0.5">
                    3<span className="text-[14px] text-[#999999]">/5</span>
                  </div>
                  <p className="text-[14px] font-medium leading-snug flex-1">
                    Slept badly. Long meeting at 2.
                  </p>
                </div>
                <div className="h-[30px] w-full mt-2 flex items-end justify-between px-1">
                  {[4, 3, 3, 2, 4, 3, 2, 3, 3, 2, 3, 3, 3, 3].map((val, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-t-sm"
                      style={{
                        height: (val / 5) * 100 + "%",
                        backgroundColor: i === 13 ? '#164E36' : '#E5E5E0'
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-[#999999] tracking-wider px-1">
                  <span>14 days ago</span>
                  <span>Now</span>
                </div>
              </div>
            </section>

            {/* Session companion card */}
            <section className="space-y-6">
              <div>
                <h2 className="text-[22px] font-bold tracking-tight mb-1 text-[#1A1A1A]">
                  This week with Dr. Maya Chen
                </h2>
                <div className="flex items-center gap-2 text-[13px] text-[#666666] font-medium">
                  <span>Stage 2</span>
                  <span>·</span>
                  <span>Last met Thu 4/30</span>
                </div>
              </div>

              <button className="w-full bg-[#164E36] text-white rounded-full py-3.5 px-4 font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#0f3825] transition-colors">
                Continue session <ChevronRight className="w-4 h-4" />
              </button>

              {/* Insights */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">Insights</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <span className="text-[#164E36] font-bold text-sm">1</span>
                    <p className="text-[14px] leading-relaxed border-l-2 border-[#164E36] pl-3 py-0.5">
                      You named perfectionism as the reason you avoid starting the report.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[#164E36] font-bold text-sm">2</span>
                    <p className="text-[14px] leading-relaxed border-l-2 border-[#164E36] pl-3 py-0.5">
                      Rest still feels like something you have to earn.
                    </p>
                  </div>
                </div>
              </div>

              {/* Commitments */}
              <div className="space-y-3 pt-4 border-t border-[#E5E5E0]">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">Commitments</h3>
                  <span className="text-[13px] font-bold text-[#164E36]">1 / 3</span>
                </div>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="w-5 h-5 rounded border-2 border-[#164E36] bg-[#164E36] flex items-center justify-center mt-0.5 flex-shrink-0">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-[15px] leading-tight pt-0.5 line-through text-[#666666]">
                      10-minute walk before noon
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="w-5 h-5 rounded border-2 border-[#E5E5E0] mt-0.5 flex-shrink-0 group-hover:border-[#164E36] transition-colors" />
                    <span className="text-[15px] leading-tight pt-0.5">
                      Text Mom back
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="w-5 h-5 rounded border-2 border-[#E5E5E0] mt-0.5 flex-shrink-0 group-hover:border-[#164E36] transition-colors" />
                    <span className="text-[15px] leading-tight pt-0.5">
                      Note one thing that landed in Thursday's session
                    </span>
                  </label>
                </div>
              </div>

              {/* Recommended next step */}
              <div className="bg-[#EAEAEA] p-5 rounded-lg border-l-4 border-[#164E36]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#164E36] mb-2">Try this</h4>
                <p className="text-[15px] italic leading-relaxed text-[#1A1A1A]">
                  "Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone."
                </p>
              </div>
            </section>

            {/* Progress link */}
            <section className="pt-2 border-t border-[#E5E5E0]">
              <button className="w-full flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-[#164E36]" />
                  <span className="text-[15px] font-bold">View full progress</span>
                </div>
                <ChevronRight className="w-5 h-5 text-[#666666] group-hover:translate-x-1 transition-transform" />
              </button>
            </section>

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
