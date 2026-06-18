import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SupervisorUserRow } from '@/hooks/useSupervisorDashboard';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  eventType: string;
  onEventTypeChange: (value: string) => void;
  userId: string;
  onUserIdChange: (value: string) => void;
  days: number;
  onDaysChange: (value: number) => void;
  users: SupervisorUserRow[];
}

export function SupervisorFilters({
  search,
  onSearchChange,
  eventType,
  onEventTypeChange,
  userId,
  onUserIdChange,
  days,
  onDaysChange,
  users,
}: Props) {
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      <Input
        placeholder="Buscar por nome, e-mail ou empresa..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="lg:flex-1"
      />
      <Select value={userId || 'all'} onValueChange={(v) => onUserIdChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-full lg:w-[200px]">
          <SelectValue placeholder="Usuário" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os usuários</SelectItem>
          {users.map((u) => {
            const label = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
            return (
              <SelectItem key={u.id} value={u.id}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Select value={eventType || 'all'} onValueChange={(v) => onEventTypeChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-full lg:w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          <SelectItem value="login">Login</SelectItem>
          <SelectItem value="logout">Logout</SelectItem>
          <SelectItem value="page_view">Página</SelectItem>
          <SelectItem value="action">Ação</SelectItem>
        </SelectContent>
      </Select>
      <Select value={String(days)} onValueChange={(v) => onDaysChange(Number(v))}>
        <SelectTrigger className="w-full lg:w-[140px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Últimas 24h</SelectItem>
          <SelectItem value="7">7 dias</SelectItem>
          <SelectItem value="30">30 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
