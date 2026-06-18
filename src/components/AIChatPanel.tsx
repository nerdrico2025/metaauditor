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
} from 'lucide-react';

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

const SUGGESTED_QUESTIONS = [
    'Como está a performance das minhas campanhas?',
    'Quais criativos estão com melhor CTR?',
    'O que posso fazer para melhorar meu CPC?',
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

    useEffect(() => {
        if (chatHistory) {
            setLocalMessages(chatHistory);
        }
    }, [chatHistory]);

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

    const handleSend = (text?: string) => {
        const msg = (text ?? message).trim();
        if (!msg || sendMessage.isPending) return;
        sendMessage.mutate({ msg, ctx: context });
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-r from-ch-orange to-ch-orange-hover shadow-lg hover:shadow-xl transition-all"
                    size="icon"
                >
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] bg-popover border-border p-0 flex flex-col">
                <SheetHeader className="p-4 pr-10 border-b border-border">
                    <SheetTitle className="text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-ch-orange" />
                        Assistente IA
                    </SheetTitle>
                    <Select value={context} onValueChange={(v) => setContext(v as ChatContext)}>
                        <SelectTrigger className="mt-2 bg-muted border-border">
                            <SelectValue placeholder="Contexto" />
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

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {localMessages.length === 0 ? (
                        <div className="text-center py-8">
                            <Sparkles className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                Olá! Como posso ajudar com suas campanhas?
                            </p>
                            <div className="mt-4 space-y-2">
                                {SUGGESTED_QUESTIONS.map((question) => (
                                    <Button
                                        key={question}
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-border text-muted-foreground justify-start"
                                        onClick={() => handleSend(question)}
                                    >
                                        {question}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        localMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-ch-orange/20 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-ch-orange" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-primary" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {sendMessage.isPending && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-ch-orange/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-ch-orange" />
                            </div>
                            <div className="bg-muted rounded-xl px-4 py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite sua pergunta..."
                            className="bg-muted border-border"
                            disabled={sendMessage.isPending}
                        />
                        <Button
                            onClick={() => handleSend()}
                            disabled={!message.trim() || sendMessage.isPending}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
