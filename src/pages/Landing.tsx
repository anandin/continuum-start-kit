import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';

type AudienceTab = 'individuals' | 'experts';

export default function Landing() {
  const [activeTab, setActiveTab] = useState<AudienceTab>('individuals');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="container mx-auto flex items-center justify-between px-4 py-6">
        <h1 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Bloom
          </span>
        </h1>
        <Link to="/auth">
          <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
            Sign In
          </Button>
        </Link>
      </nav>

      {/* Audience Toggle */}
      <div className="container mx-auto px-4 pt-12">
        <div className="mx-auto flex w-fit rounded-full border border-white/20 bg-slate-900/50 p-1 backdrop-blur">
          <button
            onClick={() => setActiveTab('individuals')}
            className={`rounded-full px-8 py-3 text-sm font-medium transition-all ${
              activeTab === 'individuals'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            For Individuals
          </button>
          <button
            onClick={() => setActiveTab('experts')}
            className={`rounded-full px-8 py-3 text-sm font-medium transition-all ${
              activeTab === 'experts'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            For Experts
          </button>
        </div>
      </div>

      {/* Hero Section - Individuals */}
      {activeTab === 'individuals' && (
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
              Unlock Your Potential,{' '}
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                24/7
              </span>
            </h2>
            <p className="mb-8 text-xl text-slate-300 md:text-2xl">
              Bloom provides you with a dedicated AI partner, cloned from world-class
              experts, to guide you on your personal growth journey.
            </p>
            <Link to="/auth">
              <Button 
                size="lg" 
                className="group bg-gradient-to-r from-purple-500 to-purple-600 text-lg hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/50"
              >
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Features Grid - Individuals */}
          <div className="mx-auto mt-24 grid max-w-6xl gap-6 md:grid-cols-3">
            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Personalized Guidance</h3>
              <p className="text-slate-400">
                Receive support tailored to your unique goals and challenges, anytime you need it.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Expert Methodologies</h3>
              <p className="text-slate-400">
                Engage with AI trained on the proven frameworks of leading therapists, coaches, and strategists.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Persistent & Private</h3>
              <p className="text-slate-400">
                Your journey is continuous. Your AI partner remembers your conversations in a secure and private space.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Experts */}
      {activeTab === 'experts' && (
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
              Scale Your Expertise.{' '}
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Transform Lives.
              </span>
            </h2>
            <p className="mb-8 text-xl text-slate-300 md:text-2xl">
              Join Bloom to create an AI version of your methodology, providing 24/7
              support to your clients and unlocking new levels of impact.
            </p>
            <Link to="/auth">
              <Button 
                size="lg" 
                className="group bg-gradient-to-r from-purple-500 to-purple-600 text-lg hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/50"
              >
                Enter Expert Dashboard
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Features Grid - Experts */}
          <div className="mx-auto mt-24 grid max-w-6xl gap-6 md:grid-cols-3">
            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Extend Your Reach</h3>
              <p className="text-slate-400">
                Offer continuous support to your clients, reinforcing your guidance between sessions.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Deeper Client Insights</h3>
              <p className="text-slate-400">
                Gain AI-powered summaries of client progress and sticking points to make your sessions more effective.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur transition-all hover:border-purple-500/50 hover:bg-slate-900/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Monetize Your IP</h3>
              <p className="text-slate-400">
                Package your unique intellectual property into a scalable AI product on the Bloom platform.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; 2025 Bloom. Built with care for your growth journey.</p>
        </div>
      </footer>
    </div>
  );
}
