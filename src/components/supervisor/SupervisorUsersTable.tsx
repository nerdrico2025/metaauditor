import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SupervisorUserRow } from '@/hooks/useSupervisorDashboard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  users: SupervisorUserRow[];
  onSelectUser?: (userId: string) => void;
  selectedUserId?: string;
}

function userLabel(u: SupervisorUserRow): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || u.email;
}

export function SupervisorUsersTable({ users, onSelectUser, selectedUserId }: Props) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead>Última página</TableHead>
            <TableHead className="text-right">Eventos 24h</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow
                key={u.id}
                className={selectedUserId === u.id ? 'bg-muted/50 cursor-pointer' : 'cursor-pointer'}
                onClick={() => onSelectUser?.(u.id)}
              >
                <TableCell>
                  <div className="font-medium">{userLabel(u)}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>{u.company_name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{u.role ?? '—'}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {u.last_login_at
                    ? formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true, locale: ptBR })
                    : 'Nunca'}
                </TableCell>
                <TableCell className="text-sm font-mono">{u.last_page ?? '—'}</TableCell>
                <TableCell className="text-right">{u.events_24h}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
