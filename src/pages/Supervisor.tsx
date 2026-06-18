import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { useSupervisorDashboard } from '@/hooks/useSupervisorDashboard';
import { SupervisorSummaryCards } from '@/components/supervisor/SupervisorSummaryCards';
import { SupervisorUsersTable } from '@/components/supervisor/SupervisorUsersTable';
import { SupervisorTimeline } from '@/components/supervisor/SupervisorTimeline';
import { SupervisorFilters } from '@/components/supervisor/SupervisorFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Supervisor() {
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [userId, setUserId] = useState('');
  const [days, setDays] = useState(7);

  const { users, events, topPages, summary, isLoading, error, refetch } = useSupervisorDashboard({
    search,
    eventType: eventType || undefined,
    userId: userId || undefined,
    days,
  });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Erro ao carregar painel: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <SectionHeader
          title="Supervisão de Atividades"
          description="Monitoramento interno Click Hero — último acesso, páginas e ações importantes de todos os usuários."
        />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SupervisorSummaryCards
            totalUsers={summary.totalUsers}
            activeToday={summary.activeToday}
            lastGlobalLogin={summary.lastGlobalLogin}
            topPages={topPages}
          />

          <SupervisorFilters
            search={search}
            onSearchChange={setSearch}
            eventType={eventType}
            onEventTypeChange={setEventType}
            userId={userId}
            onUserIdChange={setUserId}
            days={days}
            onDaysChange={setDays}
            users={users}
          />

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <SupervisorTimeline events={events} />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
              <SupervisorUsersTable
                users={users.filter((u) => {
                  if (!search.trim()) return true;
                  const term = search.trim().toLowerCase();
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
                  return (
                    name.includes(term) ||
                    u.email.toLowerCase().includes(term) ||
                    (u.company_name?.toLowerCase().includes(term) ?? false)
                  );
                })}
                selectedUserId={userId || undefined}
                onSelectUser={(id) => setUserId(id)}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
