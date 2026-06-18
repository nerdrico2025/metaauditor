import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Bell,
    Check,
    AlertTriangle,
    TrendingDown,
    DollarSign,
    Image,
    Loader2,
    Trash2,
    CheckCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    metadata?: any;
}

export default function NotificationsPanel() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;
    const [isOpen, setIsOpen] = useState(false);

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications', companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as Notification[];
        },
        enabled: !!companyId && isOpen,
        refetchInterval: isOpen ? 30000 : false,
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', companyId] });
        },
    });

    const markAllAsRead = useMutation({
        mutationFn: async () => {
            if (!companyId) return;
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('company_id', companyId)
                .eq('read', false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', companyId] });
        },
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'creative_fatigue':
                return <TrendingDown className="w-4 h-4 text-yellow-500" />;
            case 'spend_alert':
                return <DollarSign className="w-4 h-4 text-red-500" />;
            case 'audit_issue':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default:
                return <Bell className="w-4 h-4 text-muted-foreground" />;
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-popover border-border" align="end">
                <div className="flex items-center justify-between p-3 border-b border-border">
                    <h3 className="font-semibold text-foreground">Notificações</h3>
                    {notifications.some(n => !n.read) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllAsRead.mutate()}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            <CheckCheck className="w-4 h-4 mr-1" />
                            Marcar todas como lidas
                        </Button>
                    )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                    ) : notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${!notification.read ? 'bg-muted/30' : ''
                                    }`}
                                onClick={() => !notification.read && markAsRead.mutate(notification.id)}
                            >
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(notification.created_at), {
                                                addSuffix: true,
                                                locale: ptBR,
                                            })}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
