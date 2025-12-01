import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Search, BarChart3, BellRing, Target, Image, Settings, LogOut, ExternalLink, ChevronDown, ChevronRight, Building2, Shield, Users } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  children?: NavigationItem[];
  requiredRole?: string;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { 
    name: 'Campanhas', 
    icon: BellRing,
    children: [
      { name: 'Todas as Campanhas', href: '/campaigns', icon: BellRing },
      { name: 'Grupos de Anúncios', href: '/adsets', icon: Target },
      { name: 'Anúncios', href: '/creatives', icon: Image },
    ]
  },
  { name: 'Políticas de Validação', href: '/policies', icon: Shield },
  { name: 'Integrações', href: '/integrations', icon: ExternalLink },
  { name: 'Usuários', href: '/users', icon: Users, requiredRole: 'company_admin' },
  { name: 'Dados da Empresa', href: '/company', icon: Building2 },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout, isSuperAdmin } = useAuth();
  const { t } = useTranslation();
  
  const filteredNavigation = navigation.filter(item => {
    if (item.requiredRole && user?.role !== item.requiredRole) {
      return false;
    }
    return true;
  });
  
  // Initialize expanded items based on current location
  const getInitialExpandedItems = () => {
    const expanded: string[] = [];
    filteredNavigation.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => child.href === location);
        if (hasActiveChild) {
          expanded.push(item.name);
        }
      }
    });
    return expanded;
  };
  
  const [expandedItems, setExpandedItems] = useState<string[]>(getInitialExpandedItems);

  // Don't show regular sidebar for super admin
  if (isSuperAdmin) {
    return null;
  }

  const handleLogout = () => {
    logout();
  };

  const handleNavigation = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(href);
    
    // Auto-expand parent menu if navigating to a child
    filteredNavigation.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child => child.href === href);
        if (isChildActive && !expandedItems.includes(item.name)) {
          setExpandedItems(prev => [...prev, item.name]);
        }
      }
    });
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.href) {
      return location === item.href;
    }
    if (item.children) {
      return item.children.some(child => child.href === location);
    }
    return false;
  };

  const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);
    const isActive = isItemActive(item);

    if (hasChildren) {
      return (
        <div key={item.name} className="space-y-1">
          <button
            onClick={() => toggleExpanded(item.name)}
            className={cn(
              isActive
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              'group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md w-full'
            )}
            data-testid={`menu-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center">
              <item.icon
                className={cn(
                  isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900',
                  'mr-3 h-5 w-5'
                )}
              />
              {item.name}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {isExpanded && item.children && (
            <div className="ml-4 space-y-1">
              {item.children.map(child => renderNavigationItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.name}
        onClick={item.href ? handleNavigation(item.href) : undefined}
        className={cn(
          location === item.href
            ? 'bg-primary text-primary-foreground border-r-2 border-primary'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          level > 0 && 'text-sm',
          'group flex items-center px-2 py-2 text-sm font-medium rounded-l-md w-full'
        )}
        data-testid={`menu-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <item.icon
          className={cn(
            location === item.href 
              ? 'text-primary-foreground' 
              : 'text-slate-500 group-hover:text-slate-900',
            'mr-3 h-5 w-5',
            level > 0 && 'h-4 w-4'
          )}
        />
        {item.name}
      </button>
    );
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white dark:bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
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
          {filteredNavigation.map((item) => renderNavigationItem(item))}
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
                <p className="text-sm font-medium text-slate-900">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.email || t('user.guest')}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 text-slate-500 hover:text-slate-900"
                title="Logout"
                data-testid="button-logout"
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
