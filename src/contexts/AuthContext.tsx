import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { Session, AuthError } from '@supabase/supabase-js';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase, User as AppUser } from '@/integrations/supabase/client';
import {
  authProfileQueryKey,
  fetchAuthProfile,
  useAuthProfile,
} from '@/hooks/useAuthProfile';
import { logActivity, setActivityContext, touchLastLoginAt } from '@/lib/activityLog';
import { isPlatformSupervisorEmail } from '@/lib/platformSupervisor';

// Extended user type with company info
export interface AuthUser extends Omit<AppUser, 'password_hash'> {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_id: string | null;
  role: 'super_admin' | 'company_admin' | 'operador' | null;
  is_active: boolean | null;
  company?: {
    id: string;
    name: string;
    slug: string;
    subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise' | null;
    status: 'active' | 'suspended' | 'trial' | 'cancelled' | null;
  } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface SignUpMetadata {
  first_name?: string;
  last_name?: string;
  company_name?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_PROFILE_STALE_MS = 5 * 60 * 1000;

function prefetchAuthProfile(queryClient: QueryClient, authUserId: string) {
  if (queryClient.getQueryData(authProfileQueryKey(authUserId))) return;
  void queryClient.prefetchQuery({
    queryKey: authProfileQueryKey(authUserId),
    queryFn: () => fetchAuthProfile(authUserId),
    staleTime: AUTH_PROFILE_STALE_MS,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const userId = session?.user?.id;

  const { data: profileUser, isPending: profilePending } = useAuthProfile(userId);

  const cachedProfile = userId
    ? (queryClient.getQueryData<AuthUser | null>(authProfileQueryKey(userId)) ?? null)
    : null;

  const user = profileUser ?? cachedProfile;

  const loading = useMemo(() => {
    if (!authReady) return true;
    if (!userId) return false;
    if (user) return false;
    return profilePending;
  }, [authReady, userId, user, profilePending]);

  const refreshUser = async () => {
    if (userId) {
      await queryClient.fetchQuery({
        queryKey: authProfileQueryKey(userId),
        queryFn: () => fetchAuthProfile(userId),
        staleTime: 0,
      });
    }
  };

  useEffect(() => {
    if (user?.id) {
      setActivityContext({ userId: user.id, companyId: user.company_id ?? null });
    } else {
      setActivityContext(null);
    }
  }, [user?.id, user?.company_id]);

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(initialSession);

        if (initialSession?.user?.id) {
          prefetchAuthProfile(queryClient, initialSession.user.id);
        }
      } catch (err) {
        console.error('[Auth] Error during auth initialization:', err);
      } finally {
        if (mounted) {
          setAuthReady(true);
          initialLoadDone = true;
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!initialLoadDone && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
          return;
        }

        if (!mounted) return;
        setSession(newSession);

        if (event === 'SIGNED_OUT') {
          void logActivity({ eventType: 'logout' });
          queryClient.clear();
          setActivityContext(null);
          return;
        }

        if (event === 'SIGNED_IN' && newSession?.user?.id) {
          void touchLastLoginAt(newSession.user.id);
          void logActivity({ eventType: 'login', path: window.location.pathname });
        }

        if (newSession?.user?.id) {
          prefetchAuthProfile(queryClient, newSession.user.id);
        }
      },
    );

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: SignUpMetadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error };
  };

  const signOut = async () => {
    setSession(null);
    setActivityContext(null);
    queryClient.clear();
    supabase.auth.signOut().catch(() => {});
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return user?.role === 'super_admin';
}

export function useIsCompanyAdmin() {
  const { user } = useAuth();
  return user?.role === 'company_admin' || user?.role === 'super_admin';
}

export function useCompanyId() {
  const { user } = useAuth();
  return user?.company_id;
}

export function useHasActiveSubscription() {
  const { user } = useAuth();
  if (!user?.company) return false;
  return user.company.status === 'active' || user.company.status === 'trial';
}

export function useIsPlatformSupervisor() {
  const { user } = useAuth();
  return isPlatformSupervisorEmail(user?.email);
}
