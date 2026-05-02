import React from "react";
import { User, Home, MessageCircle, Target, Book, ChevronRight, Check, Square, Heart } from "lucide-react";

export function QuietMorning() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-100 p-4">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');
        
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        .text-brown { color: #3A312A; }
        .text-brown-muted { color: #7A6E62; }
        .bg-brown { background-color: #3A312A; }
        .border-brown { border-color: #3A312A; }
        .bg-paper { background-color: #FBF7EE; }
        .bg-teal { background-color: #298E89; }
        .text-teal { color: #298E89; }
        .border-brown-light { border-color: #E5DDD0; }
        
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      {/* Mobile Device Wrapper */}
      <div className="relative w-[390px] h-[844px] bg-paper overflow-hidden shadow-2xl rounded-[40px] border-[8px] border-neutral-800 text-brown flex flex-col">
        
        {/* Status Bar Mock */}
        <div className="h-12 w-full flex justify-between items-center px-6 pt-2 text-xs font-medium text-brown">
          <span>7:00</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-3 border border-brown rounded-[3px] relative">
              <div className="absolute right-[-3px] top-1 w-0.5 h-1 bg-brown rounded-r-sm"></div>
              <div className="absolute inset-[1px] bg-brown rounded-[1px]"></div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
          
          {/* Top Bar */}
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-brown">
              <Heart className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-serif text-xl font-medium tracking-wide">Haven</span>
            </div>
            <div className="w-8 h-8 rounded-full border border-brown-light flex items-center justify-center">
              <User className="w-4 h-4 text-brown-muted" strokeWidth={1.5} />
            </div>
          </div>

          {/* Greeting */}
          <div className="px-6 pt-6 pb-8">
            <h1 className="font-serif text-[32px] leading-tight text-brown mb-2">Good evening, Alex</h1>
            <p className="text-brown-muted text-[15px] leading-relaxed">
              Your last session was Thursday — you set 3 things to try.
            </p>
          </div>

          <div className="px-6">
            <hr className="border-brown-light" />
          </div>

          {/* At-a-glance */}
          <div className="px-6 py-8 flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium">Sessions</span>
              <span className="font-serif text-lg">7 completed</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium">Stage</span>
              <span className="font-serif text-lg">Working through avoidance</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium">Last Session</span>
              <span className="font-serif text-lg">Thu, Apr 30</span>
            </div>
          </div>

          <div className="px-6">
            <hr className="border-brown-light" />
          </div>

          {/* Check-in */}
          <div className="px-6 py-8">
            <div className="flex justify-between items-end mb-6">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium">Today</span>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs text-brown-muted">Rough</span>
                <span className="text-xs text-brown-muted">Great</span>
              </div>
              <div className="relative h-1 bg-brown-light rounded-full w-full mb-4">
                <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-3 h-3 bg-brown rounded-full border-2 border-paper"></div>
              </div>
              <p className="text-[14px] leading-relaxed text-brown italic border-l border-brown-light pl-4 py-1">
                "Slept badly. Long meeting at 2."
              </p>
            </div>

            {/* 14-day trend sparkline concept */}
            <div className="flex items-end gap-[3px] h-8 mt-6">
              {[4, 3, 3, null, 4, 3, 2, 3, 3, null, 3, 3, 3, 3].map((val, i) => (
                <div key={i} className="flex-1 flex items-end justify-center h-full relative">
                  {val !== null ? (
                    <div 
                      className="w-1.5 bg-[#D6CEBF] rounded-sm" 
                      style={{ height: (val / 5) * 100 + "%" }}
                    ></div>
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-[#EAE2D6] mb-1"></div>
                  )}
                  {i === 13 && (
                    <div 
                      className="absolute bottom-0 w-1.5 bg-brown rounded-sm" 
                      style={{ height: (3 / 5) * 100 + "%" }}
                    ></div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-brown-muted mt-2 text-right">14-day mood</div>
          </div>

          <div className="px-6">
            <hr className="border-brown-light" />
          </div>

          {/* Session Companion */}
          <div className="px-6 py-8">
            <h2 className="font-serif text-[22px] text-brown mb-2">Between sessions</h2>
            <p className="text-[15px] text-brown-muted leading-relaxed mb-8">
              Working with Dr. Maya Chen. Stage 2 of 4 — moving through avoidance.
            </p>

            <div className="mb-8">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium mb-4 block">Insights from Thursday</span>
              <ul className="flex flex-col gap-3">
                <li className="flex gap-3 text-[15px] leading-relaxed text-brown">
                  <span className="text-brown-muted mt-1">—</span>
                  <span>You named perfectionism as the reason you avoid starting the report.</span>
                </li>
                <li className="flex gap-3 text-[15px] leading-relaxed text-brown">
                  <span className="text-brown-muted mt-1">—</span>
                  <span>Rest still feels like something you have to earn.</span>
                </li>
              </ul>
            </div>

            <div className="mb-8">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium mb-4 block">Things to try</span>
              <ul className="flex flex-col gap-4">
                <li className="flex gap-3 items-start">
                  <Check className="w-4 h-4 mt-[3px] text-brown" strokeWidth={2} />
                  <span className="text-[15px] leading-relaxed text-brown line-through opacity-60">10-minute walk before noon</span>
                </li>
                <li className="flex gap-3 items-start">
                  <Square className="w-4 h-4 mt-[3px] text-brown-muted" strokeWidth={1.5} />
                  <span className="text-[15px] leading-relaxed text-brown">Text Mom back</span>
                </li>
                <li className="flex gap-3 items-start">
                  <Square className="w-4 h-4 mt-[3px] text-brown-muted" strokeWidth={1.5} />
                  <span className="text-[15px] leading-relaxed text-brown">Note one thing that landed in Thursday's session</span>
                </li>
              </ul>
            </div>

            <div className="mb-8 p-5 bg-[#F4EFE6] rounded-sm">
              <span className="text-[11px] uppercase tracking-widest text-brown-muted font-medium mb-2 block">Next step</span>
              <p className="text-[15px] leading-relaxed text-brown">
                Try the 4-7-8 breath when you notice your chest tightening tonight, before you reach for your phone.
              </p>
            </div>

            <button className="w-full bg-teal text-white py-4 rounded-sm font-medium text-[15px] flex items-center justify-center gap-2 tracking-wide">
              Continue with Haven
            </button>
          </div>

          <div className="px-6">
            <hr className="border-brown-light" />
          </div>

          {/* Progress Link */}
          <button className="w-full px-6 py-6 flex items-center justify-between text-left group">
            <div>
              <div className="font-serif text-[18px] text-brown mb-1">Deeper progress</div>
              <div className="text-[13px] text-brown-muted">Streak, full goals, and 30-day view</div>
            </div>
            <ChevronRight className="w-4 h-4 text-brown-muted group-hover:text-brown transition-colors" strokeWidth={1.5} />
          </button>
          
        </div>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-0 w-full bg-paper border-t border-brown-light px-6 pb-8 pt-4 flex justify-between items-center z-10">
          <button className="flex flex-col items-center gap-1 w-12 relative">
            <Home className="w-[22px] h-[22px] text-brown" strokeWidth={1.5} />
            <span className="font-serif text-[12px] text-brown absolute -bottom-4">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-12">
            <MessageCircle className="w-[22px] h-[22px] text-brown-muted" strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center gap-1 w-12">
            <Target className="w-[22px] h-[22px] text-brown-muted" strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center gap-1 w-12">
            <Book className="w-[22px] h-[22px] text-brown-muted" strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center gap-1 w-12">
            <User className="w-[22px] h-[22px] text-brown-muted" strokeWidth={1.5} />
          </button>
        </div>

      </div>
    </div>
  );
}
