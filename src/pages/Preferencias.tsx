import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { Globe, Moon, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export default function Preferencias() {
    const { i18n } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState(true);
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);

    const currentLang = i18n.language?.startsWith('pt') ? 'pt-BR' : 'en';

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto"
        >
            <motion.div variants={item} className="flex flex-col gap-4">
                <SectionHeader
                    title="Preferências"
                    description="Personalize idioma, tema e notificações da sua conta."
                />
                <SettingsNav />
            </motion.div>

            <motion.div variants={item}>
            <Card variant="elevated" className="rounded-2xl p-6 space-y-2">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        Preferências do Sistema
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Personalize sua experiência no dashboard.
                    </p>
                </div>

                {/* Idioma */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Idioma</p>
                            <p className="text-xs text-muted-foreground">Selecione seu idioma de preferência.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => i18n.changeLanguage('pt-BR')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                currentLang === 'pt-BR'
                                    ? 'bg-ch-orange text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span className="mr-1">BR</span> Português
                        </button>
                        <button
                            onClick={() => i18n.changeLanguage('en')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                currentLang === 'en'
                                    ? 'bg-ch-orange text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span className="mr-1">US</span> English
                        </button>
                    </div>
                </div>

                {/* Aparência */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                        <Moon className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Aparência</p>
                            <p className="text-xs text-muted-foreground">Personalize o tema do dashboard.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                        {(['light', 'dark', 'system'] as const).map((t) => {
                            const labels: Record<string, string> = {
                                light: 'Claro',
                                dark: 'Escuro',
                                system: 'Sistema',
                            };
                            const icons: Record<string, string> = {
                                light: '☀️',
                                dark: '🌙',
                                system: '💻',
                            };
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                                        theme === t
                                            ? 'bg-ch-orange text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <span>{icons[t]}</span> {labels[t]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notificações */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Notificações</p>
                            <p className="text-xs text-muted-foreground">Receber alertas sobre campanhas e orçamento.</p>
                        </div>
                    </div>
                    <Switch
                        checked={notifications}
                        onCheckedChange={setNotifications}
                        className="data-[state=checked]:bg-ch-orange"
                    />
                </div>

                {/* Footer note */}
                <div className="pt-4 text-center">
                    <p className="text-xs text-muted-foreground">
                        Mais configurações estarão disponíveis em breve.
                    </p>
                </div>
            </Card>
            </motion.div>
        </motion.div>
    );
}
