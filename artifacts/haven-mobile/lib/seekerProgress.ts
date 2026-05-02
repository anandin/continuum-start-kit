import { api } from "./api";

export interface MoodPoint {
  day: string; // YYYY-MM-DD
  score: number;
  note: string | null;
}

export type StreakStatus = "active" | "keep-going" | "none";

export interface SeekerProgressSnapshot {
  sessionsCompleted: number;
  moodSeries: MoodPoint[];
  streak: {
    current: number;
    status: StreakStatus;
    lastCheckInDay: string | null;
  };
  goalsThisWeek: number;
  hasSeekerProfile: boolean;
}

export async function fetchSeekerProgress(): Promise<SeekerProgressSnapshot> {
  return api<SeekerProgressSnapshot>("/api/seeker/progress");
}
