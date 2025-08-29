import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Search, BarChart3, BellRing, Image, FileText, Settings, History, LogOut, Zap, ExternalLink } from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Campanhas', href: '/campaigns', icon: BellRing },
  { name: 'Criativos', href: '/creatives', icon: Image },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Políticas', href: '/policies', icon: Settings },
  { name: 'Histórico', href: '/history', icon: History },
  { name: 'Integrações', href: '/integrations', icon: ExternalLink },
  { name: 'Teste IA', href: '/ai-testing', icon: Zap },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Search className="h-5 w-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-slate-900">Click Auditor</span>
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
                    ? 'bg-primary-50 border-r-2 border-primary text-primary group flex items-center px-2 py-2 text-sm font-medium rounded-l-md'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500',
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
          <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
            <div className="flex items-center w-full">
              <img
                className="inline-block h-9 w-9 rounded-full object-cover"
                src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || user.email || 'User')}&background=3b82f6&color=fff`}
                alt="User avatar"
              />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-slate-700">
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.firstName || user.email || 'Usuário'}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 text-slate-400 hover:text-slate-600"
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
