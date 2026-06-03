import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, ShieldCheck, Lock, Mail, ArrowRight, Activity, BarChart2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModeToggle } from '@/components/mode-toggle';
import { useTranslation } from 'react-i18next';
import { springPop } from '@/lib/motion-presets';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Import assets
import logo1 from '@/assets/login/logo-1.jpeg';
import logo2 from '@/assets/login/logo-2.jpeg';
import logo3 from '@/assets/login/logo-3.jpeg';
import logo4 from '@/assets/login/logo-4.jpeg';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useTranslation(['auth']);
    const reduced = useReducedMotion();

    // Typing effect for title
    const [titleText, setTitleText] = useState('');
    const fullTitle = t('auth:login.title');

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setTitleText(fullTitle.slice(0, i + 1));
            i++;
            if (i >= fullTitle.length) clearInterval(interval);
        }, 150);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast({
                title: t('auth:errors.requiredFields'),
                description: t('auth:errors.fillCredentials'),
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);

        if (error) {
            toast({
                title: t('auth:errors.authError'),
                description: error.message === 'Invalid login credentials'
                    ? t('auth:errors.invalidCredentials')
                    : t('auth:errors.genericError'),
                variant: 'destructive',
            });
        } else {
            toast({
                title: t('auth:errors.accessGranted'),
                description: t('auth:errors.welcomeBack'),
                className: "bg-card border border-border text-foreground",
            });
            navigate('/dashboard');
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden font-sans text-foreground selection:bg-ch-orange/30 transition-colors duration-300">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <ModeToggle />
            </div>

            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-background transition-colors duration-300" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--ch-orange)/0.05),transparent_60%)] animate-pulse" />
                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(120,120,120,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(120,120,120,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? { duration: 0 } : springPop}
                className="relative z-10 w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-12 p-4 lg:p-6"
            >
                {/* Left Side - Visuals - Only visible on large screens */}
                <div className="hidden lg:flex flex-col justify-center items-center space-y-12 p-10 relative">
                    {/* Decorative Elements */}
                    <div className="absolute top-10 left-10 w-20 h-20 border-l border-t border-ch-orange/20 rounded-tl-3xl" />
                    <div className="absolute bottom-10 right-10 w-20 h-20 border-r border-b border-ch-orange/20 rounded-br-3xl" />

                    <div className="relative group perspective-1000">
                        {/* Animated Rings - Orange theme */}
                        <div className="absolute -inset-12 bg-ch-orange/10 rounded-full blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />

                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-6 border border-dashed border-ch-orange/20 rounded-full"
                        />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-3 border border-ch-orange/10 rounded-full"
                        />

                        {/* Main Logo Container */}
                        <div className="relative w-64 h-64 rounded-2xl bg-gradient-to-br from-muted/20 to-card border border-border p-2 shadow-sm transform transition-transform duration-500 hover:scale-105 hover:border-ch-orange/30 flex items-center justify-center overflow-hidden dark:from-ch-black-soft dark:to-black">
                            <div className="absolute inset-0 bg-gradient-to-tr from-ch-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <img
                                src={logo1}
                                alt="Click Auditor Logo"
                                className="w-full h-full object-cover rounded-xl filter brightness-90 contrast-125 group-hover:brightness-100 transition-all duration-500"
                            />
                        </div>
                    </div>

                    <div className="text-center space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-5xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-muted-foreground tracking-tighter uppercase dark:from-white dark:via-white dark:to-gray-400">
                                {t('auth:login.tagline').split(' ').slice(0, 1).join(' ')} <br /> <span className="text-ch-orange">{t('auth:login.tagline').split(' ').slice(1).join(' ')}</span>
                            </h2>
                            <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase max-w-md mx-auto leading-relaxed">
                                {t('auth:login.taglineDesc')}
                            </p>
                        </div>

                        {/* Feature Pills */}
                        <div className="flex flex-wrap justify-center gap-3 pt-4">
                            {[
                                { icon: Activity, label: t('auth:login.features.realTimeMonitoring') },
                                { icon: BarChart2, label: t('auth:login.features.predictiveAnalysis') },
                                { icon: Globe, label: t('auth:login.features.globalScale') }
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-default">
                                    <feature.icon className="w-3.5 h-3.5 text-ch-orange" />
                                    {feature.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="flex items-center justify-center">
                    <div className="w-full max-w-[450px] relative">
                        {/* Form Card Backdrop */}
                        <div className="absolute -inset-1 bg-gradient-to-b from-ch-orange/10 to-transparent rounded-[32px] opacity-50" />

                        <div className="relative bg-card rounded-[30px] border border-border shadow-sm overflow-hidden p-8 md:p-10">
                            {/* Top accent */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-ch-orange" />

                            {/* Header */}
                            <div className="space-y-8 mb-10">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {/* Label removed */}
                                        </div>
                                        {/* Mobile Logo Fallback */}
                                        <div className="lg:hidden w-8 h-8 rounded-lg bg-ch-orange/10 border border-ch-orange/20 flex items-center justify-center">
                                            <span className="font-bold text-ch-orange">C</span>
                                        </div>
                                    </div>

                                    <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-4">
                                        <div className="w-2 h-10 bg-ch-orange rounded-full" />
                                        {titleText}
                                    </h1>
                                    <p className="text-muted-foreground text-sm">
                                        {t('auth:login.subtitle')}
                                    </p>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">{t('auth:login.email')}</Label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-ch-orange transition-colors duration-300">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder={t('auth:login.emailPlaceholder')}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-muted/40 border-border pl-12 h-14 focus:border-ch-orange/50 focus:ring-2 focus:ring-ch-orange/20 transition-all font-medium text-sm placeholder:text-muted-foreground/30 rounded-xl"
                                                disabled={loading}
                                                autoComplete="email"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('auth:login.password')}</Label>
                                            <Link to="/forgot-password" className="text-[10px] uppercase font-bold text-muted-foreground hover:text-ch-orange transition-colors">
                                                {t('auth:login.forgotPassword')}
                                            </Link>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-ch-orange transition-colors duration-300">
                                                <Lock className="w-5 h-5" />
                                            </div>
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="bg-muted/40 border-border pl-12 pr-12 h-14 focus:border-ch-orange/50 focus:ring-2 focus:ring-ch-orange/20 transition-all font-medium text-sm placeholder:text-muted-foreground/30 rounded-xl"
                                                disabled={loading}
                                                autoComplete="current-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button
                                        type="submit"
                                        className="w-full h-14 bg-gradient-to-r from-ch-orange to-ch-orange-hover hover:from-ch-orange-hover hover:to-ch-orange text-black font-semibold uppercase tracking-widest shadow-sm transition-all duration-300 rounded-xl relative overflow-hidden group"
                                        disabled={loading}
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-3">
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    {t('auth:login.signingIn')}
                                                </>
                                            ) : (
                                                <>
                                                    {t('auth:login.signIn')}
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                    </Button>
                                </div>
                            </form>

                            {/* Footer */}
                            <div className="mt-8 pt-8 border-t border-border flex flex-col items-center justify-between gap-4 text-xs">
                                <div className="flex flex-col md:flex-row items-center gap-4 w-full justify-between">
                                    <span className="text-muted-foreground">
                                        {t('auth:login.noAccount')}
                                    </span>
                                    <Link
                                        to="/register"
                                        className="font-bold text-foreground hover:text-ch-orange transition-colors border border-border hover:border-ch-orange/30 rounded-lg px-4 py-2 bg-card/5 hover:bg-card/10 flex items-center gap-2"
                                    >
                                        {t('auth:login.requestAccess')}
                                    </Link>
                                </div>

                                {/* Legal Links */}
                                <div className="flex items-center gap-6 text-[10px] uppercase font-bold text-muted-foreground/50 mt-4/50">
                                    <Link to="/terms" className="hover:text-foreground transition-colors">{t('auth:login.termsOfUse')}</Link>
                                    <Link to="/privacy" className="hover:text-foreground transition-colors">{t('auth:login.privacyPolicy')}</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
