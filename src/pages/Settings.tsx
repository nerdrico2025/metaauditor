import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { Loader2, Save, Camera, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';

export default function Settings() {
    const { user, refreshUser } = useAuth();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const [fullName, setFullName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
            setFullName(name);
            setAvatarUrl(user.avatar_url || null);
        }
    }, [user]);

    const userInitial = (user?.first_name || user?.email || 'U').charAt(0).toUpperCase();

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const parts = fullName.trim().split(/\s+/);
            const first_name = parts[0] || '';
            const last_name = parts.slice(1).join(' ') || '';

            const { error } = await supabase
                .from('users')
                .update({ first_name, last_name })
                .eq('id', user.id);

            if (error) throw error;
            await refreshUser();
            toast.success('Perfil atualizado com sucesso!');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Erro ao atualizar perfil.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Arquivo muito grande. Máximo 5MB.');
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Formato inválido. Use JPG, PNG ou WebP.');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            // Convert to base64 data URL and save directly in users table
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: dataUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(dataUrl);
            await refreshUser();
            toast.success('Foto atualizada!');
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error('Erro ao fazer upload da foto.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDeleteAccount = () => {
        toast.error('Entre em contato com o suporte para excluir sua conta.');
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto"
        >
            <motion.div variants={item} className="flex flex-col gap-4">
                <SectionHeader
                    title="Configurações"
                    description="Gerencie seu perfil, integrações e preferências da conta."
                />
                <SettingsNav />
            </motion.div>

            <motion.div variants={item}>
            <Card variant="elevated" className="rounded-2xl p-6 space-y-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Meu Perfil</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie suas informações pessoais e de conta.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-bold text-muted-foreground">
                                        {userInitial}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ch-orange flex items-center justify-center shadow-sm hover:bg-ch-orange/90 transition-colors"
                            >
                                {isUploadingAvatar ? (
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-4 h-4 text-white" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-border text-sm"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Alterar Foto
                        </Button>
                        <p className="text-xs text-muted-foreground">JPG, PNG, WebP. Max 5MB.</p>
                    </div>

                    {/* Form Fields */}
                    <div className="flex-1 space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Email</label>
                            <Input
                                value={user?.email || ''}
                                disabled
                                className="bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
                            />
                            <p className="text-xs text-muted-foreground">
                                O email não pode ser alterado diretamente.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Nome Completo</label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Seu nome completo"
                                className="bg-muted/50 border-border"
                            />
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </Card>
            </motion.div>

            <motion.div variants={item}>
            <Card variant="elevated" className="rounded-2xl p-6 space-y-3 border-destructive/20">
                <h2 className="text-lg font-semibold text-red-500">Zona de Perigo</h2>
                <p className="text-sm text-muted-foreground">
                    Ações irreversíveis para sua conta.
                </p>
                <Button
                    variant="outline"
                    onClick={handleDeleteAccount}
                    className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Excluir Conta
                </Button>
            </Card>
            </motion.div>
        </motion.div>
    );
}
