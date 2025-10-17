import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
      // Frontend is always ok if this page loads
      const newStatus: HealthStatus = { frontend: true, backend: false };

      // Check backend edge function
      try {
        const { data, error } = await supabase.functions.invoke('health');
        
        if (error) throw error;
        
        if (data?.ok) {
          newStatus.backend = true;
          newStatus.backendTimestamp = data.timestamp;
        }
      } catch (backendError: any) {
        console.error('Backend health check failed:', backendError);
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
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background px-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              System Health
            </span>
          </h1>
          <p className="text-muted-foreground">
            Real-time status of Bloom services
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>All systems operational</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={loading}
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
            {/* Frontend Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status.frontend ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Frontend</p>
                  <p className="text-sm text-muted-foreground">React + Vite</p>
                </div>
              </div>
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">
                {status.frontend ? 'Operational' : 'Down'}
              </span>
            </div>

            {/* Backend Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : status.backend ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Backend (Edge Function)</p>
                  <p className="text-sm text-muted-foreground">
                    {status.backendTimestamp
                      ? `Last check: ${new Date(status.backendTimestamp).toLocaleTimeString()}`
                      : 'Lovable Cloud Functions'}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  loading
                    ? 'bg-muted text-muted-foreground'
                    : status.backend
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {loading ? 'Checking...' : status.backend ? 'Operational' : 'Down'}
              </span>
            </div>

            {/* Error Display */}
            {status.error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">Error Details:</p>
                <p className="mt-1 text-xs text-destructive/80">{status.error}</p>
              </div>
            )}

            {/* Overall Status */}
            <div className="mt-6 rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">Overall Status</p>
              <p className="mt-1 text-2xl font-bold">
                {status.frontend && status.backend ? (
                  <span className="text-green-500">✓ All Systems Operational</span>
                ) : (
                  <span className="text-destructive">⚠ Partial Outage</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
