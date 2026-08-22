import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, tokenStore, getActiveBranchId, setActiveBranchId } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterInput {
  email: string;
  password: string;
  password_confirm: string;
  full_name: string;
  phone?: string;
  organization_name?: string;
  branch_name?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!tokenStore.access) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get<User>("/auth/me/");
        if (!cancelled) setUser(data);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post("/auth/login/", { email, password });
    tokenStore.set(data.access, data.refresh);

    // Auto-set active branch from JWT claims (the backend encodes
    // the user's branches + a default active_branch_id into the token).
    try {
      const payload = JSON.parse(atob(data.access.split(".")[1]));
      const branches = payload.branches as Array<{ id: string }> | undefined;
      const defaultBranchId = payload.active_branch_id as string | undefined;
      if (branches?.length) {
        const stored = getActiveBranchId();
        const valid = stored && branches.some((b) => b.id === stored);
        setActiveBranchId(valid ? stored : defaultBranchId ?? branches[0].id);
      }
    } catch {
      /* JWT decode failed — non-fatal */
    }

    const me = await api.get<User>("/auth/me/");
    setUser(me.data);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const payload: RegisterInput = { ...input };
    if (!payload.phone || !payload.phone.trim()) delete payload.phone;
    await api.post("/auth/register/", payload);
    await login(input.email, input.password);
  }, [login]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setActiveBranchId(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<User>("/auth/me/");
      setUser(data);
    } catch { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser }),
    [user, isLoading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
