import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuthUser } from '@/contexts/AuthContext';

export const authProfileQueryKey = (userId: string) => ['auth-profile', userId] as const;

/** Colunas explícitas — password_hash nunca trafega para o browser. */
const AUTH_PROFILE_SELECT =
  'id, email, first_name, last_name, company_id, role, is_active, avatar_url, phone, created_at, updated_at, last_login_at, company:companies(id, name, slug, subscription_plan, status)';

/** Safety cap so bootstrap never waits indefinitely on a slow Supabase round-trip. */
export const AUTH_PROFILE_FETCH_TIMEOUT_MS = 10_000;

async function fetchAuthProfileInternal(authUserId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select(AUTH_PROFILE_SELECT)
    .eq('id', authUserId)
    .maybeSingle();

  if (error) {
    console.error('[Auth] Error fetching user profile:', error);
    return null;
  }

  if (!data) {
    console.warn('[Auth] User not found in public.users table');
    return null;
  }

  return data as AuthUser;
}

export async function fetchAuthProfile(authUserId: string): Promise<AuthUser | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('[Auth] Profile fetch timed out after', AUTH_PROFILE_FETCH_TIMEOUT_MS, 'ms');
      resolve(null);
    }, AUTH_PROFILE_FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([fetchAuthProfileInternal(authUserId), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function useAuthProfile(userId: string | undefined) {
  return useQuery({
    queryKey: authProfileQueryKey(userId ?? ''),
    queryFn: () => fetchAuthProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useInvalidateAuthProfile() {
  const queryClient = useQueryClient();
  return (userId: string) =>
    queryClient.invalidateQueries({ queryKey: authProfileQueryKey(userId) });
}
