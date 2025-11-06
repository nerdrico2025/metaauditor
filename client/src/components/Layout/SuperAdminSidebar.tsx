
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Building2, Users, CreditCard, Settings, BarChart3, LogOut, Shield } from "lucide-react";

const navigation = [
  { name: 'Painel de Administração', href: '/super-admin', icon: Shield },
];

export default function SuperAdminSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const handleNavigation = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(href);
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white dark:bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-foreground">Super Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <button
                key={item.name}
                onClick={handleNavigation(item.href)}
                className={cn(
                  isActive
                    ? 'bg-purple-600 text-white border-r-2 border-purple-700 group flex items-center px-2 py-2 text-sm font-medium rounded-l-md w-full'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900',
                    'mr-3 h-5 w-5'
                  )}
                />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        {user && (
          <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
            <div className="flex items-center w-full">
              <div className="inline-block h-9 w-9 rounded-full bg-purple-600 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.email}
                </p>
                <p className="text-xs text-purple-600 font-semibold">Super Admin</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 text-slate-500 hover:text-slate-900"
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
