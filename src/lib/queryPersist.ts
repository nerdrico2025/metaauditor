import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/** Bump when persisted query shape changes to avoid stale hydration. */
export const QUERY_PERSIST_BUSTER = 'clickauditor-cache-v1';

const PERSISTED_QUERY_ROOTS = new Set(['auth-profile', 'company-integrations']);

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === 'string' && PERSISTED_QUERY_ROOTS.has(root);
}

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'clickauditor-react-query',
});

/** 24h — profile and integrations revalidate after this when app reopens. */
export const QUERY_PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function getPersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: queryPersister,
    maxAge: QUERY_PERSIST_MAX_AGE_MS,
    buster: QUERY_PERSIST_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === 'success' && shouldPersistQueryKey(query.queryKey),
    },
  };
}
