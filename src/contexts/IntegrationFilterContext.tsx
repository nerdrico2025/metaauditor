import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyIntegrations, type IntegrationWithMetrics } from '@/hooks/useCompanyIntegrations';

interface BMGroup {
    id: string;
    name: string;
    integrations: IntegrationWithMetrics[];
}

interface IntegrationFilterContextType {
    /** All integrations grouped by BM */
    bmGroups: BMGroup[];
    /** All monitored integrations (flat) */
    allMonitored: IntegrationWithMetrics[];
    /** Currently selected integration IDs (empty = all) */
    selectedIds: string[];
    /** Set selected integration IDs */
    setSelectedIds: (ids: string[]) => void;
    /** Whether "all" is selected (no filter) */
    isAllSelected: boolean;
    /** Effective integration IDs to use in queries (selected or all monitored) */
    effectiveIds: string[];
    /** Loading state */
    isLoading: boolean;
}

const IntegrationFilterContext = createContext<IntegrationFilterContextType | undefined>(undefined);

const STORAGE_KEY = 'clickhero_selected_integrations';

export function IntegrationFilterProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { data: integrations, isLoading } = useCompanyIntegrations(user?.company_id);

    // All monitored ads accounts
    const allMonitored = useMemo(() => {
        if (!integrations) return [];
        return integrations.filter(i => !!i.account_id && i.is_monitored === true);
    }, [integrations]);

    // Group by BM
    const bmGroups = useMemo(() => {
        const grouped = allMonitored.reduce((acc, integration) => {
            const bmId = (integration.permissions as any)?.business_manager_id || 'no-bm';
            const bmName = (integration.permissions as any)?.business_manager_name || 'Sem Business Manager';
            if (!acc[bmId]) {
                acc[bmId] = { id: bmId, name: bmName, integrations: [] };
            }
            acc[bmId].integrations.push(integration);
            return acc;
        }, {} as Record<string, BMGroup>);
        return Object.values(grouped);
    }, [allMonitored]);

    // Selected IDs from localStorage
    const [selectedIds, setSelectedIdsRaw] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Persist to localStorage
    const setSelectedIds = (ids: string[]) => {
        setSelectedIdsRaw(ids);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    };

    // Clean up stale IDs when integrations change
    useEffect(() => {
        if (allMonitored.length === 0) return;
        const validIds = new Set(allMonitored.map(i => i.id));
        const cleaned = selectedIds.filter(id => validIds.has(id));
        if (cleaned.length !== selectedIds.length) {
            setSelectedIds(cleaned);
        }
    }, [allMonitored]);

    const isAllSelected = selectedIds.length === 0;
    const effectiveIds = isAllSelected ? allMonitored.map(i => i.id) : selectedIds;

    const value: IntegrationFilterContextType = {
        bmGroups,
        allMonitored,
        selectedIds,
        setSelectedIds,
        isAllSelected,
        effectiveIds,
        isLoading,
    };

    return (
        <IntegrationFilterContext.Provider value={value}>
            {children}
        </IntegrationFilterContext.Provider>
    );
}

export function useIntegrationFilter() {
    const context = useContext(IntegrationFilterContext);
    if (context === undefined) {
        throw new Error('useIntegrationFilter must be used within IntegrationFilterProvider');
    }
    return context;
}
