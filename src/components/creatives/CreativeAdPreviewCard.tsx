import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { Activity, Film, FileImage, Image, Loader2, Play, Type } from 'lucide-react';
import { CreativeCompliancePreview, ComplianceOverlayLayer } from '@/components/branding/CreativeCompliancePreview';
import { CreativeMediaPreview } from '@/components/branding/CreativeMediaPreview';
import type { ComplianceStatus, FailedRulePreview } from '@/components/branding/CreativeCompliancePreview';
import { getProxiedImageUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface CreativeAdPreviewData {
    type: string | null;
    name: string | null;
    image_url: string | null;
    video_url: string | null;
    external_id: string | null;
    headline: string | null;
    text: string | null;
    creative_format?: string | null;
}

interface CreativeAdPreviewCardProps {
    creative: CreativeAdPreviewData;
    isBranding: boolean;
    brandingDisplayStatus: ComplianceStatus;
    ruleFailedRules: FailedRulePreview[];
    isRuleNonCompliant: boolean;
    freshVideoUrl: string | null;
    videoError: boolean;
    previewIframe: string | null;
    loadingPreview: boolean;
    onFetchFreshPreview: () => void;
    onFreshVideoError: () => void;
    onVideoError: () => void;
    onImageZoom?: () => void;
    spendFormatted?: string;
    borderClassName?: string;
}

const MEDIA_MAX_HEIGHT = 'max-h-[min(560px,70vh)]';

const VIDEO_ASPECT_BY_FORMAT: Record<string, string> = {
    '9:16': 'aspect-[9/16]',
    '9/16': 'aspect-[9/16]',
    '16:9': 'aspect-video',
    '16/9': 'aspect-video',
    '4:5': 'aspect-[4/5]',
    '4/5': 'aspect-[4/5]',
    '1:1': 'aspect-square',
    '1/1': 'aspect-square',
};

function resolveVideoAspectClass(creativeFormat: string | null | undefined): string {
    const normalized = (creativeFormat ?? '').trim().toLowerCase();
    if (normalized && VIDEO_ASPECT_BY_FORMAT[normalized]) {
        return VIDEO_ASPECT_BY_FORMAT[normalized];
    }
    return 'aspect-[9/16]';
}

function getTypeIcon(type: string | null) {
    switch (type) {
        case 'video':
            return <Film className="w-5 h-5" />;
        case 'image':
            return <FileImage className="w-5 h-5" />;
        default:
            return <Image className="w-5 h-5" />;
    }
}

function getTypeBadge(type: string | null) {
    const config: Record<string, { label: string; color: string; icon: typeof Film }> = {
        video: { label: 'Vídeo Performance', color: 'ch-blue', icon: Film },
        image: { label: 'Imagem Estática', color: 'blue-500', icon: FileImage },
        carousel: { label: 'Carrossel', color: 'emerald-500', icon: Image },
    };
    const cfg = config[type || ''] || { label: 'Anúncio', color: 'ch-text-dimmed', icon: Image };
    const Icon = cfg.icon;

    const textColorClass =
        cfg.color === 'ch-blue'
            ? 'text-[#0ea5e9]'
            : cfg.color === 'ch-orange'
                ? 'text-ch-orange'
                : `text-${cfg.color}`;
    const bgColorClass =
        cfg.color === 'ch-blue'
            ? 'bg-[#0ea5e9]/10'
            : cfg.color === 'ch-orange'
                ? 'bg-ch-orange/10'
                : `bg-${cfg.color}/10`;
    const borderColorClass =
        cfg.color === 'ch-blue'
            ? 'border-[#0ea5e9]/20'
            : cfg.color === 'ch-orange'
                ? 'border-ch-orange/20'
                : `border-${cfg.color}/20`;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border shadow-sm',
                bgColorClass,
                textColorClass,
                borderColorClass,
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {cfg.label}
        </span>
    );
}

function VideoMediaFrame({
    creativeFormat,
    measuredAspectRatio,
    className,
    children,
}: {
    creativeFormat?: string | null;
    measuredAspectRatio: number | null;
    className?: string;
    children: ReactNode;
}) {
    const fallbackAspectClass = resolveVideoAspectClass(creativeFormat);
    const frameStyle: CSSProperties | undefined = measuredAspectRatio
        ? { aspectRatio: `${measuredAspectRatio}` }
        : undefined;

    return (
        <div
            className={cn(
                'relative w-full overflow-hidden bg-black',
                !measuredAspectRatio && fallbackAspectClass,
                className,
            )}
            style={frameStyle}
        >
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-full w-full">
                    {children}
                </div>
            </div>
        </div>
    );
}

export function CreativeAdPreviewCard({
    creative,
    isBranding,
    brandingDisplayStatus,
    ruleFailedRules,
    isRuleNonCompliant,
    freshVideoUrl,
    videoError,
    previewIframe,
    loadingPreview,
    onFetchFreshPreview,
    onFreshVideoError,
    onVideoError,
    onImageZoom,
    spendFormatted,
    borderClassName,
}: CreativeAdPreviewCardProps) {
    const [measuredAspectRatio, setMeasuredAspectRatio] = useState<number | null>(null);
    const poster = getProxiedImageUrl(creative.image_url, creative.external_id) || undefined;
    const isVideo = creative.type === 'video';

    const handleVideoMetadata = useCallback((video: HTMLVideoElement) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            setMeasuredAspectRatio(video.videoWidth / video.videoHeight);
        }
    }, []);

    const hasMedia =
        isVideo
            ? !!(freshVideoUrl || creative.video_url || previewIframe || creative.image_url)
            : !!creative.image_url;

    const renderVideoElement = (src: string, onError: () => void) => (
        <VideoMediaFrame
            creativeFormat={creative.creative_format}
            measuredAspectRatio={measuredAspectRatio}
        >
            <video
                src={src}
                poster={poster}
                controls
                className="h-full w-full object-contain"
                playsInline
                onLoadedMetadata={(e) => handleVideoMetadata(e.currentTarget)}
                onError={onError}
            />
        </VideoMediaFrame>
    );

    const renderMedia = () => {
        if (isVideo && freshVideoUrl) {
            return renderVideoElement(freshVideoUrl, onFreshVideoError);
        }

        if (isVideo && creative.video_url && !videoError) {
            return renderVideoElement(creative.video_url, onVideoError);
        }

        if (isVideo && previewIframe) {
            return (
                <VideoMediaFrame
                    creativeFormat={creative.creative_format}
                    measuredAspectRatio={measuredAspectRatio}
                >
                    <div
                        className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
                        dangerouslySetInnerHTML={{
                            __html: previewIframe
                                .replace(/width="\d+"/, 'width="100%"')
                                .replace(/height="\d+"/, 'height="100%"'),
                        }}
                    />
                </VideoMediaFrame>
            );
        }

        if (isVideo && (videoError || !creative.video_url)) {
            return (
                <VideoMediaFrame
                    creativeFormat={creative.creative_format}
                    measuredAspectRatio={measuredAspectRatio}
                >
                    {creative.image_url ? (
                        isBranding ? (
                            <CreativeCompliancePreview
                                imageUrl={creative.image_url}
                                externalId={creative.external_id}
                                name={creative.name}
                                status={brandingDisplayStatus}
                                failedRules={ruleFailedRules}
                                fit="contain"
                                aspectClassName="h-full w-full"
                                className="h-full w-full rounded-none"
                                mediaType={creative.type ?? undefined}
                                videoUrl={creative.video_url}
                                interactive={false}
                            />
                        ) : (
                            <CreativeMediaPreview
                                imageUrl={creative.image_url}
                                externalId={creative.external_id}
                                name={creative.name}
                                fit="contain"
                                fill
                                aspectClassName="h-full w-full"
                                roundedClassName="rounded-none"
                                className="h-full w-full"
                                mediaType={creative.type ?? undefined}
                                videoUrl={creative.video_url}
                                interactive={false}
                            />
                        )
                    ) : null}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60">
                        {loadingPreview ? (
                            <>
                                <Loader2 className="w-10 h-10 text-ch-orange animate-spin" />
                                <p className="text-xs text-white/80 font-medium">Buscando vídeo atualizado...</p>
                            </>
                        ) : (
                            <>
                                <Play className="w-12 h-12 text-white/40" />
                                <p className="text-xs text-white/80 font-medium text-center px-6">
                                    Vídeo não disponível.
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFetchFreshPreview();
                                    }}
                                    className="mt-2 px-4 py-2 bg-ch-orange/90 hover:bg-ch-orange text-black text-xs font-bold rounded-xl transition-colors"
                                >
                                    Atualizar Vídeo
                                </button>
                            </>
                        )}
                    </div>
                </VideoMediaFrame>
            );
        }

        if (creative.image_url) {
            const mediaInner = isBranding ? (
                <CreativeCompliancePreview
                    imageUrl={creative.image_url}
                    externalId={creative.external_id}
                    name={creative.name}
                    status={brandingDisplayStatus}
                    failedRules={ruleFailedRules}
                    fit="contain"
                    aspectClassName="w-full"
                    className="w-full rounded-none"
                    mediaType={creative.type ?? undefined}
                    videoUrl={creative.video_url}
                    interactive={false}
                />
            ) : (
                <CreativeMediaPreview
                    imageUrl={creative.image_url}
                    externalId={creative.external_id}
                    name={creative.name}
                    fit="contain"
                    aspectClassName="w-full"
                    roundedClassName="rounded-none"
                    className="w-full"
                    mediaType={creative.type ?? undefined}
                    videoUrl={creative.video_url}
                    interactive={false}
                />
            );

            return (
                <div
                    className={cn('w-full', onImageZoom && 'cursor-zoom-in')}
                    onClick={onImageZoom}
                    onKeyDown={onImageZoom ? (e) => e.key === 'Enter' && onImageZoom() : undefined}
                    role={onImageZoom ? 'button' : undefined}
                    tabIndex={onImageZoom ? 0 : undefined}
                >
                    <div className={cn('relative w-full flex items-center justify-center', MEDIA_MAX_HEIGHT)}>
                        {mediaInner}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div
            className={cn(
                'bg-card rounded-[2.5rem] overflow-hidden shadow-sm group',
                borderClassName,
            )}
        >
            <div className="relative bg-card">
                {creative.text && (
                    <div className="px-6 pt-6 pb-4 border-b border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-3 h-3 text-ch-orange" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                Copywriting Principal
                            </span>
                        </div>
                        <p className="text-sm font-medium text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            {creative.text}
                        </p>
                    </div>
                )}

                <div
                    className={cn(
                        'relative w-full bg-muted/50',
                        isVideo ? 'min-h-0' : 'flex min-h-[180px] items-center justify-center',
                    )}
                >
                    {renderMedia()}
                    {isBranding && isRuleNonCompliant && isVideo && (
                        <ComplianceOverlayLayer
                            status={brandingDisplayStatus}
                            failedRules={ruleFailedRules}
                        />
                    )}
                    {!hasMedia && (
                        <div className="flex flex-col items-center justify-center gap-5 text-muted-foreground bg-muted/20 py-12 px-6">
                            {getTypeIcon(creative.type)}
                            <div className="flex flex-col items-center gap-2 max-w-xs">
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="text-red-500 shrink-0"
                                    >
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                        <path d="M12 9v4" />
                                        <path d="M12 17h.01" />
                                    </svg>
                                    <span className="text-xs font-semibold text-red-500 leading-tight text-center">
                                        Resolução baixa por falta de permissão do administrador na conta de anúncios
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="absolute top-4 right-4 z-10">{getTypeBadge(creative.type)}</div>
                </div>

                {creative.headline && (
                    <div className="px-6 py-5 border-t border-border/50 bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Type className="w-3 h-3 text-ch-orange" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                Chamada de Ação
                            </span>
                        </div>
                        <p className="text-base font-bold text-foreground leading-tight tracking-tight">
                            {creative.headline}
                        </p>
                    </div>
                )}
            </div>

            {!isBranding && spendFormatted !== undefined && (
                <div className="p-8 border-t border-border bg-card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                Investimento Total
                            </p>
                            <h4 className="text-2xl font-bold text-foreground tabular-nums tracking-tighter">
                                {spendFormatted}
                            </h4>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
