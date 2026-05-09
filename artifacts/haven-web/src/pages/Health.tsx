import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthStatus {
  frontend: boolean;
  backend: boolean;
  backendTimestamp?: string;
  error?: string;
}

export default function Health() {
  const [status, setStatus] = useState<HealthStatus>({
    frontend: true,
    backend: false,
  });
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);

    try {
      const newStatus: HealthStatus = { frontend: true, backend: false };

      try {
        const res = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (res.ok || res.status === 401) {
          newStatus.backend = true;
          newStatus.backendTimestamp = new Date().toISOString();
        }
      } catch (backendError: any) {
        console.error("Backend health check failed:", backendError);
        newStatus.error = backendError.message;
      }

      setStatus(newStatus);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-warm-hero px-4 py-12"
      data-testid="page-health"
    >
      <div className="container mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-primary">
            System Health
          </h1>
          <p className="text-muted-foreground">
            Real-time status of Haven services
          </p>
        </div>

        <Card className="shadow-warm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>
                  {status.frontend && status.backend
                    ? "All systems operational"
                    : "Checking services..."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={loading}
                data-testid="button-refresh-health"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center justify-between rounded-xl border p-4"
              data-testid="status-frontend"
            >
              <div className="flex items-center gap-3">
                {status.frontend ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Frontend</p>
                  <p className="text-sm text-muted-foreground">React + Vite</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-600">
                {status.frontend ? "Operational" : "Down"}
              </span>
            </div>

            <div
              className="flex items-center justify-between rounded-xl border p-4"
              data-testid="status-backend"
            >
              <div className="flex items-center gap-3">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : status.backend ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Backend (Express)</p>
                  <p className="text-sm text-muted-foreground">
                    {status.backendTimestamp
                      ? `Last check: ${new Date(status.backendTimestamp).toLocaleTimeString()}`
                      : "Express API Server"}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  loading
                    ? "bg-muted text-muted-foreground"
                    : status.backend
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {loading
                  ? "Checking..."
                  : status.backend
                    ? "Operational"
                    : "Down"}
              </span>
            </div>

            {status.error && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">
                  Error Details:
                </p>
                <p className="mt-1 text-xs text-destructive/80">
                  {status.error}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">Overall Status</p>
              <p className="mt-1 text-2xl font-bold">
                {status.frontend && status.backend ? (
                  <span className="text-emerald-600">
                    All Systems Operational
                  </span>
                ) : (
                  <span className="text-destructive">Partial Outage</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            data-testid="button-back-home"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
