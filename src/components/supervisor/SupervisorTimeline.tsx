import { Badge } from '@/components/ui/badge';
import type { SupervisorEventRow } from '@/hooks/useSupervisorDashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  events: SupervisorEventRow[];
}

const EVENT_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  page_view: 'Página',
  action: 'Ação',
};

const ACTION_LABELS: Record<string, string> = {
  'audit.creative': 'Auditoria de criativo',
  'audit.batch': 'Auditoria em lote',
  'sync.meta': 'Sync Meta',
  'user.invite': 'Convite de usuário',
  'user.role_change': 'Alteração de role',
  'integration.connect': 'Integração conectada',
  'integration.disconnect': 'Integração desconectada',
};

function describeEvent(ev: SupervisorEventRow): string {
  if (ev.event_type === 'page_view' && ev.path) {
    return `abriu ${ev.path}`;
  }
  if (ev.event_type === 'login') return 'fez login';
  if (ev.event_type === 'logout') return 'fez logout';
  if (ev.action) {
    const label = ACTION_LABELS[ev.action] ?? ev.action;
    if (ev.resource_id) return `${label} (${ev.resource_id})`;
    return label;
  }
  return ev.event_type;
}

export function SupervisorTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
        Nenhum evento no período selecionado.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border divide-y divide-border">
      {events.map((ev) => (
        <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4">
          <div className="text-xs text-muted-foreground shrink-0 w-36">
            {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{ev.user_name}</span>
              {' '}
              <span className="text-muted-foreground">{describeEvent(ev)}</span>
            </p>
            {ev.company_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{ev.company_name}</p>
            )}
          </div>
          <Badge variant="secondary" className="w-fit shrink-0">
            {EVENT_LABELS[ev.event_type] ?? ev.event_type}
          </Badge>
        </div>
      ))}
    </div>
  );
}
