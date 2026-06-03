import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Moon, Sun, Bell, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
];

export function PreferencesForm() {
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const { t, i18n } = useTranslation(['settings', 'common']);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const handleSave = () => {
        toast.success(t('settings:preferences.saved'));
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-foreground">{t('settings:preferences.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings:preferences.subtitle')}</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border shadow-sm space-y-8">

                {/* Appearance */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sun className="w-4 h-4 text-ch-orange" /> {t('settings:preferences.appearance')}
                    </h4>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent">
                        <div className="space-y-0.5">
                            <Label className="text-base text-foreground">{t('settings:preferences.darkMode')}</Label>
                            <p className="text-xs text-muted-foreground">{t('settings:preferences.darkModeDesc')}</p>
                        </div>
                        <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                    </div>
                </div>

                {/* Notifications */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-400" /> {t('settings:preferences.notifications')}
                    </h4>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent">
                        <div className="space-y-0.5">
                            <Label className="text-base text-foreground">{t('settings:preferences.emailAlerts')}</Label>
                            <p className="text-xs text-muted-foreground">{t('settings:preferences.emailAlertsDesc')}</p>
                        </div>
                        <Switch checked={notifications} onCheckedChange={setNotifications} />
                    </div>
                </div>

                {/* Language */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" /> {t('settings:preferences.language')}
                    </h4>
                    <div className="p-4 bg-white/5 rounded-xl border border-transparent">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base text-foreground">{t('settings:preferences.interfaceLanguage')}</Label>
                                <p className="text-xs text-muted-foreground">{t('settings:preferences.selectDefaultLanguage')}</p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="text-sm font-medium text-foreground bg-muted px-3 py-1.5 rounded-lg border border-transparent hover:bg-muted/80 transition-colors flex items-center gap-2">
                                        <span>{currentLang.flag}</span>
                                        <span>{currentLang.label}</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {languages.map((lang) => (
                                        <DropdownMenuItem
                                            key={lang.code}
                                            onClick={() => i18n.changeLanguage(lang.code)}
                                            className={i18n.language === lang.code ? 'bg-accent' : ''}
                                        >
                                            <span className="mr-2">{lang.flag}</span>
                                            {lang.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                <div className="pt-2 flex justify-end">
                    <Button onClick={handleSave} className="bg-white/10 text-white hover:bg-white/20">
                        {t('settings:preferences.savePreferences')}
                    </Button>
                </div>

            </div>
        </div>
    );
}
