import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  session: { user: User } | null;
  profile: Profile | null;
  role: "provider" | "seeker" | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"provider" | "seeker" | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setRole(data.role);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await fetchProfile();
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
    } catch (error) {
      setUser(null);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        email,
        password,
      });
      const data = await res.json();
      // Fetch the profile (which sets role) BEFORE flipping user → null
      // to authenticated. Otherwise downstream redirect effects fire on a
      // (user-set, role-still-null) state and bounce to /auth/role even
      // for users who already have a role.
      await fetchProfile();
      setUser(data.user);
      return {};
    } catch (error: any) {
      return { error: error.message || "Login failed" };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        email,
        password,
      });
      const data = await res.json();
      // Server now creates a default seeker role on register, so the
      // profile fetch returns role:'seeker' — settle that before we
      // mark the user as authenticated to avoid the same redirect race
      // described in signIn().
      await fetchProfile();
      if (data.role) setRole(data.role);
      setUser(data.user);
      return {};
    } catch (error: any) {
      return { error: error.message || "Registration failed" };
    }
  };

  const signOut = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    setProfile(null);
    setRole(null);
    queryClient.clear();
    navigate("/");
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
