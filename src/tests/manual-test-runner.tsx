/**
 * Manual Test Runner Component
 * 
 * This component provides a UI to manually run through the test workflows
 * Add this route temporarily to test: /test-runner
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning';

interface TestStep {
  id: string;
  name: string;
  description: string;
  status: TestStatus;
  error?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
}

export default function ManualTestRunner() {
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: 'workflow1',
      name: 'Provider Setup Flow',
      description: 'Test provider signup, configuration, and agent setup',
      steps: [
        { id: 'provider-signup', name: 'Provider Signup', description: 'Create provider account', status: 'pending' },
        { id: 'role-selection', name: 'Role Selection', description: 'Select provider role', status: 'pending' },
        { id: 'provider-config', name: 'Provider Configuration', description: 'Configure from template', status: 'pending' },
        { id: 'agent-setup', name: 'Agent Setup', description: 'Setup AI agent', status: 'pending' },
      ],
    },
    {
      id: 'workflow2',
      name: 'Seeker Journey Flow',
      description: 'Test seeker signup, onboarding, and AI conversation',
      steps: [
        { id: 'seeker-signup', name: 'Seeker Signup', description: 'Create seeker account', status: 'pending' },
        { id: 'seeker-role', name: 'Seeker Role Selection', description: 'Select seeker role', status: 'pending' },
        { id: 'onboarding', name: 'Onboarding', description: 'Select AI agent', status: 'pending' },
        { id: 'start-session', name: 'Start Session', description: 'Begin chat session', status: 'pending' },
        { id: 'conversation', name: 'AI Conversation', description: 'Exchange messages', status: 'pending' },
        { id: 'end-session', name: 'End Session', description: 'Complete and generate summary', status: 'pending' },
      ],
    },
    {
      id: 'workflow3',
      name: 'Provider Monitoring Flow',
      description: 'Test provider viewing seeker progress',
      steps: [
        { id: 'provider-login', name: 'Provider Login', description: 'Login as provider', status: 'pending' },
        { id: 'view-engagements', name: 'View Engagements', description: 'Check active engagements', status: 'pending' },
        { id: 'review-details', name: 'Review Details', description: 'View engagement details', status: 'pending' },
        { id: 'check-summary', name: 'Check Summary', description: 'Verify AI summary', status: 'pending' },
      ],
    },
  ]);

  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-slate-600" />;
    }
  };

  const getStatusBadge = (status: TestStatus) => {
    const variants: Record<TestStatus, string> = {
      pending: 'bg-slate-700 text-slate-300',
      running: 'bg-purple-500/20 text-purple-300',
      passed: 'bg-green-500/20 text-green-300',
      failed: 'bg-red-500/20 text-red-300',
      warning: 'bg-yellow-500/20 text-yellow-300',
    };
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  const runDatabaseChecks = async () => {
    const checks = [];

    // Check for duplicate roles
    const { data: duplicateRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .then(({ data }) => {
        if (!data) return { data: [] };
        const grouped = data.reduce((acc: any, row: any) => {
          acc[row.user_id] = (acc[row.user_id] || 0) + 1;
          return acc;
        }, {});
        const duplicates = Object.entries(grouped)
          .filter(([_, count]) => (count as number) > 1)
          .map(([user_id]) => ({ user_id }));
        return { data: duplicates };
      });

    checks.push({
      name: 'No Duplicate Roles',
      passed: (duplicateRoles?.length || 0) === 0,
      message: duplicateRoles?.length
        ? `Found ${duplicateRoles.length} users with duplicate roles`
        : 'All users have unique roles',
    });

    // Check provider configs
    const { data: providerConfigs } = await supabase
      .from('provider_configs')
      .select('*');

    checks.push({
      name: 'Provider Configs Exist',
      passed: (providerConfigs?.length || 0) > 0,
      message: `Found ${providerConfigs?.length || 0} provider configurations`,
    });

    // Check agent configs
    const { data: agentConfigs } = await supabase
      .from('provider_agent_configs')
      .select('*');

    checks.push({
      name: 'Agent Configs Exist',
      passed: (agentConfigs?.length || 0) > 0,
      message: `Found ${agentConfigs?.length || 0} agent configurations`,
    });

    return checks;
  };

  const runWorkflow = async (workflowId: string) => {
    setIsRunning(true);
    setSelectedWorkflow(workflowId);

    // Run database checks first
    const dbChecks = await runDatabaseChecks();
    console.log('Database Checks:', dbChecks);

    // Update workflow to show running
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === workflowId
          ? {
              ...wf,
              steps: wf.steps.map((step) => ({ ...step, status: 'pending' as TestStatus })),
            }
          : wf
      )
    );

    // Simulate running through steps
    const workflow = workflows.find((wf) => wf.id === workflowId);
    if (!workflow) return;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      // Update step to running
      setWorkflows((prev) =>
        prev.map((wf) =>
          wf.id === workflowId
            ? {
                ...wf,
                steps: wf.steps.map((s, idx) =>
                  idx === i ? { ...s, status: 'running' as TestStatus } : s
                ),
              }
            : wf
        )
      );

      // Wait for manual verification
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mark as warning (needs manual verification)
      setWorkflows((prev) =>
        prev.map((wf) =>
          wf.id === workflowId
            ? {
                ...wf,
                steps: wf.steps.map((s, idx) =>
                  idx === i ? { ...s, status: 'warning' as TestStatus } : s
                ),
              }
            : wf
        )
      );
    }

    setIsRunning(false);
  };

  const resetWorkflow = (workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === workflowId
          ? {
              ...wf,
              steps: wf.steps.map((step) => ({ ...step, status: 'pending' as TestStatus })),
            }
          : wf
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">Test Runner</h1>
          <p className="text-slate-400">
            Manual test workflows for Bloom platform. Follow the steps in each workflow to verify functionality.
          </p>
        </div>

        <div className="grid gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="bg-slate-900/50 border-white/10">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">{workflow.name}</CardTitle>
                    <CardDescription className="text-slate-400 mt-1">
                      {workflow.description}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => runWorkflow(workflow.id)}
                      disabled={isRunning}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isRunning && selectedWorkflow === workflow.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        'Start'
                      )}
                    </Button>
                    <Button
                      onClick={() => resetWorkflow(workflow.id)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflow.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/30 border border-white/5"
                    >
                      <div className="mt-1">{getStatusIcon(step.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-slate-400 text-sm">Step {index + 1}</span>
                          {getStatusBadge(step.status)}
                        </div>
                        <h3 className="text-white font-medium">{step.name}</h3>
                        <p className="text-slate-400 text-sm mt-1">{step.description}</p>
                        {step.error && (
                          <p className="text-red-400 text-sm mt-2">Error: {step.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-slate-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Test Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h3 className="text-white font-medium mb-2">How to Use This Test Runner:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Click "Start" on a workflow to begin testing</li>
                <li>Each step will be highlighted as you progress</li>
                <li>Manually perform the actions described in each step</li>
                <li>Verify the expected outcomes match the documentation</li>
                <li>Use browser dev tools to check console logs and network requests</li>
                <li>Check database state after completing each workflow</li>
              </ol>
            </div>
            <div className="pt-4 border-t border-white/10">
              <p className="text-sm text-slate-400">
                For detailed step-by-step instructions, refer to{' '}
                <code className="px-2 py-1 bg-slate-800 rounded text-purple-400">
                  src/tests/e2e-workflows.md
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
