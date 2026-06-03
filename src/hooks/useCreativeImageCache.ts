import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const MAX_CACHE_ATTEMPTS = 2;

interface CreativeImageSource {
  image_url?: string | null;
}

/**
 * Triggers cache-creative-images when fbcdn/Meta URLs need HD caching,
 * or once per session when only Supabase Storage URLs exist (legacy low-res cache).
 */
export function useCreativeImageCache(
  companyId: string | undefined,
  creatives: CreativeImageSource[],
  onRefetch?: () => void,
) {
  const attemptsRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!companyId || !creatives.length || inFlightRef.current) return;
    if (attemptsRef.current >= MAX_CACHE_ATTEMPTS) return;

    const supabaseHost = import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || '';
    const hasNullImages = creatives.some((c) => !c.image_url);
    const hasUncached = creatives.some(
      (c) => c.image_url && !c.image_url.includes(supabaseHost),
    );
    const hasFbcdn = creatives.some(
      (c) =>
        c.image_url &&
        (c.image_url.includes('fbcdn.net') || c.image_url.includes('facebook.com')),
    );

    const storageOnly =
      creatives.length > 0 &&
      creatives.every((c) => !c.image_url || c.image_url.includes(supabaseHost));

    const sessionKey = `creative-hd-refresh-${companyId}`;
    const needsStorageRefresh =
      storageOnly &&
      creatives.some((c) => c.image_url) &&
      !sessionStorage.getItem(sessionKey);

    if (!hasUncached && !hasNullImages && !needsStorageRefresh) return;

    if (needsStorageRefresh) {
      sessionStorage.setItem(sessionKey, '1');
    }

    inFlightRef.current = true;
    attemptsRef.current += 1;

    supabase.functions
      .invoke('cache-creative-images', {
        body: {
          company_id: companyId,
          limit: 100,
          force_refresh: hasFbcdn || hasUncached || needsStorageRefresh,
        },
      })
      .then(({ error }) => {
        if (error) throw error;
        onRefetch?.();
      })
      .catch((err: unknown) => {
        console.error('[useCreativeImageCache]', err);
        if (attemptsRef.current >= MAX_CACHE_ATTEMPTS) {
          toast.error('Não foi possível atualizar previews — tente sincronizar de novo.');
        }
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [companyId, creatives, onRefetch]);
}
