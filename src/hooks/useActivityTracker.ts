import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logActivity } from '@/lib/activityLog';

const PUBLIC_PATHS = new Set(['/login', '/register']);
const DEBOUNCE_MS = 500;

export function useActivityTracker(enabled: boolean) {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const path = location.pathname;
    if (PUBLIC_PATHS.has(path)) return;
    if (lastPathRef.current === path) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      lastPathRef.current = path;
      void logActivity({
        eventType: 'page_view',
        path,
        metadata: { search: location.search || undefined },
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, location.pathname, location.search]);
}
