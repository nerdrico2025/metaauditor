import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

export type AppModule = 'branding' | 'performance';

interface ModuleContextType {
    /** Active module. Always set — the app defaults to 'performance' on first visit. */
    module: AppModule;
    setModule: (m: AppModule) => void;
    /** Bumped (Date.now()) only when the module actually changes — drives the switch animation. */
    lastSwitchAt: number | null;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

const STORAGE_KEY = 'clickhero_app_module';

function readStored(): AppModule {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'branding' || v === 'performance') return v;
    } catch { /* noop */ }
    return 'performance';
}

export function ModuleProvider({ children }: { children: ReactNode }) {
    const [module, setModuleRaw] = useState<AppModule>(readStored);
    const [lastSwitchAt, setLastSwitchAt] = useState<number | null>(null);

    const setModule = useCallback((m: AppModule) => {
        setModuleRaw(prev => {
            if (m !== prev) setLastSwitchAt(Date.now()); // only on a real change
            return m;
        });
        try {
            localStorage.setItem(STORAGE_KEY, m);
        } catch { /* noop */ }
    }, []);

    // Re-theme the whole app: branding => add class (purple), performance => remove (orange).
    useEffect(() => {
        document.documentElement.classList.toggle('module-branding', module === 'branding');
    }, [module]);

    return (
        <ModuleContext.Provider value={{ module, setModule, lastSwitchAt }}>
            {children}
        </ModuleContext.Provider>
    );
}

export function useModule() {
    const ctx = useContext(ModuleContext);
    if (!ctx) throw new Error('useModule must be used within ModuleProvider');
    return ctx;
}
