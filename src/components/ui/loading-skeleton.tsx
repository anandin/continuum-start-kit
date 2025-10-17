import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-12 w-64 bg-slate-800" />
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader>
              <Skeleton className="h-6 w-48 bg-slate-800" />
              <Skeleton className="h-4 w-96 bg-slate-800 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full bg-slate-800" />
              <Skeleton className="h-10 w-full bg-slate-800" />
              <Skeleton className="h-32 w-full bg-slate-800" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Skeleton className="h-8 w-32 bg-slate-800" />
          <Skeleton className="h-10 w-24 bg-slate-800" />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-900/50 border-white/10">
              <CardHeader>
                <Skeleton className="h-6 w-32 bg-slate-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full bg-slate-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
