import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Briefcase, Search, Settings, Rocket } from 'lucide-react';

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleChangeRole = () => {
    navigate('/auth/role');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Continuum
            </span>
          </h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Welcome Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">
                Welcome back!
              </CardTitle>
              <CardDescription>
                You're signed in as <strong>{user?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
                <div className="rounded-full bg-primary/10 p-3">
                  {profile?.role === 'provider' ? (
                    <Briefcase className="h-6 w-6 text-primary" />
                  ) : (
                    <Search className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Your Role</p>
                  <p className="text-2xl font-bold capitalize">
                    {profile?.role || 'Not set'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleChangeRole}>
                  Change Role
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Role-Specific Content */}
          <Card>
            <CardHeader>
              <CardTitle>
                {profile?.role === 'provider' ? 'Provider Dashboard' : 'Seeker Dashboard'}
              </CardTitle>
              <CardDescription>
                {profile?.role === 'provider'
                  ? 'Manage your services and connect with seekers'
                  : 'Discover providers and find what you need'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {profile?.role === 'provider'
                    ? 'Welcome to your provider dashboard! Here you can manage your offerings, track connections, and grow your business.'
                    : 'Welcome to your seeker dashboard! Browse providers, make connections, and find exactly what you need.'}
                </p>
                
                {profile?.role === 'provider' && (
                  <div className="space-y-2">
                    <Button onClick={() => navigate('/provider/dashboard')} className="w-full">
                      <Briefcase className="mr-2 h-4 w-4" />
                      View Engagements
                    </Button>
                    <Button onClick={() => navigate('/provider/setup')} variant="outline" className="w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Your Program
                    </Button>
                  </div>
                )}
                
                {profile?.role === 'seeker' && (
                  <Button onClick={() => navigate('/onboarding')} className="w-full">
                    <Rocket className="mr-2 h-4 w-4" />
                    Start Your Journey
                  </Button>
                )}
                
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                  <User className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Dashboard content coming soon. This is a production-ready foundation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{user?.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span>{user?.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role:</span>
                <span className="capitalize">{profile?.role || 'Not set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member Since:</span>
                <span>{new Date(profile?.created_at || '').toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
