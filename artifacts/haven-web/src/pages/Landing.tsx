import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  Shield,
  Leaf,
  Users,
  BookOpen,
  BarChart3,
} from "lucide-react";

type AudienceTab = "individuals" | "experts";

export default function Landing() {
  const [activeTab, setActiveTab] = useState<AudienceTab>("individuals");

  return (
    <div className="min-h-screen bg-background">
      <nav className="container mx-auto flex items-center justify-between gap-4 flex-wrap px-4 py-6">
        <h1
          className="text-2xl font-bold text-gradient-primary"
          data-testid="text-brand-name"
        >
          Haven
        </h1>
        <Link to="/auth" data-testid="link-sign-in">
          <Button variant="outline">Sign In</Button>
        </Link>
      </nav>

      <section className="bg-gradient-warm-hero" data-testid="section-hero">
        <div className="container mx-auto px-4 pt-10 pb-6">
          <div className="mx-auto flex w-fit rounded-md border border-border bg-card p-1 shadow-warm">
            <button
              onClick={() => setActiveTab("individuals")}
              data-testid="button-tab-individuals"
              className={`rounded-sm px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "individuals"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              For Individuals
            </button>
            <button
              onClick={() => setActiveTab("experts")}
              data-testid="button-tab-experts"
              className={`rounded-sm px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "experts"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              For Experts
            </button>
          </div>
        </div>

        {activeTab === "individuals" && (
          <div className="container mx-auto px-4 py-16 md:py-24 animate-fade-in">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl"
                data-testid="text-hero-title"
              >
                A caring companion,{" "}
                <span className="text-gradient-primary">
                  always by your side
                </span>
              </h2>
              <p
                className="mb-10 text-lg text-muted-foreground md:text-xl leading-relaxed max-w-2xl mx-auto"
                data-testid="text-hero-subtitle"
              >
                Haven pairs you with an AI companion shaped by world-class
                therapists and coaches — here for you 24/7, between sessions and
                beyond.
              </p>
              <Link to="/auth" data-testid="link-hero-cta">
                <Button size="lg" className="text-base">
                  Begin Your Journey
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-companion"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Always By Your Side
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A caring companion available whenever you need support — day
                  or night, between sessions.
                </p>
              </Card>

              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-wisdom"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Leaf className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Expert-Guided Wisdom
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your AI companion is shaped by leading therapists, coaches,
                  and experts in their field.
                </p>
              </Card>

              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-journey"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Your Story, Remembered
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your companion remembers your journey, creating continuity and
                  depth in every conversation.
                </p>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "experts" && (
          <div className="container mx-auto px-4 py-16 md:py-24 animate-fade-in">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl"
                data-testid="text-hero-title-experts"
              >
                Extend your care,{" "}
                <span className="text-gradient-primary">
                  amplify your impact
                </span>
              </h2>
              <p
                className="mb-10 text-lg text-muted-foreground md:text-xl leading-relaxed max-w-2xl mx-auto"
                data-testid="text-hero-subtitle-experts"
              >
                Train an AI companion with your methodology. It walks alongside
                your clients daily, reinforcing your guidance when you can't be
                there.
              </p>
              <Link to="/auth" data-testid="link-hero-cta-experts">
                <Button size="lg" className="text-base">
                  Create Your Haven
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-between-sessions"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Care Between Sessions
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your AI companion provides continuous support, reinforcing
                  your guidance when you can't be there.
                </p>
              </Card>

              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-insights"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  See Their Journey
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gain AI-powered insights into client progress and sticking
                  points to make your sessions more effective.
                </p>
              </Card>

              <Card
                className="p-6 bg-gradient-warm-card hover-elevate"
                data-testid="card-feature-scale"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Scale Your Methodology
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Package your unique expertise into an AI companion that
                  extends your reach to more people.
                </p>
              </Card>
            </div>
          </div>
        )}
      </section>

      <section
        className="bg-background py-20"
        data-testid="section-how-it-works"
      >
        <div className="container mx-auto px-4">
          <h2
            className="mb-4 text-center text-3xl font-bold text-foreground"
            data-testid="text-how-title"
          >
            How Haven Works
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
            A gentle, guided path to growth — designed with care at every step.
          </p>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            <div
              className="text-center animate-slide-up"
              data-testid="step-connect"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent/15 text-xl font-bold text-accent-foreground">
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
              data-testid="step-grow"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent/15 text-xl font-bold text-accent-foreground">
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
              data-testid="step-thrive"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent/15 text-xl font-bold text-accent-foreground">
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

      <section className="bg-gradient-warm py-20" data-testid="section-trust">
        <div className="container mx-auto px-4">
          <h2
            className="mb-14 text-center text-3xl font-bold text-foreground"
            data-testid="text-trust-title"
          >
            Built on Trust
          </h2>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <Card
              className="p-6 text-center hover-elevate"
              data-testid="card-trust-private"
            >
              <Shield className="mx-auto mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">
                Private & Secure
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your conversations are confidential. We treat your data with the
                same care your therapist would.
              </p>
            </Card>

            <Card
              className="p-6 text-center hover-elevate"
              data-testid="card-trust-expert"
            >
              <Heart className="mx-auto mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">
                Expert-Informed
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every interaction is guided by real professionals who care about
                your well-being.
              </p>
            </Card>

            <Card
              className="p-6 text-center hover-elevate"
              data-testid="card-trust-pace"
            >
              <Leaf className="mx-auto mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">
                Your Pace, Always
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No rushing, no pressure. Haven adapts to you and meets you where
                you are.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section
        className="bg-gradient-warm-accent py-16"
        data-testid="section-cta"
      >
        <div className="container mx-auto px-4 text-center">
          <h2
            className="mb-4 text-3xl font-bold text-primary-foreground"
            data-testid="text-cta-title"
          >
            Your journey begins here
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-primary-foreground/80">
            Whether you're seeking support or offering it, Haven is your safe
            space for meaningful growth.
          </p>
          <Link to="/auth" data-testid="link-cta-start">
            <Button
              size="lg"
              variant="outline"
              className="bg-white/15 border-white/30 text-primary-foreground backdrop-blur"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer
        className="border-t border-border bg-background py-8"
        data-testid="section-footer"
      >
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p data-testid="text-copyright">
            &copy; 2025 Haven. Your safe space for growth.
          </p>
        </div>
      </footer>
    </div>
  );
}
