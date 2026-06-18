import { useLocation, useNavigate } from 'react-router-dom';
import { User, Users, Sparkles, Circle, Brain } from 'lucide-react';

const navItems = [
    { path: '/settings', label: 'Perfil', icon: User },
    { path: '/usuarios', label: 'Equipe', icon: Users },
    { path: '/integracoes', label: 'Integrações', icon: Sparkles },
    { path: '/contexto', label: 'Contexto da IA', icon: Brain },
    { path: '/preferencias', label: 'Preferências', icon: Circle },
];

export function SettingsNav() {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav className="flex items-center gap-1 bg-muted/50 border border-border p-1 rounded-xl w-fit">
            {navItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path;
                return (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            isActive
                                ? 'bg-card text-foreground shadow-sm border border-border'
                                : 'text-muted-foreground hover:text-foreground hover:bg-card/80 border border-transparent'
                        }`}
                    >
                        <Icon className={`${path === '/preferencias' ? 'w-2.5 h-2.5 fill-current' : 'w-4 h-4'} ${isActive ? 'text-ch-orange' : ''}`} />
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
