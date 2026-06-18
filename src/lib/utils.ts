import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFmt = new Intl.NumberFormat('pt-BR');

export function formatCurrency(value: number) {
  return currencyFmt.format(value);
}

export function formatNumber(value: number) {
  return numberFmt.format(value);
}

export function formatCompactNumber(value: number, decimals = 1) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(decimals)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(decimals)}K`;
  return numberFmt.format(value);
}

import { supabaseAnonKey, supabaseUrl } from '@/integrations/supabase/client';

function buildImageProxyUrl(url: string, adExternalId?: string | null): string {
  let proxyUrl = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
  if (adExternalId) proxyUrl += `&ad_id=${encodeURIComponent(adExternalId)}`;
  proxyUrl += `&apikey=${encodeURIComponent(supabaseAnonKey)}`;
  return proxyUrl;
}

function isMetaCdnUrl(url: string): boolean {
  return url.includes('facebook.com') || url.includes('fbcdn.net');
}

export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage');
}

/**
 * Returns a proxied image URL for Facebook/blocked images.
 * When adExternalId is set, Storage and Meta CDN URLs route through image-proxy for 1080px thumbnails.
 */
export function getProxiedImageUrl(url: string | null | undefined, adExternalId?: string | null): string | null {
  if (!url) return null;

  const isMetaCdn = isMetaCdnUrl(url);
  const isSupabaseStorage = isSupabaseStorageUrl(url);

  if (adExternalId && (isMetaCdn || isSupabaseStorage)) {
    return buildImageProxyUrl(url, adExternalId);
  }

  if (isSupabaseStorage) return url;

  if (isMetaCdn) {
    return buildImageProxyUrl(url, adExternalId);
  }

  return url;
}

/** Ordered candidates for <img src> — HD proxy first when ad_id exists, then direct fallbacks. */
export function getCreativeImageSrcCandidates(
  url: string | null | undefined,
  adExternalId?: string | null,
): string[] {
  if (!url) return [];

  const isMetaCdn = isMetaCdnUrl(url);
  const isSupabaseStorage = isSupabaseStorageUrl(url);
  const out: string[] = [];

  if (adExternalId && (isMetaCdn || isSupabaseStorage)) {
    out.push(buildImageProxyUrl(url, adExternalId));
  } else {
    const proxied = getProxiedImageUrl(url, adExternalId);
    if (proxied) out.push(proxied);
  }

  if (isSupabaseStorage && !out.includes(url)) out.push(url);
  if (isMetaCdn && !out.includes(url)) out.push(url);
  if (!isSupabaseStorage && !isMetaCdn && !out.includes(url)) out.push(url);

  return out;
}
