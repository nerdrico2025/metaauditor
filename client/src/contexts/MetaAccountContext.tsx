import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

interface MetaAccount {
  id: string;
  accountId: string | null;
  accountName: string | null;
}

interface MetaAccountContextType {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  accounts: MetaAccount[];
  isLoading: boolean;
}

const MetaAccountContext = createContext<MetaAccountContextType | undefined>(undefined);

const STORAGE_KEY = 'clickauditor_selected_meta_account';

export function MetaAccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: integrations = [], isLoading } = useQuery<MetaAccount[]>({
    queryKey: ['/api/integrations'],
    enabled: !!user,
    select: (data: any[]) => data.filter(i => i.platform === 'meta').map(i => ({
      id: i.id,
      accountId: i.accountId,
      accountName: i.accountName,
    })),
  });

  const setSelectedAccountId = (id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (!isLoading && integrations.length > 0 && selectedAccountId) {
      const exists = integrations.some(a => a.id === selectedAccountId);
      if (!exists) {
        setSelectedAccountId(null);
      }
    }
  }, [integrations, isLoading, selectedAccountId]);

  return (
    <MetaAccountContext.Provider value={{
      selectedAccountId,
      setSelectedAccountId,
      accounts: integrations,
      isLoading,
    }}>
      {children}
    </MetaAccountContext.Provider>
  );
}

export function useMetaAccount() {
  const context = useContext(MetaAccountContext);
  if (context === undefined) {
    throw new Error('useMetaAccount must be used within a MetaAccountProvider');
  }
  return context;
}
