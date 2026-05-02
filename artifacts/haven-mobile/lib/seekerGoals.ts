import AsyncStorage from "@react-native-async-storage/async-storage";

export const SEEKER_DONE_KEY = "haven.seekerCheckedGoals";

export async function loadSeekerDone(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(SEEKER_DONE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export async function persistSeekerDone(
  state: Record<string, boolean>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEKER_DONE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
