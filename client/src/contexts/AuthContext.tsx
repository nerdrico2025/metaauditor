import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '../lib/queryClient';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'super_admin' | 'company_admin' | 'operador';
  profileImageUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated and load user data
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const userData = await apiRequest('/api/auth/user');
          setUser(userData);
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('auth_token');
          setToken(null);
          console.error('Failed to load user:', error);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const { user: userData, token: authToken } = response;
      
      // Store token in localStorage
      localStorage.setItem('auth_token', authToken);
      setToken(authToken);
      setUser(userData);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    // Redirect to landing page
    window.location.href = '/';
  };

  const isAuthenticated = !!user && !!token;
  const isAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
      }}
    >
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

// Higher-order component for protecting routes
export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireSuperAdmin = false 
}: { 
  children: ReactNode; 
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}) {
  const { isAuthenticated, isAdmin, isSuperAdmin, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!isAuthenticated) {
    window.location.href = '/';
    return null;
  }

  // Super admin trying to access regular routes should be redirected to super admin
  if (isSuperAdmin && !requireSuperAdmin && window.location.pathname !== '/super-admin') {
    window.location.href = '/super-admin';
    return null;
  }

  // Regular users trying to access super admin routes
  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Negado</h1>
          <p className="text-gray-600 dark:text-gray-300">Apenas super administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Negado</h1>
          <p className="text-gray-600 dark:text-gray-300">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}