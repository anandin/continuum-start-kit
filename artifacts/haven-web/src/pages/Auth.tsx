import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const { user, role, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (role) {
        navigate("/dashboard");
      } else {
        navigate("/auth/role");
      }
    }
  }, [user, role, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const { error } = await signUp(email, password);
      if (error) throw new Error(error);

      toast.success("Welcome to Haven! Your journey begins now.");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw new Error(error);

      toast.success("Welcome back! Great to see you again.");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-warm-hero p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-home"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Card className="shadow-warm-lg rounded-2xl border-border/60">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex items-center gap-2">
              <svg width={20} height={24} viewBox="0 0 24 28" fill="none">
                <path
                  d="M12 1 L22 7 L22 17 Q22 24 12 27 Q2 24 2 17 L2 7 Z"
                  fill="hsl(8 42% 60% / 0.18)"
                  stroke="hsl(8 42% 60%)"
                  strokeWidth={1.5}
                />
              </svg>
              <span className="font-serif text-xl text-foreground">Haven</span>
            </div>
            <CardTitle>
              <span
                className="font-hand text-2xl text-primary font-normal"
                data-testid="text-auth-title"
              >
                welcome back
              </span>
            </CardTitle>
            <CardDescription
              className="font-serif italic text-muted-foreground"
              data-testid="text-auth-description"
            >
              Sign in to your safe space
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList
                className="grid w-full grid-cols-2 rounded-full"
                data-testid="tabs-auth"
              >
                <TabsTrigger
                  value="signin"
                  className="rounded-full"
                  data-testid="tab-signin"
                >
                  Welcome Back
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-full"
                  data-testid="tab-signup"
                >
                  Get Started
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    We're glad you're here. Sign in to continue your journey.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-xl"
                      data-testid="input-signin-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-xl"
                      data-testid="input-signin-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-full h-11"
                    disabled={authLoading}
                    data-testid="button-signin"
                  >
                    {authLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Take the first step. Creating an account is quick and easy.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-xl"
                      data-testid="input-signup-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Choose a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="rounded-xl"
                      data-testid="input-signup-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-full h-11"
                    disabled={authLoading}
                    data-testid="button-signup"
                  >
                    {authLoading
                      ? "Creating your space..."
                      : "Create My Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Your privacy and safety are our priority</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
