import { describe, expect, it } from 'vitest';
import { buildActivityEventPayload } from './activityLog';

describe('buildActivityEventPayload', () => {
  const context = { userId: 'user-1', companyId: 'company-1' };

  it('maps login event with defaults', () => {
    const payload = buildActivityEventPayload({ eventType: 'login' }, context);
    expect(payload).toMatchObject({
      user_id: 'user-1',
      company_id: 'company-1',
      event_type: 'login',
      action: null,
      path: null,
      resource_type: null,
      resource_id: null,
      metadata: {},
    });
  });

  it('maps page_view with path and action metadata', () => {
    const payload = buildActivityEventPayload(
      {
        eventType: 'page_view',
        path: '/criativos',
        metadata: { title: 'Criativos' },
      },
      context,
    );
    expect(payload.event_type).toBe('page_view');
    expect(payload.path).toBe('/criativos');
    expect(payload.metadata).toEqual({ title: 'Criativos' });
  });

  it('maps action events with resource refs', () => {
    const payload = buildActivityEventPayload(
      {
        eventType: 'action',
        action: 'audit.creative',
        resourceType: 'creative',
        resourceId: 'cr-99',
      },
      context,
    );
    expect(payload.action).toBe('audit.creative');
    expect(payload.resource_type).toBe('creative');
    expect(payload.resource_id).toBe('cr-99');
  });
});
