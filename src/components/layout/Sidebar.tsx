import {
  LayoutDashboard,
  Settings,
  Target,
  Megaphone,
  Image,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Flame,
  Sparkles,
  X,
  Building2,
  Check,
  Filter,
  Palette,
  TrendingUp,
  History,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useModule, type AppModule } from '@/contexts/ModuleContext';
import { InfoTip } from '@/components/ui/info-tip';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModeToggle } from '@/components/mode-toggle';
import { useTheme } from '@/components/theme-provider';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import logoDark from '@/assets/logo4_dark_mode_sem_fundo.png';
import logoLight from '@/assets/logo4_light_mode_sem_fundo.png';
import {
  isCampanhasListRoute,
  isConjuntosRoute,
  isCriativosRoute,
  conjuntosPath,
  criativosPath,
} from '@/lib/campaignNavigation';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-muted text-muted-foreground' },
  starter: { label: 'Starter', color: 'bg-blue-500/20 text-blue-400' },
  professional: { label: 'Pro', color: 'bg-ch-orange/20 text-ch-orange' },
  enterprise: { label: '', color: '' },
};

// menuGroups are built inside the component to get translations

interface ChildItem {
  icon: LucideIcon;
  label: string;
  path: string;
  hint?: string;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  children?: ChildItem[];
  hint?: string;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sidebarCampaignId = searchParams.get('campaignId') || undefined;
  const sidebarAdSetId = searchParams.get('adSetId') || undefined;
  const { user, signOut } = useAuth();
  const { bmGroups, selectedIds, setSelectedIds, isAllSelected, allMonitored } = useIntegrationFilter();
  const { module, setModule } = useModule();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const { t } = useTranslation(['sidebar']);

  const settingsItem: MenuItem | null = user?.role !== 'operador'
    ? { icon: Settings, label: t('sidebar:items.settings'), path: '/settings', hint: 'Perfil, equipe, integrações de contas e contexto da IA.' }
    : null;

  const campaignsItem: MenuItem = {
    icon: Target,
    label: t('sidebar:items.campaigns'),
    path: '/campanhas',
    hint: 'Suas campanhas de tráfego, com métricas e status de branding por linha.',
    children: [
      { icon: Megaphone, label: t('sidebar:items.adSets'), path: '/conjuntos', hint: 'Conjuntos de anúncios (público e segmentação) dentro de cada campanha.' },
      { icon: Image, label: t('sidebar:items.creatives'), path: '/criativos', hint: 'Os anúncios em si — imagens e vídeos veiculados.' },
    ],
  };

  // Dynamic menu per module.
  // Branding: Dashboard, Regras de Branding, Campanhas, Histórico, Settings.
  // Performance: Dashboard, Regras de Performance, Campanhas, Histórico, Recomendações, Settings.
  const items: MenuItem[] = (() => {
    const overview: MenuItem = { icon: LayoutDashboard, label: t('sidebar:items.overview'), path: '/dashboard', hint: 'Visão geral da conta: principais números e gráficos do módulo atual.' };

    if (module === 'branding') {
      return [
        overview,
        { icon: Zap, label: t('sidebar:items.brandingRules'), path: '/regras', hint: 'Defina o que os criativos devem ter; a IA verifica cada um contra essas regras.' },
        campaignsItem,
        { icon: History, label: t('sidebar:items.history'), path: '/diagnosticos', hint: 'Histórico de análises de IA: diagnósticos de branding por criativo.' },
        { icon: Image, label: t('sidebar:items.creatives'), path: '/anuncios', hint: 'Consulta livre de todos os anúncios já analisados, com filtros por campanha, regra e status.' },
        ...(settingsItem ? [settingsItem] : []),
      ];
    }
    return [
      overview,
      { icon: Zap, label: t('sidebar:items.performanceRules'), path: '/regras', hint: 'Crie regras que pausam a campanha ou avisam quando uma métrica sai do esperado.' },
      campaignsItem,
      { icon: History, label: t('sidebar:items.history'), path: '/diagnosticos', hint: 'Histórico de análises de performance: anúncios, campanhas e conjuntos já auditados.' },
      { icon: Sparkles, label: t('sidebar:items.recommendations'), path: '/recomendacoes', hint: 'Análise estratégica da conta ou de uma campanha, feita pela IA da Click Auditor.' },
      ...(settingsItem ? [settingsItem] : []),
    ];
  })();

  // Paths that exist in each module's menu — used to decide if we can stay on the
  // current route after switching, or must fall back to /dashboard.
  const menuPathsFor = (m: AppModule): string[] => {
    const base = ['/dashboard', '/regras', '/campanhas', '/conjuntos', '/criativos', '/settings'];
    return m === 'branding' ? [...base, '/diagnosticos', '/anuncios'] : [...base, '/diagnosticos', '/recomendacoes'];
  };

  const handleSwitch = (target: AppModule) => {
    if (target === module) return;
    setModule(target); // re-themes the whole app + triggers the switch animation
    const stillValid = menuPathsFor(target).some(
      p => location.pathname === p || location.pathname.startsWith(p + '/')
    );
    if (!stillValid) navigate('/dashboard'); // e.g. /anuncios in performance, /recomendacoes in branding
    setIsOpen(false); // close mobile drawer
  };

  const MODULE_BUTTONS = [
    { id: 'branding' as const, label: 'Branding', Icon: Palette, hint: 'Módulo de identidade visual: regras de branding, conformidade e aprovação de criativos. Deixa o app no tema roxo.' },
    { id: 'performance' as const, label: 'Performance', Icon: TrendingUp, hint: 'Módulo de resultados: investimento, conversão, CPC e recomendações estratégicas. Deixa o app no tema laranja.' },
  ];

  const menuGroups = [
    {
      key: 'main',
      label: '',
      collapsible: false,
      items,
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    main: true,
  });

  // Track which items with children are expanded (keyed by path)
  const isCampaignSection = ['/campanhas', '/conjuntos', '/criativos'].some(p =>
    location.pathname === p || location.pathname.startsWith(p + '/')
  );
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    '/campanhas': isCampaignSection,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleItem = (path: string) => {
    setOpenItems(prev => ({ ...prev, [path]: !prev[path] }));
  };

  useEffect(() => {
    const inCampaignSection =
      isCampanhasListRoute(location.pathname) ||
      isConjuntosRoute(location.pathname) ||
      isCriativosRoute(location.pathname);
    if (inCampaignSection) {
      setOpenItems(prev => ({ ...prev, '/campanhas': true }));
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const { theme } = useTheme();
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const logo = resolvedTheme === 'dark' ? logoDark : logoLight;

  const plan = user?.company?.subscription_plan;
  const planConf = plan ? PLAN_LABELS[plan] : null;
  const companyName = user?.company?.name;
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || t('sidebar:items.team');
  const userEmail = user?.email || '';
  const userInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const userAvatarUrl = user?.avatar_url ?? null;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          "fixed md:relative top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out",
          "bg-sidebar",
          "border-r border-border/30",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Logo Section */}
        <div className={cn(
          "flex items-center border-b border-border/30 relative",
          isCollapsed ? "justify-center px-2 py-4" : "px-4 py-3 gap-2"
        )}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Ir para visão geral"
            className={cn(
              "flex items-center min-w-0 text-left rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isCollapsed ? "justify-center p-1" : "flex-1 gap-3 p-1"
            )}
          >
            <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
              <img
                src={logo}
                alt="Click Auditor Logo"
                className="relative w-full h-full object-contain"
              />
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-lg tracking-tight leading-none bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Click Auditor
                  </span>
                  {planConf?.label && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${planConf.color}`}>
                      {planConf.label}
                    </span>
                  )}
                </div>
                {companyName && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{companyName}</p>
                )}
              </div>
            )}
          </button>

          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-sidebar border border-border/30 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/50 transition-all z-10"
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>

          {/* Mobile Close Button */}
          {!isCollapsed && (
            <button onClick={() => setIsOpen(false)} className="md:hidden ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* BM / Account Filter */}
        {!isCollapsed && allMonitored.length > 0 && (
          <div className="px-3 pt-3 pb-1 relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
                isAllSelected
                  ? "text-muted-foreground/70 border-border/50 hover:border-ch-orange/30 hover:text-foreground bg-transparent"
                  : "text-ch-orange border-ch-orange/30 bg-ch-orange/5"
              )}
            >
              <Filter className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left truncate">
                {isAllSelected
                  ? 'Todas as contas'
                  : `${selectedIds.length} conta${selectedIds.length > 1 ? 's' : ''}`}
              </span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", filterOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 p-2 rounded-lg border border-border/50 bg-popover max-h-52 overflow-y-auto custom-scrollbar space-y-1">
                    {/* Select All */}
                    <button
                      onClick={() => setSelectedIds([])}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                        isAllSelected
                          ? "bg-ch-orange/10 text-ch-orange"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {isAllSelected && <Check className="w-3 h-3" />}
                      <span className={!isAllSelected ? "ml-5" : ""}>Todas as contas</span>
                    </button>

                    {/* BM Groups */}
                    {bmGroups.map(bm => {
                      const bmIntegrationIds = bm.integrations.map(i => i.id);
                      const allBMSelected = !isAllSelected && bmIntegrationIds.every(id => selectedIds.includes(id));
                      const someBMSelected = !isAllSelected && bmIntegrationIds.some(id => selectedIds.includes(id));

                      return (
                        <div key={bm.id}>
                          {/* BM Header */}
                          <button
                            onClick={() => {
                              if (allBMSelected) {
                                setSelectedIds(selectedIds.filter(id => !bmIntegrationIds.includes(id)));
                              } else {
                                const newIds = [...new Set([...selectedIds, ...bmIntegrationIds])];
                                setSelectedIds(newIds);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors",
                              allBMSelected || someBMSelected
                                ? "text-ch-orange"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="flex-1 text-left truncate">{bm.name}</span>
                            {allBMSelected && <Check className="w-3 h-3" />}
                          </button>

                          {/* Individual accounts */}
                          <div className="ml-4 space-y-0.5">
                            {bm.integrations.map(integration => {
                              const isSelected = !isAllSelected && selectedIds.includes(integration.id);
                              return (
                                <button
                                  key={integration.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedIds(selectedIds.filter(id => id !== integration.id));
                                    } else {
                                      setSelectedIds([...selectedIds, integration.id]);
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors",
                                    isSelected
                                      ? "text-ch-orange bg-ch-orange/5"
                                      : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/30"
                                  )}
                                >
                                  {isSelected ? <Check className="w-2.5 h-2.5 flex-shrink-0" /> : <div className="w-2.5 h-2.5 flex-shrink-0 rounded-sm border border-muted-foreground/30" />}
                                  <span className="truncate">{integration.account_name || integration.account_id}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Collapsed filter indicator */}
        {isCollapsed && !isAllSelected && allMonitored.length > 0 && (
          <div className="px-3 pt-3 flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-ch-orange/10 border border-ch-orange/30 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-ch-orange" />
            </div>
          </div>
        )}

        {/* Module switcher — SegmentedControl (module-aware accent via ch-orange token) */}
        {!isCollapsed && (
          <div className="px-3 pt-3">
            <SegmentedControl
              layoutId="sidebar-module-indicator"
              value={module}
              onChange={handleSwitch}
              options={MODULE_BUTTONS.map(({ id, label, Icon }) => ({
                value: id,
                label,
                icon: <Icon className="w-3.5 h-3.5" />,
              }))}
            />
          </div>
        )}
        {isCollapsed && (
          <TooltipProvider delayDuration={200}>
            <div className="px-3 pt-3 flex flex-col items-center gap-2">
              {MODULE_BUTTONS.map(({ id, label, Icon, hint }) => {
                const active = module === id;
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleSwitch(id)}
                        aria-pressed={active}
                        aria-label={`Módulo ${label}`}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                          active
                            ? "bg-ch-orange/10 text-ch-orange border-ch-orange/30 shadow-accent"
                            : "text-muted-foreground border-border/50 hover:text-foreground hover:border-ch-orange/30"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      <p className="font-semibold">Módulo {label}</p>
                      <p className="text-muted-foreground mt-0.5">{hint}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar relative">
          {menuGroups.map((group) => {
            const isGroupOpen = !group.collapsible || openGroups[group.key] !== false;
            const hasActiveItem = group.items.some(i =>
              location.pathname === i.path ||
              location.pathname.startsWith(i.path + '/') ||
              i.children?.some(c => location.pathname === c.path || location.pathname.startsWith(c.path + '/'))
            );

            return (
              <div key={group.key} className="mb-3">
                {/* Group Header */}
                {!isCollapsed && group.label && (
                  group.collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 rounded-lg mb-1 transition-colors text-[10px] font-semibold uppercase tracking-widest",
                        hasActiveItem && !isGroupOpen
                          ? "text-ch-orange"
                          : "text-muted-foreground/40 hover:text-muted-foreground/70"
                      )}
                    >
                      <span>{group.label}</span>
                      <ChevronDown className={cn(
                        "w-3 h-3 transition-transform duration-200",
                        isGroupOpen ? "rotate-0" : "-rotate-90"
                      )} />
                    </button>
                  ) : (
                    <h3 className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                      {group.label}
                    </h3>
                  )
                )}

                {/* Group Items */}
                <AnimatePresence initial={false}>
                  {(isCollapsed || isGroupOpen) && (
                    <motion.div
                      key={group.key + '-items'}
                      initial={group.collapsible ? { height: 0, opacity: 0 } : false}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={group.collapsible ? { height: 0, opacity: 0 } : undefined}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden space-y-0.5"
                    >
                      {group.items.map((item) => {
                        const settingsRoutes = ['/settings', '/usuarios', '/integracoes', '/preferencias', '/empresa'];
                        const isActive = item.path === '/settings'
                          ? settingsRoutes.some(r => location.pathname === r || location.pathname.startsWith(r + '/'))
                          : item.path === '/campanhas'
                            ? isCampanhasListRoute(location.pathname)
                            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                        const hasChildren = !!(item.children && item.children.length > 0);
                        const isItemOpen = openItems[item.path];
                        const isParentOfActive = hasChildren && item.children!.some((c) => {
                          if (c.path === '/conjuntos') return isConjuntosRoute(location.pathname);
                          if (c.path === '/criativos') return isCriativosRoute(location.pathname);
                          return location.pathname === c.path || location.pathname.startsWith(c.path + '/');
                        });
                        const isParentHighlighted = isActive && !isParentOfActive;

                        return (
                          <div key={`${item.path}-${item.label}`}>
                            <InfoTip title={item.label} hint={item.hint} side="right">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                navigate(item.path);
                                if (hasChildren && !isParentOfActive) toggleItem(item.path);
                                else setIsOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                isCollapsed ? "justify-center p-2 h-11" : "justify-start px-3 h-10",
                                isParentHighlighted
                                  ? [
                                    "bg-ch-orange/10 text-ch-orange",
                                    "border border-ch-orange/20",
                                    "shadow-accent",
                                    "hover:bg-ch-orange/10",
                                  ].join(' ')
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/[0.04] border border-transparent"
                              )}
                            >
                              {isParentHighlighted && (
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-ch-orange rounded-r-full shadow-accent" />
                              )}
                              {!isParentHighlighted && (
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-ch-orange/5 to-transparent rounded-xl" />
                              )}

                              <item.icon className={cn(
                                "flex-shrink-0 transition-all",
                                isCollapsed ? "w-5 h-5" : "w-4 h-4",
                                isParentHighlighted
                                  ? "text-ch-orange"
                                  : "text-muted-foreground/60 group-hover:text-foreground"
                              )} />

                              {!isCollapsed && (
                                <>
                                  <span className={cn(
                                    "text-sm font-semibold transition-colors flex-1 text-left",
                                    isParentHighlighted ? "text-ch-orange" : ""
                                  )}>
                                    {item.label}
                                  </span>
                                  {hasChildren && (
                                    <ChevronDown className={cn(
                                      "w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0",
                                      isItemOpen ? "rotate-0" : "-rotate-90",
                                      isParentHighlighted ? "text-ch-orange" : "text-muted-foreground/40"
                                    )} />
                                  )}
                                </>
                              )}
                            </Button>
                            </InfoTip>

                            {/* Children */}
                            {hasChildren && !isCollapsed && (
                              <AnimatePresence initial={false}>
                                {isItemOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="ml-3 mt-0.5 pl-3 border-l border-ch-orange/20 space-y-0.5 py-0.5">
                                      {item.children!.map((child) => {
                                        const isChildActive =
                                          child.path === '/conjuntos'
                                            ? isConjuntosRoute(location.pathname)
                                            : child.path === '/criativos'
                                              ? isCriativosRoute(location.pathname)
                                              : location.pathname === child.path || location.pathname.startsWith(child.path + '/');
                                        return (
                                          <InfoTip key={child.path} title={child.label} hint={child.hint} side="right">
                                          <Button
                                            variant="ghost"
                                            onClick={() => {
                                              const target =
                                                child.path === '/conjuntos'
                                                  ? conjuntosPath(sidebarCampaignId)
                                                  : child.path === '/criativos'
                                                    ? criativosPath({
                                                        campaignId: sidebarCampaignId,
                                                        adSetId: sidebarAdSetId,
                                                      })
                                                    : child.path;
                                              navigate(target);
                                              setIsOpen(false);
                                            }}
                                            className={cn(
                                              "w-full flex items-center gap-2.5 rounded-lg h-9 justify-start px-2.5 transition-all duration-200 group relative overflow-hidden",
                                              isChildActive
                                                ? "bg-ch-orange/10 text-ch-orange border border-ch-orange/20 hover:bg-ch-orange/10"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/[0.04] border border-transparent"
                                            )}
                                          >
                                            {!isChildActive && (
                                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-ch-orange/5 to-transparent rounded-lg" />
                                            )}
                                            <child.icon className={cn(
                                              "w-3.5 h-3.5 flex-shrink-0",
                                              isChildActive
                                                ? "text-ch-orange"
                                                : "text-muted-foreground/50 group-hover:text-foreground"
                                            )} />
                                            <span className={cn(
                                              "text-xs font-semibold",
                                              isChildActive ? "text-ch-orange" : ""
                                            )}>
                                              {child.label}
                                            </span>
                                          </Button>
                                          </InfoTip>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* User / Footer Section */}
        <div className="p-3 border-t border-border/30 relative">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-ch-orange/5 border border-ch-orange/15 shadow-accent">
              {/* Avatar */}
              <UserSidebarAvatar avatarUrl={userAvatarUrl} initials={userInitials} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-foreground truncate block">{userName}</span>
                <span className="text-[10px] text-muted-foreground/60 truncate block">{userEmail}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <LanguageSwitcher />
                <ModeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-7 w-7 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <UserSidebarAvatar avatarUrl={userAvatarUrl} initials={userInitials} size="md" />
              <LanguageSwitcher />
              <ModeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="w-9 h-9 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function UserSidebarAvatar({
  avatarUrl,
  initials,
  size,
}: {
  avatarUrl: string | null;
  initials: string;
  size: 'sm' | 'md';
}) {
  const isSm = size === 'sm';
  const outer = isSm ? 'w-8 h-8' : 'w-9 h-9';
  const radius = isSm ? 'rounded-lg' : 'rounded-xl';

  return (
    <div className={cn('relative flex-shrink-0', outer)}>
      <div className={cn('absolute inset-0 bg-ch-orange/20 blur-sm', radius)} />
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-ch-orange/30 to-ch-orange/10 border border-ch-orange/40 shadow-accent',
          outer,
          radius,
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-ch-orange">{initials}</span>
        )}
      </div>
    </div>
  );
}
