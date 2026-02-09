import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sparkles,
    Send,
    Loader2,
    User,
    Bot,
    Megaphone,
    Image,
    FileCheck,
    TrendingUp,
    MessageSquare,
    X,
    Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

type ChatContext = 'campaigns' | 'creatives' | 'audits' | 'performance' | 'general';

const CONTEXT_OPTIONS = [
    { value: 'general', label: 'Geral', icon: MessageSquare },
    { value: 'campaigns', label: 'Campanhas', icon: Megaphone },
    { value: 'creatives', label: 'Criativos', icon: Image },
    { value: 'audits', label: 'Auditorias', icon: FileCheck },
    { value: 'performance', label: 'Performance', icon: TrendingUp },
];

export default function AIChatPanel() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [context, setContext] = useState<ChatContext>('general');
    const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const companyId = user?.company?.id;

    // Fetch chat history
    const { data: chatHistory } = useQuery({
        queryKey: ['ai-chat-history', companyId],
        queryFn: async () => {
            if (!companyId) return [];
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            // Transform to messages
            const messages: ChatMessage[] = [];
            for (const item of data || []) {
                messages.push({
                    id: item.id + '-user',
                    role: 'user',
                    content: item.user_message,
                    created_at: item.created_at,
                });
                messages.push({
                    id: item.id + '-assistant',
                    role: 'assistant',
                    content: item.assistant_message,
                    created_at: item.created_at,
                });
            }
            return messages;
        },
        enabled: !!companyId && isOpen,
        staleTime: 30000,
    });

    // Update local messages when history loads
    useEffect(() => {
        if (chatHistory) {
            setLocalMessages(chatHistory);
        }
    }, [chatHistory]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localMessages]);

    const sendMessage = useMutation({
        mutationFn: async ({ msg, ctx }: { msg: string; ctx: ChatContext }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch(
                `${supabaseUrl}/functions/v1/ai-chat`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: msg,
                        context: ctx,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Chat failed');
            }

            return response.json();
        },
        onMutate: ({ msg }) => {
            // Optimistically add user message
            const tempId = Date.now().toString();
            setLocalMessages(prev => [
                ...prev,
                {
                    id: tempId,
                    role: 'user',
                    content: msg,
                    created_at: new Date().toISOString(),
                },
            ]);
        },
        onSuccess: (data) => {
            // Add assistant response
            const tempId = Date.now().toString();
            setLocalMessages(prev => [
                ...prev,
                {
                    id: tempId,
                    role: 'assistant',
                    content: data.message,
                    created_at: new Date().toISOString(),
                },
            ]);
            queryClient.invalidateQueries({ queryKey: ['ai-chat-history', companyId] });
        },
        onError: (error) => {
            // Add error message
            setLocalMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `Erro: ${error.message}`,
                    created_at: new Date().toISOString(),
                },
            ]);
        },
    });

    const handleSend = () => {
        if (!message.trim() || sendMessage.isPending) return;
        sendMessage.mutate({ msg: message.trim(), ctx: context });
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearChat = async () => {
        if (!companyId) return;
        await supabase.from('ai_chat_history').delete().eq('company_id', companyId);
        setLocalMessages([]);
        queryClient.invalidateQueries({ queryKey: ['ai-chat-history', companyId] });
    };

    const ContextIcon = CONTEXT_OPTIONS.find(c => c.value === context)?.icon || MessageSquare;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-ch-orange shadow-lg hover:shadow-xl transition-all"
                    size="icon"
                >
                    <Sparkles className="w-6 h-6" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] bg-ch-gray border-ch-dark-gray p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-ch-dark-gray">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-ch-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            Assistente IA
                        </SheetTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearChat}
                                className="h-8 w-8 text-ch-text-muted hover:text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <Select value={context} onValueChange={(v) => setContext(v as ChatContext)}>
                        <SelectTrigger className="mt-2 bg-ch-dark-gray border-ch-dark-gray">
                            <div className="flex items-center gap-2">
                                <ContextIcon className="w-4 h-4" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {CONTEXT_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                        <opt.icon className="w-4 h-4" />
                                        {opt.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SheetHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {localMessages.length === 0 ? (
                        <div className="text-center py-8">
                            <Sparkles className="w-12 h-12 text-purple-500/50 mx-auto mb-4" />
                            <p className="text-ch-text-muted">
                                Olá! Como posso ajudar com suas campanhas?
                            </p>
                            <div className="mt-4 space-y-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-ch-dark-gray text-ch-text-muted justify-start"
                                    onClick={() => {
                                        setMessage('Como está a performance das minhas campanhas?');
                                        setTimeout(handleSend, 100);
                                    }}
                                >
                                    Como está a performance das minhas campanhas?
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-ch-dark-gray text-ch-text-muted justify-start"
                                    onClick={() => {
                                        setMessage('Quais criativos estão com melhor CTR?');
                                        setTimeout(handleSend, 100);
                                    }}
                                >
                                    Quais criativos estão com melhor CTR?
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-ch-dark-gray text-ch-text-muted justify-start"
                                    onClick={() => {
                                        setMessage('O que posso fazer para melhorar meu CPC?');
                                        setTimeout(handleSend, 100);
                                    }}
                                >
                                    O que posso fazer para melhorar meu CPC?
                                </Button>
                            </div>
                        </div>
                    ) : (
                        localMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-purple-500" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.role === 'user'
                                        ? 'bg-ch-orange text-white'
                                        : 'bg-ch-dark-gray text-ch-white'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-ch-orange/20 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-ch-orange" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {sendMessage.isPending && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-purple-500" />
                            </div>
                            <div className="bg-ch-dark-gray rounded-xl px-4 py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-ch-dark-gray">
                    <div className="flex gap-2">
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite sua pergunta..."
                            className="bg-ch-dark-gray border-ch-dark-gray"
                            disabled={sendMessage.isPending}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!message.trim() || sendMessage.isPending}
                            className="bg-ch-orange hover:bg-ch-orange/90"
                        >
                            {sendMessage.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
