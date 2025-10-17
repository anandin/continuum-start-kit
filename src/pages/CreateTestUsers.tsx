import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function CreateTestUsers() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const handleCreateUsers = async () => {
    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('create-test-users');

      if (error) throw error;

      setResults(data.results || []);
      
      const successCount = data.results?.filter((r: any) => r.status === 'success').length || 0;
      
      toast({
        title: '✅ Test Users Created',
        description: `Successfully created ${successCount} test accounts. You can now login with them!`,
      });
    } catch (error: any) {
      console.error('Error creating test users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create test users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Test Users</h1>
          <p className="text-slate-400">
            Generate all test accounts from TEST_ACCOUNTS.md with working login credentials
          </p>
        </div>

        <Card className="p-6 bg-slate-900/50 border-slate-700">
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Test Accounts to Create:</h2>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• 3 Provider accounts (provider1@bloom.test, provider2@bloom.test, provider3@bloom.test)</li>
                <li>• 5 Seeker accounts (seeker1-5@bloom.test)</li>
                <li>• All with password: <code className="bg-slate-800 px-2 py-1 rounded">TestPass123!</code></li>
              </ul>
            </div>

            <Button
              onClick={handleCreateUsers}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Test Users...
                </>
              ) : (
                'Create All Test Users'
              )}
            </Button>
          </div>
        </Card>

        {results.length > 0 && (
          <Card className="p-6 bg-slate-900/50 border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Results:</h2>
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <span className="text-sm text-slate-300">{result.email}</span>
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-400">Created</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-400">{result.error}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 bg-blue-950/30 border-blue-900">
          <h3 className="text-lg font-semibold text-blue-300 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-200 space-y-2">
            <li>✓ All test users will be created in Supabase Auth</li>
            <li>✓ Their profiles and roles are already in the database</li>
            <li>✓ You can immediately login with any account from TEST_ACCOUNTS.md</li>
            <li>✓ Use the /test-runner to verify all workflows</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}