import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Engagement {
  id: string;
  created_at: string;
  status: string;
  seeker: {
    id: string;
  };
  provider: {
    id: string;
    email: string;
  };
  sessions: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    status: string;
    initial_stage: string | null;
    summaries: Array<{
      assigned_stage: string;
      trajectory_status: string;
      session_summary: string;
    }>;
  }>;
}

export function useEngagements(userId: string | undefined, role: 'provider' | 'seeker') {
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  useEffect(() => {
    if (!userId) return;
    loadEngagements();
  }, [userId, role]);

  const loadEngagements = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('engagements')
        .select(`
          id,
          created_at,
          status,
          seeker:seekers (
            id
          ),
          provider:profiles (
            id,
            email
          ),
          sessions (
            id,
            started_at,
            ended_at,
            status,
            initial_stage,
            summaries (
              assigned_stage,
              trajectory_status,
              session_summary
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (role === 'provider') {
        query = query.eq('provider_id', userId);
      } else {
        // For seekers, filter by owner_id through the seeker relationship
        query = query.eq('seekers.owner_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEngagements((data as any) || []);
    } catch (error: any) {
      console.error('Error loading engagements:', error);
      toast.error(error.message || 'Failed to load engagements');
    } finally {
      setLoading(false);
    }
  };

  const getSeekerAlias = (engagement: Engagement) => {
    return `Seeker-${engagement.seeker.id.slice(0, 8)}`;
  };

  const getLastSessionDate = (engagement: Engagement) => {
    if (!engagement.sessions || engagement.sessions.length === 0) return 'Never';
    const lastSession = engagement.sessions.sort((a, b) => 
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];
    return new Date(lastSession.started_at).toLocaleDateString();
  };

  const getLatestStage = (engagement: Engagement) => {
    const sessionsWithSummaries = engagement.sessions
      .filter(s => s.summaries && s.summaries.length > 0)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    if (sessionsWithSummaries.length === 0) {
      // Fall back to initial_stage if no summaries
      const lastSession = engagement.sessions.sort((a, b) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0];
      return lastSession?.initial_stage || 'Not assessed';
    }
    return sessionsWithSummaries[0].summaries[0].assigned_stage;
  };

  const getTrajectoryStatus = (engagement: Engagement): string => {
    const sessionsWithSummaries = engagement.sessions
      .filter(s => s.summaries && s.summaries.length > 0)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    if (sessionsWithSummaries.length === 0) return 'steady';

    const latestSummary = sessionsWithSummaries[0].summaries[0];
    return latestSummary.trajectory_status || 'steady';
  };

  return {
    loading,
    engagements,
    getSeekerAlias,
    getLastSessionDate,
    getLatestStage,
    getTrajectoryStatus,
    refetch: loadEngagements
  };
}
