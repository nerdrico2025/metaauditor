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

  console.log("🔄 API Request:", {
    method: options.method || "GET", // Default to GET if not specified
    url,
    hasData: !!data || !!options.body,
    hasToken: !!token,
    dataKeys: data ? Object.keys(data) : (options.body ? "Included in body" : [])
  });

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for session-based auth
  });

  console.log("📡 API Response:", {
    method: options.method || "GET",
    url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries())
  });


  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    const errorText = await response.text();
    console.error("❌ API Request failed:", {
      method: options.method || "GET",
      url,
      status: response.status,
      statusText: response.statusText,
      errorMessage: errorText
    });
    const error = new Error(errorText) as any;
    error.status = response.status;
    error.response = response;
    throw error;
  }

  return response.json();
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

        console.log("🔄 Query Request:", {
          url,
          hasToken: !!token,
        });

        const response = await fetch(url, {
          headers,
          signal,
          credentials: 'include',
        });

        console.log("📡 Query Response:", {
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
          const errorText = await response.text();
          console.error("❌ Query Request failed:", {
            url,
            status: response.status,
            statusText: response.statusText,
            errorMessage: errorText
          });
          throw new Error(errorText);
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