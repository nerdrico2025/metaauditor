import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, RegisterData, LoginData } from "@shared/schema";

const API_BASE = "/api/auth";

export function useAuth() {
  const queryClient = useQueryClient();

  // REMOVED: Demo user logic - production should always use real authentication
  // No more development/demo mode - always use real API authentication

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: true,
    queryFn: async () => {
      // Try to get JWT token first
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
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
      const response = await fetch('/api/auth/login', {
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
      // Store JWT token from login response  
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Update user data in cache
      queryClient.setQueryData(['/api/auth/me'], data.user);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch('/api/auth/register', {
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
      // Store JWT token from register response
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Update user data in cache
      queryClient.setQueryData(['/api/auth/me'], data.user);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Clear JWT token from localStorage
      localStorage.removeItem('auth_token');
      
      // Call logout endpoint to clean up server-side session
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      // Clear any cached data
      queryClient.setQueryData(['/api/auth/me'], null);
      queryClient.clear();
    },
  });

  return {
    user: user as User,
    isAuthenticated: !!user,
    isLoading: isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    loginError: loginMutation.error?.message,
    registerError: registerMutation.error?.message,
    isSuperAdmin: user?.role === 'super_admin',
  };
}