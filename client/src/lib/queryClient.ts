import { QueryClient } from "@tanstack/react-query";

const getToken = () => localStorage.getItem('auth_token');

// Overloaded function signatures
export async function apiRequest(method: string, url: string, data?: any): Promise<any>;
export async function apiRequest(url: string, options?: RequestInit): Promise<any>;
export async function apiRequest(
  methodOrUrl: string,
  urlOrOptions?: string | RequestInit,
  data?: any
): Promise<any> {
  const token = getToken();
  
  let url: string;
  let options: RequestInit;
  
  // Handle overloaded signatures
  if (typeof urlOrOptions === 'string') {
    // Called as (method, url, data)
    const method = methodOrUrl;
    url = urlOrOptions;
    options = {
      method,
      body: data ? JSON.stringify(data) : undefined,
    };
  } else {
    // Called as (url, options)
    url = methodOrUrl;
    options = urlOrOptions || {};
  }
  
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
    credentials: 'include', // Include cookies for session-based auth
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    throw new Error(await response.text());
  }

  return response;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, signal }) => {
        const url = queryKey[0] as string;
        const token = getToken();

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          headers,
          signal,
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
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