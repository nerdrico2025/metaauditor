import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { springPop } from '@/lib/motion-presets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTranslation } from 'react-i18next';

// Nota: Modal de OAuth pós-registro foi removido porque o Supabase
// requer confirmação de email antes do login. O usuário poderá conectar
// o Facebook depois do login na página /integracoes ou /empresa

export default function Register() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        companyName: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useTranslation(['auth']);
    const reduced = useReducedMotion();

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const { firstName, lastName, email, password, confirmPassword, companyName } = formData;

        // Validation
        if (!email || !password || !firstName || !companyName) {
            toast({
                title: t('auth:errors.fillAllFields'),
                description: t('auth:errors.fillAllFieldsDesc'),
                variant: 'destructive',
            });
            return;
        }

        if (password.length < 6) {
            toast({
                title: t('auth:errors.passwordTooShort'),
                description: t('auth:errors.passwordMinLength'),
                variant: 'destructive',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: t('auth:errors.passwordMismatch'),
                description: t('auth:errors.passwordMismatchDesc'),
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        const { error } = await signUp(email, password, {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
        });
        setLoading(false);

        if (error) {
            toast({
                title: t('auth:errors.createError'),
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({
                title: t('auth:errors.accountCreated'),
                description: t('auth:errors.checkEmail'),
            });

            // Mostrar modal de conexão Facebook (opcional)
            // Nota: Como o Supabase envia email de confirmação, não temos user_id imediatamente
            // O modal só aparecerá se você desabilitar a confirmação de email no Supabase
            // Por ora, vamos redirecionar para login como antes
            navigate('/login');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : springPop}
            className="space-y-6 w-full max-w-md mx-auto"
        >
            {/* Logo */}
            <div className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-ch-orange rounded-xl flex items-center justify-center">
                        <span className="font-bold text-black text-2xl">C</span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold gradient-text">{t('auth:register.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('auth:register.subtitle')}</p>
            </div>

            {/* Form */}
            <div className="card-elevated rounded-2xl p-6 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">{t('auth:register.firstName')} *</Label>
                            <Input
                                id="firstName"
                                placeholder={t('auth:register.firstName')}
                                value={formData.firstName}
                                onChange={(e) => updateField('firstName', e.target.value)}
                                className="bg-muted border-border focus:border-ch-orange"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">{t('auth:register.lastName')}</Label>
                            <Input
                                id="lastName"
                                placeholder={t('auth:register.lastName')}
                                value={formData.lastName}
                                onChange={(e) => updateField('lastName', e.target.value)}
                                className="bg-muted border-border focus:border-ch-orange"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="companyName">{t('auth:register.companyName')} *</Label>
                        <Input
                            id="companyName"
                            placeholder={t('auth:register.companyName')}
                            value={formData.companyName}
                            onChange={(e) => updateField('companyName', e.target.value)}
                            className="bg-muted border-border focus:border-ch-orange"
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">{t('auth:register.email')} *</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={formData.email}
                            onChange={(e) => updateField('email', e.target.value)}
                            className="bg-muted border-border focus:border-ch-orange"
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">{t('auth:register.password')} *</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => updateField('password', e.target.value)}
                                className="bg-muted border-border focus:border-ch-orange pr-10"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('auth:register.confirmPassword')} *</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={(e) => updateField('confirmPassword', e.target.value)}
                            className="bg-muted border-border focus:border-ch-orange"
                            disabled={loading}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-ch-orange hover:bg-ch-orange-hover text-black font-semibold"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('auth:register.signingUp')}
                            </>
                        ) : (
                            t('auth:register.signUp')
                        )}
                    </Button>
                </form>

                <div className="text-center text-sm">
                    <span className="text-muted-foreground">{t('auth:register.hasAccount')} </span>
                    <Link
                        to="/login"
                        className="text-ch-orange hover:text-ch-orange-hover font-medium transition-colors"
                    >
                        {t('auth:register.signIn')}
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
