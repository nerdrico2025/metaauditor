import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';

const profileSchema = z.object({
    first_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    last_name: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido').optional(), // Read-only mostly
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm() {
    const { user, refreshUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
        },
    });

    useEffect(() => {
        if (user) {
            form.reset({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email || '',
            });
        }
    }, [user, form]);

    const onSubmit = async (data: ProfileFormValues) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    first_name: data.first_name,
                    last_name: data.last_name,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshUser();
            toast.success('Perfil atualizado com sucesso!');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Erro ao atualizar perfil.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-foreground">Informações Pessoais</h3>
                <p className="text-sm text-muted-foreground">Atualize suas informações de identificação.</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground font-medium">Nome</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="Seu nome" className="pl-9 bg-white/5 border-transparent text-foreground placeholder:text-muted-foreground/50" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground font-medium">Sobrenome</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Seu sobrenome" className="bg-white/5 border-transparent text-foreground placeholder:text-muted-foreground/50" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground font-medium">Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="seu@email.com" className="bg-white/5 border-transparent text-muted-foreground cursor-not-allowed" {...field} disabled />
                                    </FormControl>
                                    <FormDescription className="text-xs text-muted-foreground">
                                        O email não pode ser alterado diretamente por questões de segurança.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isLoading} className="bg-ch-orange text-black hover:bg-ch-orange/90 font-semibold">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}
