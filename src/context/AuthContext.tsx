import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TrainingPlan, UserProfile } from "../types";
import { authClient } from "../lib/auth";
import { ApiError, api } from "../lib/api";

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>["user"];

interface AuthContextType {
  user: SessionUser | null;
  plan: TrainingPlan | null;
  isLoading: boolean;
  /** True until the first fetch of the signed-in user's plan has finished (so pages don't treat "not loaded yet" as "no plan"). */
  isPlanLoading: boolean;
  /** Set when the plan couldn't be loaded (backend down, timeout, server error). Not the same as "no plan yet". */
  planError: string | null;
  saveProfile: (
    profile: Omit<UserProfile, "userId" | "updatedAt">,
  ) => Promise<void>;
  generatePlan: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [neonUser, setNeonUser] = useState<SessionUser | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const userId = neonUser?.id;

  useEffect(() => {
    async function loadUser() {
      try {
        const result = await authClient.getSession();
        if (result && result.data?.user) {
          setNeonUser(result.data.user);
        } else {
          setNeonUser(null);
        }
      } catch {
        setNeonUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  // refreshData BEFORE the second useEffect
  const refreshData = useCallback(async () => {
    if (!userId || isRefreshingRef.current) return;

    isRefreshingRef.current = true;

    try {
      // The backend identifies the user from the auth token.
      const planData = await api.getCurrentPlan();
      setPlanError(null);
      if (planData) {
        setPlan({
          id: planData.id,
          userId: planData.userId,
          overview: planData.planJson.overview,
          weeklySchedule: planData.planJson.weeklySchedule,
          progression: planData.planJson.progression,
          version: planData.version,
          createdAt: planData.createdAt,
        });
      }
    } catch (error) {
      // Couldn't load is not the same as "no plan": keep any plan already shown, and let pages show a retry
      // instead of sending a returning user back to the questionnaire.
      console.error("Error refreshing data:", error);
      setPlanError(error instanceof ApiError ? error.message : "Couldn't load your plan. Please try again.");
    } finally {
      isRefreshingRef.current = false;
      setIsPlanLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isLoading) {
      if (userId) {
        refreshData();
      } else {
        setPlan(null);
        setPlanError(null);
        setIsPlanLoading(false);
      }
      setIsLoading(false);
    }
  }, [userId, isLoading, refreshData]);

  async function saveProfile(
    profileData: Omit<UserProfile, "userId" | "updatedAt">,
  ) {
    if (!neonUser) {
      throw new Error("User must be authenticated to save profile");
    }
    await api.saveProfile(profileData);
  }

  async function generatePlan() {
    if (!neonUser) {
      throw new Error("User must be authenticated to generate plan");
    }
    await api.generatePlan();
    await refreshData();
  }

  return (
    <AuthContext.Provider
      value={{
        user: neonUser,
        plan,
        isLoading,
        isPlanLoading,
        planError,
        saveProfile,
        generatePlan,
        refreshData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// The hook lives next to its provider on purpose; Fast Refresh just does a full reload for this file.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
