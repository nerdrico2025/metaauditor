import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, RegisterData, LoginData } from "@shared/schema";

const API_BASE = "/api/auth";

export function useAuth() {
  const queryClient = useQueryClient();

  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;

  // Demo user for development only
  const demoUser = {
    id: 'demo-user',
    email: 'demo@clickauditor.com',
    firstName: 'Demo',
    lastName: 'User',
    profileImageUrl: null,
  };

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: true,
    queryFn: async () => {
      // In development, return demo user
      if (isDevelopment) {
        return demoUser;
      }
      
      // In production, check for real authentication
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        localStorage.removeItem('auth_token');
        throw new Error('Authentication failed');
      }
      
      return response.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Login failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // For Replit Auth, we don't use localStorage tokens
      // Session is managed server-side
      queryClient.setQueryData(['/api/auth/user'], data.user);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Registration failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // For Replit Auth, we don't use localStorage tokens
      // Session is managed server-side
      queryClient.setQueryData(['/api/auth/user'], data.user);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // For Replit Auth, we just redirect to logout endpoint
      // The server will handle session destruction and OIDC logout
      window.location.href = "/api/logout";
    },
    onSuccess: () => {
      // Clear any cached data
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear();
    },
  });

  return {
    user: isDevelopment ? demoUser as User : user as User,
    isAuthenticated: isDevelopment ? true : !!user,
    isLoading: isDevelopment ? false : isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    loginError: loginMutation.error?.message,
    registerError: registerMutation.error?.message,
  };
}