import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsPlatformSupervisor } from '@/contexts/AuthContext';

export interface SupervisorUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  company_id: string | null;
  company_name: string | null;
  events_24h: number;
  last_page: string | null;
}

export interface SupervisorEventRow {
  id: string;
  user_id: string;
  company_id: string | null;
  event_type: string;
  action: string | null;
  path: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  company_name: string | null;
}

export interface SupervisorEventFilters {
  userId?: string;
  companyId?: string;
  eventType?: string;
  search?: string;
  days?: number;
}

function displayName(first: string | null, last: string | null, email: string | null): string {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || email || 'Usuário';
}

export function useSupervisorDashboard(filters: SupervisorEventFilters = {}) {
  const isSupervisor = useIsPlatformSupervisor();
  const days = filters.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const usersQuery = useQuery({
    queryKey: ['supervisor-users'],
    queryFn: async (): Promise<SupervisorUserRow[]> => {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, is_active, last_login_at, company_id, company:companies(name)')
        .order('last_login_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const { data: recentEvents, error: eventsError } = await supabase
        .from('user_activity_events')
        .select('user_id, path, created_at, event_type')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      const count24h = new Map<string, number>();
      const lastPage = new Map<string, string>();

      for (const ev of recentEvents ?? []) {
        count24h.set(ev.user_id, (count24h.get(ev.user_id) ?? 0) + 1);
        if (ev.event_type === 'page_view' && ev.path && !lastPage.has(ev.user_id)) {
          lastPage.set(ev.user_id, ev.path);
        }
      }

      return (users ?? []).map((u) => {
        const company = u.company as { name?: string } | null;
        return {
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
          is_active: u.is_active,
          last_login_at: u.last_login_at,
          company_id: u.company_id,
          company_name: company?.name ?? null,
          events_24h: count24h.get(u.id) ?? 0,
          last_page: lastPage.get(u.id) ?? null,
        };
      });
    },
    enabled: isSupervisor,
  });

  const eventsQuery = useQuery({
    queryKey: ['supervisor-events', filters, since],
    queryFn: async (): Promise<SupervisorEventRow[]> => {
      let query = supabase
        .from('user_activity_events')
        .select(`
          id, user_id, company_id, event_type, action, path,
          resource_type, resource_id, metadata, created_at,
          user:users(email, first_name, last_name),
          company:companies(name)
        `)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.companyId) query = query.eq('company_id', filters.companyId);
      if (filters.eventType) query = query.eq('event_type', filters.eventType);

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []).map((row) => {
        const user = row.user as { email?: string; first_name?: string | null; last_name?: string | null } | null;
        const company = row.company as { name?: string } | null;
        return {
          id: row.id,
          user_id: row.user_id,
          company_id: row.company_id,
          event_type: row.event_type,
          action: row.action,
          path: row.path,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          metadata: (row.metadata as Record<string, unknown>) ?? null,
          created_at: row.created_at,
          user_email: user?.email ?? null,
          user_name: displayName(user?.first_name ?? null, user?.last_name ?? null, user?.email ?? null),
          company_name: company?.name ?? null,
        };
      });

      if (filters.search?.trim()) {
        const term = filters.search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.user_name.toLowerCase().includes(term) ||
            (r.user_email?.toLowerCase().includes(term) ?? false) ||
            (r.company_name?.toLowerCase().includes(term) ?? false),
        );
      }

      return rows;
    },
    enabled: isSupervisor,
  });

  const pageViewsQuery = useQuery({
    queryKey: ['supervisor-top-pages', since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_activity_events')
        .select('path')
        .eq('event_type', 'page_view')
        .gte('created_at', since)
        .not('path', 'is', null);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.path) continue;
        counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count }));
    },
    enabled: isSupervisor,
  });

  const users = usersQuery.data ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const activeToday = users.filter((u) => {
    if (!u.last_login_at) return false;
    return new Date(u.last_login_at) >= todayStart;
  }).length;

  const lastGlobalLogin = users.reduce<string | null>((latest, u) => {
    if (!u.last_login_at) return latest;
    if (!latest) return u.last_login_at;
    return new Date(u.last_login_at) > new Date(latest) ? u.last_login_at : latest;
  }, null);

  return {
    users,
    events: eventsQuery.data ?? [],
    topPages: pageViewsQuery.data ?? [],
    summary: {
      totalUsers: users.length,
      activeToday,
      lastGlobalLogin,
    },
    isLoading: usersQuery.isLoading || eventsQuery.isLoading,
    error: usersQuery.error ?? eventsQuery.error,
    refetch: () => {
      void usersQuery.refetch();
      void eventsQuery.refetch();
      void pageViewsQuery.refetch();
    },
  };
}
