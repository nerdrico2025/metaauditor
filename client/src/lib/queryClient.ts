import { QueryClient } from "@tanstack/react-query";

const getToken = () => localStorage.getItem('auth_token');

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    throw new Error(await response.text());
  }

  return response.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, signal }) => {
        const url = queryKey[0] as string;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // For Replit Auth, we rely on session cookies, no Authorization header needed

        const response = await fetch(url, {
          headers,
          signal,
          credentials: 'include', // Include cookies for session-based auth
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // For Replit Auth, don't redirect immediately on 401
            // Let the component handle the unauthenticated state
          }
          throw new Error(await response.text());
        }

        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('401') || error?.message?.includes('403')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});