import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_BASE = 'https://graph.facebook.com/v24.0';
const MIN_IMAGE_BYTES = 10 * 1024;

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

export interface ResolvedImageForAI {
    dataUrl: string;
    contentType: string;
}

export interface ResolveCreativeImageInput {
    imageUrl: string | null;
    externalId?: string | null;
    companyId: string;
    campaignId?: string | null;
    creativeId?: string | null;
}

function isMetaCdnUrl(url: string): boolean {
    return url.includes('facebook.com') || url.includes('fbcdn.net');
}

function isSupabaseStorageUrl(url: string): boolean {
    return url.includes('supabase.co/storage');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function toDataUrl(contentType: string, buffer: ArrayBuffer): ResolvedImageForAI {
    const base64 = arrayBufferToBase64(buffer);
    return {
        dataUrl: `data:${contentType};base64,${base64}`,
        contentType,
    };
}

async function fetchImageBytes(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
    try {
        const response = await fetch(url, {
            headers: FETCH_HEADERS,
            redirect: 'follow',
        });
        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) return null;

        return { buffer, contentType };
    } catch (err) {
        console.warn('fetchImageBytes failed:', url, err);
        return null;
    }
}

async function cacheCreativeImage(
    supabase: SupabaseClient,
    companyId: string,
    externalId: string,
    creativeId: string | null | undefined,
    buffer: ArrayBuffer,
    contentType: string,
): Promise<string | null> {
    if (buffer.byteLength < MIN_IMAGE_BYTES) return null;

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const storagePath = `${companyId}/${externalId}.${ext}`;

    try {
        await supabase.storage.createBucket('creative-assets', {
            public: true,
            fileSizeLimit: 10485760,
        }).catch(() => {});

        const { error: uploadError } = await supabase.storage
            .from('creative-assets')
            .upload(storagePath, buffer, { contentType, upsert: true });

        if (uploadError) return null;

        const { data: urlData } = supabase.storage
            .from('creative-assets')
            .getPublicUrl(storagePath);

        if (urlData?.publicUrl && creativeId) {
            await supabase.from('creatives')
                .update({ image_url: urlData.publicUrl })
                .eq('id', creativeId);
        }

        return urlData?.publicUrl ?? null;
    } catch (err) {
        console.warn('cacheCreativeImage failed:', err);
        return null;
    }
}

async function resolveMetaHighResUrl(
    supabase: SupabaseClient,
    externalId: string,
    campaignId: string | null | undefined,
): Promise<string | null> {
    if (!campaignId) return null;

    try {
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('integration_id')
            .eq('id', campaignId)
            .single();

        if (!campaign?.integration_id) return null;

        const { data: integration } = await supabase
            .from('integrations')
            .select('access_token')
            .eq('id', campaign.integration_id)
            .single();

        if (!integration?.access_token) return null;

        const token = integration.access_token;

        const adResp = await fetch(
            `${META_API_BASE}/${externalId}?fields=creative{id}&access_token=${token}`,
        );
        if (!adResp.ok) return null;

        const adData = await adResp.json();
        const metaCreativeId = adData?.creative?.id;
        if (!metaCreativeId) return null;

        const thumbResp = await fetch(
            `${META_API_BASE}/${metaCreativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`,
        );
        if (!thumbResp.ok) return null;

        const thumbData = await thumbResp.json();
        return thumbData?.thumbnail_url ?? null;
    } catch (err) {
        console.warn('resolveMetaHighResUrl failed:', err);
        return null;
    }
}

/**
 * Fetches a creative image server-side and returns a base64 data URL for OpenAI Vision.
 * Reuses the same resolution strategy as image-proxy (Meta API → Storage cache → direct fetch).
 */
export async function resolveCreativeImageForAI(
    supabase: SupabaseClient,
    input: ResolveCreativeImageInput,
): Promise<ResolvedImageForAI | null> {
    const { imageUrl, externalId, companyId, campaignId, creativeId } = input;
    if (!imageUrl) return null;

    const candidates: string[] = [];

    if (externalId) {
        const metaUrl = await resolveMetaHighResUrl(supabase, externalId, campaignId);
        if (metaUrl) candidates.push(metaUrl);
    }

    if (isSupabaseStorageUrl(imageUrl) && !candidates.includes(imageUrl)) {
        candidates.unshift(imageUrl);
    }

    if (!candidates.includes(imageUrl)) {
        candidates.push(imageUrl);
    }

    for (const url of candidates) {
        const fetched = await fetchImageBytes(url);
        if (!fetched) continue;

        if (externalId && isMetaCdnUrl(url)) {
            await cacheCreativeImage(
                supabase,
                companyId,
                externalId,
                creativeId,
                fetched.buffer,
                fetched.contentType,
            );
        }

        return toDataUrl(fetched.contentType, fetched.buffer);
    }

    return null;
}

export interface VisionContentBlock {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string; detail: 'high' | 'low' | 'auto' };
}

export interface ReferenceLogoForVision {
    ruleName: string;
    ruleId?: string;
    dataUrl: string;
}

/**
 * Builds OpenAI multimodal user content with explicit labels so the model
 * distinguishes the creative ad from reference logo images.
 */
export function buildLabeledVisionContent(input: {
    textPrompt: string;
    creativeImage?: ResolvedImageForAI | null;
    referenceLogos?: ReferenceLogoForVision[];
}): VisionContentBlock[] {
    const content: VisionContentBlock[] = [
        { type: 'text', text: input.textPrompt },
    ];

    if (input.creativeImage) {
        content.push({
            type: 'text',
            text: 'IMAGEM DO CRIATIVO COMPLETO (anúncio a auditar). Inspecione TODOS os cantos — superior direito, superior esquerdo, inferior direito, inferior esquerdo — em busca de logos pequenos ou discretos.',
        });
        content.push({
            type: 'image_url',
            image_url: { url: input.creativeImage.dataUrl, detail: 'high' },
        });
    }

    for (const logo of input.referenceLogos ?? []) {
        const ruleLabel = logo.ruleId ? `"${logo.ruleName}" (id: ${logo.ruleId})` : `"${logo.ruleName}"`;
        content.push({
            type: 'text',
            text: `IMAGEM DE REFERÊNCIA — LOGO DA REGRA ${ruleLabel}. Esta NÃO é o criativo; use apenas para comparar presença e formato do logo no anúncio acima.`,
        });
        content.push({
            type: 'image_url',
            image_url: { url: logo.dataUrl, detail: 'high' },
        });
    }

    return content;
}

/** Resolves arbitrary image URLs (e.g. rule logos) to base64 data URLs for OpenAI. */
export async function resolveUrlForAI(url: string): Promise<ResolvedImageForAI | null> {
    if (!url) return null;

    if (isSupabaseStorageUrl(url) || !isMetaCdnUrl(url)) {
        const fetched = await fetchImageBytes(url);
        if (fetched) return toDataUrl(fetched.contentType, fetched.buffer);
    }

    const fetched = await fetchImageBytes(url);
    if (fetched) return toDataUrl(fetched.contentType, fetched.buffer);

    return null;
}
