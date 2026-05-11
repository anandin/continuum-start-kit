import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Shield, Leaf } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-warm-hero">
      <nav className="container mx-auto flex items-center justify-between gap-4 flex-wrap px-6 py-6">
        <div className="flex items-center gap-2">
          <svg width={22} height={26} viewBox="0 0 24 28" fill="none">
            <path
              d="M12 1 L22 7 L22 17 Q22 24 12 27 Q2 24 2 17 L2 7 Z"
              fill="hsl(8 42% 60% / 0.18)"
              stroke="hsl(8 42% 60%)"
              strokeWidth={1.5}
            />
          </svg>
          <span className="font-serif text-2xl text-foreground tracking-tight">
            Haven
          </span>
        </div>
        <Link to="/auth" data-testid="link-sign-in">
          <Button variant="outline" className="rounded-full px-6">
            Sign In
          </Button>
        </Link>
      </nav>

      <section className="container mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-hand text-2xl text-primary mb-2">hi, you.</p>
          <h2
            className="font-serif text-4xl md:text-6xl font-normal text-foreground leading-tight tracking-tight mb-6"
            data-testid="text-hero-title"
          >
            A caring companion,{" "}
            <span className="text-gradient-primary">always by your side</span>
          </h2>
          <p
            className="font-serif italic text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10"
            data-testid="text-hero-subtitle"
          >
            Haven pairs you with an AI companion shaped by world-class
            therapists and coaches — here for you 24/7, between sessions and
            beyond.
          </p>
          <Link to="/auth" data-testid="link-hero-cta">
            <Button
              size="lg"
              className="text-base rounded-full px-8 h-12 shadow-warm-lg"
            >
              Begin Your Journey
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            No rush. You can move at your pace.
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-6 md:grid-cols-3">
          <div className="p-6 rounded-2xl bg-card border border-border hover-elevate">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Always Here
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              2am, Tuesday lunch, before a meeting. A caring companion available
              whenever you need support.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border hover-elevate">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Trained by Experts
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A licensed therapist reviews everything. Your AI companion is
              shaped by real clinical expertise.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border hover-elevate">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Yours, Privately
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nothing leaves this app without you saying so. Your privacy and
              safety are our priority.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="container mx-auto px-6">
          <p className="font-hand text-xl text-primary text-center mb-2">
            how it works
          </p>
          <h2 className="mb-4 text-center font-serif text-3xl font-normal text-foreground">
            A Gentle Path to Growth
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
            Designed with care at every step.
          </p>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            <div className="text-center animate-slide-up">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                1
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Connect
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Share a little about yourself and what you're working through.
                No pressure, no judgment.
              </p>
            </div>

            <div
              className="text-center animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                2
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Grow
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your companion walks with you daily, offering expert-guided
                support exactly when you need it.
              </p>
            </div>

            <div
              className="text-center animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                3
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Thrive
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Track your progress, celebrate milestones, and build lasting
                habits that serve you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-warm-accent py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 font-serif text-3xl font-normal text-primary-foreground">
            Your journey begins here
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-primary-foreground/80 font-serif italic">
            Whether you're seeking support or offering it, Haven is your safe
            space for meaningful growth.
          </p>
          <Link to="/auth" data-testid="link-cta-start">
            <Button
              size="lg"
              variant="outline"
              className="bg-white/15 border-white/30 text-primary-foreground backdrop-blur rounded-full px-8"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Haven. Your safe space for growth.</p>
        </div>
      </footer>
    </div>
  );
}
