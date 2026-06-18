import { supabase } from '@/integrations/supabase/client';

export type ActivityEventType = 'login' | 'logout' | 'page_view' | 'action';

export interface ActivityLogInput {
  eventType: ActivityEventType;
  action?: string;
  path?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityEventInsert {
  user_id: string;
  company_id: string | null;
  event_type: ActivityEventType;
  action: string | null;
  path: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
}

let activityContext: { userId: string; companyId: string | null } | null = null;

export function setActivityContext(context: { userId: string; companyId: string | null } | null) {
  activityContext = context;
}

export function buildActivityEventPayload(
  input: ActivityLogInput,
  context: { userId: string; companyId: string | null },
): ActivityEventInsert {
  return {
    user_id: context.userId,
    company_id: context.companyId,
    event_type: input.eventType,
    action: input.action ?? null,
    path: input.path ?? null,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {},
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const context = activityContext ?? {
      userId: session.user.id,
      companyId: null,
    };

    const payload = buildActivityEventPayload(input, context);

    const { error } = await supabase.from('user_activity_events').insert(payload);
    if (error) {
      console.warn('[activityLog] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[activityLog] unexpected error:', err);
  }
}

export async function touchLastLoginAt(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('[activityLog] last_login_at update failed:', error.message);
    }
  } catch (err) {
    console.warn('[activityLog] last_login_at unexpected error:', err);
  }
}
