import React, { useState } from "react";
import { User, MessageSquare, Target, Book, Home, ChevronRight, Check, Activity, Battery, ArrowRight, ChevronDown, Moon } from "lucide-react";

export function LateNight() {
  const [goalsOpen, setGoalsOpen] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 p-4 font-sans selection:bg-[#E5B567]/30">
      <div 
        className="relative w-[390px] h-[844px] overflow-hidden rounded-[40px] border border-[#2a241e] shadow-2xl flex flex-col"
        style={{ 
          backgroundColor: "#16110D",
          color: "#E8DFD0"
        }}
      >
        {/* Status Bar (Simulated) */}
        <div className="h-12 w-full flex items-center justify-between px-6 text-[13px] font-medium opacity-60">
          <span>11:47</span>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Top Bar */}
        <div className="px-6 pt-2 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-80">
            <Moon className="w-4 h-4" />
            <span className="font-semibold text-sm tracking-wide">Haven</span>
          </div>
          <button className="w-8 h-8 rounded-full bg-[#1e1713] flex items-center justify-center opacity-70">
            <User className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-10 no-scrollbar">
          
          {/* Greeting */}
          <div className="space-y-2">
            <h1 className="text-3xl font-medium tracking-tight">Late evening, Alex.</h1>
            <p className="text-[15px] opacity-60 leading-relaxed max-w-[90%]">
              Last session was Thursday. You can pick up where you left off, or just sit a moment.
            </p>
            <p className="text-xs uppercase tracking-widest opacity-40 pt-2 font-medium">
              7 sessions · Stage 2 · Last Thu
            </p>
          </div>

          <div className="w-full h-px bg-[#E8DFD0] opacity-10"></div>

          {/* Mood Check-in */}
          <div className="space-y-4">
            <h2 className="text-[15px] font-medium opacity-80">Where are you right now?</h2>
            
            <div className="flex flex-wrap gap-2">
              {['steady', 'tired', 'raw', 'spiraling', 'numb'].map(word => (
                <button 
                  key={word}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    word === 'steady' 
                      ? 'border-[#E8DFD0]/20 bg-[#1e1713] text-[#E8DFD0]' 
                      : 'border-transparent opacity-40 hover:opacity-70'
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>

            <div className="bg-[#1a140f] p-4 rounded-xl border border-[#E8DFD0]/5 text-sm opacity-70 leading-relaxed">
              "Slept badly. Long meeting at 2."
            </div>

            {/* Micro sparkline simulated with SVG */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs opacity-30">14 days</span>
              <svg width="60" height="12" viewBox="0 0 60 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                <path d="M0 6L6 9L12 9L18 12L24 6L30 9L36 12L42 9L48 9L54 6L60 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="24" cy="6" r="1.5" fill="currentColor"/>
              </svg>
            </div>
          </div>

          <div className="w-full h-px bg-[#E8DFD0] opacity-10"></div>

          {/* Session Companion */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-[15px] font-medium opacity-80">With Dr. Maya Chen</h2>
              <p className="text-[13px] opacity-50">You're in Stage 2 — moving through avoidance.</p>
            </div>

            <div className="space-y-3">
              <div className="text-sm leading-relaxed opacity-70 border-l border-[#E5B567]/30 pl-3">
                "You named perfectionism as the reason you avoid starting the report."
              </div>
              <div className="bg-[#1a140f] p-4 rounded-xl border border-[#E8DFD0]/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-[#E5B567]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-[#E5B567]">Try this tonight</span>
                </div>
                <p className="text-sm leading-relaxed opacity-80">
                  Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setGoalsOpen(!goalsOpen)}
              className="flex items-center justify-between w-full py-2 group"
            >
              <span className="text-sm opacity-50 group-hover:opacity-80 transition-opacity">3 things you set for today</span>
              <ChevronDown className={`w-4 h-4 opacity-30 transition-transform ${goalsOpen ? 'rotate-180' : ''}`} />
            </button>

            {goalsOpen && (
              <div className="space-y-3 pt-2 opacity-70">
                <label className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-sm border border-[#E8DFD0]/30 flex items-center justify-center bg-[#E8DFD0]/10">
                    <Check className="w-3 h-3 text-[#E8DFD0]" />
                  </div>
                  <span className="text-sm line-through opacity-50">10-minute walk before noon</span>
                </label>
                <label className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-sm border border-[#E8DFD0]/30 flex items-center justify-center">
                  </div>
                  <span className="text-sm">Text Mom back</span>
                </label>
                <label className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-sm border border-[#E8DFD0]/30 flex items-center justify-center">
                  </div>
                  <span className="text-sm">Note one thing that landed in Thursday's session</span>
                </label>
              </div>
            )}

            <button className="flex items-center justify-between w-full py-3 px-4 rounded-xl bg-[#E5B567]/10 border border-[#E5B567]/20 hover:bg-[#E5B567]/15 transition-colors group mt-4">
              <span className="text-sm font-medium text-[#E5B567]">Continue conversation</span>
              <ArrowRight className="w-4 h-4 text-[#E5B567] opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="w-full h-px bg-[#E8DFD0] opacity-10"></div>

          {/* Progress Link */}
          <button className="flex items-center justify-between w-full py-2 group">
            <span className="text-sm font-medium opacity-60 group-hover:opacity-90 transition-opacity">View full progress</span>
            <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-60 transition-opacity group-hover:translate-x-0.5" />
          </button>
          
        </div>

        {/* Tab Bar */}
        <div className="absolute bottom-0 w-full h-20 bg-[#16110D]/95 backdrop-blur-md border-t border-[#E8DFD0]/5 flex items-start justify-between px-6 pt-4">
          <button className="flex flex-col items-center gap-1.5 opacity-90">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Goals</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
            <Book className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Journal</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Profile</span>
          </button>
        </div>

        {/* Home Indicator (Simulated) */}
        <div className="absolute bottom-2 w-full flex justify-center">
          <div className="w-32 h-1 rounded-full bg-[#E8DFD0] opacity-20"></div>
        </div>

      </div>
    </div>
  );
}
