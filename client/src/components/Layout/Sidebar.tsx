import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Search, BarChart3, BellRing, Image, FileText, Settings, History, LogOut, ExternalLink } from "lucide-react";
import { useTranslation } from 'react-i18next';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Campanhas', href: '/campaigns', icon: BellRing },
  { name: 'Criativos', href: '/creatives', icon: Image },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Políticas', href: '/policies', icon: Settings },
  { name: 'Histórico', href: '/history', icon: History },
  { name: 'Integrações', href: '/integrations', icon: ExternalLink },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-card border-r border-border pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Search className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="ml-3 text-xl font-semibold text-foreground">Click Auditor</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'bg-primary text-primary-foreground border-r-2 border-primary group flex items-center px-2 py-2 text-sm font-medium rounded-l-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    'mr-3 h-5 w-5'
                  )}
                />
                {item.name}
              </a>
            );
          })}
        </nav>

        {/* User Profile */}
        {user && (
          <div className="flex-shrink-0 flex border-t border-border p-4">
            <div className="flex items-center w-full">
              <img
                className="inline-block h-9 w-9 rounded-full object-cover"
                src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || user.email || 'User')}&background=3b82f6&color=fff`}
                alt="User avatar"
              />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.email || t('user.guest')}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 text-muted-foreground hover:text-foreground"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}