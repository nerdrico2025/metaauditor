import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, User as AppUser } from '@/integrations/supabase/client';

// Extended user type with company info
export interface AuthUser extends Omit<AppUser, 'password_hash'> {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_id: string | null;
    role: 'super_admin' | 'company_admin' | 'operador' | null;
    is_active: boolean | null;
    company?: {
        id: string;
        name: string;
        slug: string;
        subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise' | null;
        status: 'active' | 'suspended' | 'trial' | 'cancelled' | null;
    } | null;
}

interface AuthContextType {
    user: AuthUser | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

interface SignUpMetadata {
    first_name?: string;
    last_name?: string;
    company_name?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const fetchingProfileFor = useRef<string | null>(null);

    // Fetch extended user profile with company info (with timeout)
    const fetchUserProfile = async (authUserId: string): Promise<AuthUser | null> => {
        const start = Date.now();
        // Prevent concurrent fetches for the same user
        if (fetchingProfileFor.current === authUserId) {
            console.log(`[Auth] Fetch already in progress for ${authUserId}, skipping.`);
            return null;
        }

        fetchingProfileFor.current = authUserId;
        console.log(`[Auth] Starting profile fetch for ${authUserId}`);

        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
                const elapsed = Date.now() - start;
                console.warn(`[Auth] Profile fetch TIMEOUT after ${elapsed}ms`);
                fetchingProfileFor.current = null;
                resolve(null);
            }, 10000); // 10s is enough for any DB query
        });

        const fetchPromise = async (): Promise<AuthUser | null> => {
            try {
                const t0 = Date.now();
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUserId)
                    .maybeSingle();

                console.log(`[Auth] Users table query took ${Date.now() - t0}ms`);

                if (error) {
                    console.error('[Auth] Error fetching users table:', error);
                    return null;
                }

                if (!data) {
                    console.warn('[Auth] User not found in public.users table');
                    return null;
                }

                const { password_hash, ...userWithoutPassword } = data;

                let company = null;
                if (userWithoutPassword.company_id) {
                    const t1 = Date.now();
                    const { data: companyData, error: companyError } = await supabase
                        .from('companies')
                        .select('id, name, slug, subscription_plan, status')
                        .eq('id', userWithoutPassword.company_id)
                        .maybeSingle();

                    console.log(`[Auth] Companies table query took ${Date.now() - t1}ms`);
                    if (companyError) console.error('[Auth] Companies fetch error:', companyError);
                    company = companyData;
                }

                console.log(`[Auth] Total profile fetch success in ${Date.now() - start}ms`);
                return { ...userWithoutPassword, company } as AuthUser;
            } catch (err) {
                console.error('[Auth] Exception in fetchUserProfile:', err);
                return null;
            } finally {
                fetchingProfileFor.current = null;
            }
        };

        return Promise.race([fetchPromise(), timeoutPromise]);
    };

    // Refresh user data
    const refreshUser = async () => {
        if (session?.user?.id) {
            const userProfile = await fetchUserProfile(session.user.id);
            setUser(userProfile);
        }
    };

    // Initialize auth state and listen for session changes
    useEffect(() => {
        let mounted = true;
        let initialLoadDone = false;

        const initAuth = async () => {
            try {
                console.log('[Auth] Starting initial session recovery...');
                const { data: { session: initialSession } } = await supabase.auth.getSession();

                if (!mounted) return;
                setSession(initialSession);

                if (initialSession?.user?.id) {
                    const profile = await fetchUserProfile(initialSession.user.id);
                    if (profile && mounted) {
                        setUser(profile);
                    }
                }
            } catch (err) {
                console.error('[Auth] Error during auth initialization:', err);
            } finally {
                if (mounted) {
                    setLoading(false);
                    initialLoadDone = true;
                    console.log('[Auth] Initial auth load complete.');
                }
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                // Skip processing if initial load is still in progress 
                // to avoid double fetching profiles
                if (!initialLoadDone && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
                    console.log(`[Auth] Listener skipping ${event} during init phase.`);
                    return;
                }

                console.log(`[Auth] Event: ${event}`);

                if (!mounted) return;
                setSession(newSession);

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                // If user changed or we don't have a profile yet
                if (newSession?.user?.id && (!user || user.id !== newSession.user.id)) {
                    const profile = await fetchUserProfile(newSession.user.id);
                    if (profile && mounted) {
                        setUser(profile);
                    }
                    if (mounted) setLoading(false);
                }
            }
        );

        initAuth();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Sign in with email and password
    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    // Sign up with email and password
    const signUp = async (email: string, password: string, metadata?: SignUpMetadata) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
            },
        });
        return { error };
    };

    // Sign out
    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    const value: AuthContextType = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper hooks for role-based access
export function useIsSuperAdmin() {
    const { user } = useAuth();
    return user?.role === 'super_admin';
}

export function useIsCompanyAdmin() {
    const { user } = useAuth();
    return user?.role === 'company_admin' || user?.role === 'super_admin';
}

export function useCompanyId() {
    const { user } = useAuth();
    return user?.company_id;
}

export function useHasActiveSubscription() {
    const { user } = useAuth();
    if (!user?.company) return false;
    return user.company.status === 'active' || user.company.status === 'trial';
}
