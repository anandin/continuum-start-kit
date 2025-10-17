import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Continuum
              </span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              Connect providers and seekers in a seamless, secure platform. 
              Build meaningful relationships and grow your network.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="group">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/health">
                <Button size="lg" variant="outline">
                  System Status
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 text-center transition-shadow hover:shadow-lg">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Role-Based Access</h3>
            <p className="text-muted-foreground">
              Choose your role as a provider or seeker and access tailored features.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-center transition-shadow hover:shadow-lg">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Magic Link Login</h3>
            <p className="text-muted-foreground">
              Secure, passwordless authentication with email magic links.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-center transition-shadow hover:shadow-lg">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Production Ready</h3>
            <p className="text-muted-foreground">
              Built with React, TypeScript, and Lovable Cloud for scalability.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Continuum. Built with Lovable Cloud.</p>
        </div>
      </footer>
    </div>
  );
}
