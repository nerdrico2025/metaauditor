import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Image, Play } from 'lucide-react';
import { cn, getCreativeImageSrcCandidates } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type CreativeMediaType = 'image' | 'video' | 'carousel' | string;

interface CreativeMediaPreviewProps {
  imageUrl?: string | null;
  externalId?: string | null;
  name?: string;
  fit?: 'cover' | 'contain';
  className?: string;
  aspectClassName?: string;
  roundedClassName?: string;
  /** Fill parent container (use inside aspect-ratio / absolute inset-0 wrappers). */
  fill?: boolean;
  mediaType?: CreativeMediaType;
  videoUrl?: string | null;
  /** Hover video preview (desktop); disabled when prefers-reduced-motion. */
  interactive?: boolean;
}

export function CreativeMediaPreview({
  imageUrl,
  externalId,
  name,
  fit = 'cover',
  className,
  aspectClassName = 'aspect-[4/5]',
  roundedClassName = 'rounded-xl',
  fill = false,
  mediaType,
  videoUrl,
  interactive = true,
}: CreativeMediaPreviewProps) {
  const reduced = useReducedMotion();
  const isVideo = mediaType === 'video';
  const canHoverPlay = interactive && isVideo && !!videoUrl && !reduced;

  const candidates = useMemo(
    () => getCreativeImageSrcCandidates(imageUrl, externalId ?? undefined),
    [imageUrl, externalId],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl, externalId]);

  const src = candidates[candidateIndex] ?? null;
  const objectFit =
    hovering && canHoverPlay
      ? 'object-contain'
      : isVideo && !externalId
        ? 'object-contain'
        : fit === 'cover'
          ? 'object-cover'
          : 'object-contain';

  const handleError = () => {
    setCandidateIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
  };

  const handleMouseEnter = useCallback(() => {
    if (!canHoverPlay) return;
    setHovering(true);
    const el = videoRef.current;
    if (!el || !videoUrl) return;
    if (!el.src) el.src = videoUrl;
    void el.play().catch(() => {});
  }, [canHoverPlay, videoUrl]);

  const handleMouseLeave = useCallback(() => {
    if (!canHoverPlay) return;
    setHovering(false);
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }, [canHoverPlay]);

  const showVideo = hovering && canHoverPlay;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-neutral-950',
        fill ? 'absolute inset-0 h-full w-full min-h-0' : aspectClassName,
        roundedClassName,
        className,
      )}
      onMouseEnter={canHoverPlay ? handleMouseEnter : undefined}
      onMouseLeave={canHoverPlay ? handleMouseLeave : undefined}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          autoPlay
          className={cn('h-full w-full min-h-0', objectFit)}
        />
      ) : src ? (
        <img
          key={src}
          src={src}
          alt={name || 'Criativo'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
          className={cn('h-full w-full min-h-0', objectFit)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/50 px-4">
          <Image className="h-10 w-10 text-muted-foreground/30" />
          <span className="text-center text-[10px] text-muted-foreground">Sem preview</span>
        </div>
      )}

      {isVideo && !showVideo && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
            <Play className="h-5 w-5 fill-white text-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}
