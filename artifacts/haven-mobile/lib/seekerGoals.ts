import { api } from "./api";

export interface GoalProgress {
  id: string;
  goalId: string;
  engagementId: string;
  seekerUserId: string;
  note: string | null;
  status: "pending" | "confirmed";
  createdAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

export async function fetchGoalProgress(
  engagementId: string,
): Promise<GoalProgress[]> {
  return api<GoalProgress[]>(`/api/engagements/${engagementId}/goal-progress`);
}

export async function checkOffGoal(
  goalId: string,
  note?: string,
): Promise<GoalProgress> {
  return api<GoalProgress>(`/api/goals/${goalId}/seeker-progress`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function uncheckGoal(goalId: string): Promise<void> {
  await api(`/api/goals/${goalId}/seeker-progress`, { method: "DELETE" });
}

// Convenience: derive the {goalId -> true} map of currently-pending
// self-checkoffs for this seeker. Confirmed entries belong to a goal whose
// status is already "completed", so the UI handles those via goal.status.
export function buildPendingMap(
  rows: GoalProgress[],
  seekerUserId?: string,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const r of rows) {
    if (r.status !== "pending") continue;
    if (seekerUserId && r.seekerUserId !== seekerUserId) continue;
    out[r.goalId] = true;
  }
  return out;
}
