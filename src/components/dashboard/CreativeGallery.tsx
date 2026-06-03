import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Image as ImageIcon, MousePointer, TrendingUp, Video } from "lucide-react";
import { TopCreative } from "@/hooks/useCreativePerformance";
import { Link } from "react-router-dom";

interface CreativeGalleryProps {
    creatives: TopCreative[];
}

export function CreativeGallery({ creatives }: CreativeGalleryProps) {
    if (!creatives || creatives.length === 0) {
        return (
            <Card className="h-full bg-muted/50 border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">Top Criativos</CardTitle>
                    <CardDescription>Galeria dos melhores anúncios</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de criativo disponível no momento.
                </CardContent>
            </Card>
        )
    }

    // Reuse the clean name logic
    const cleanName = (name: string) => {
        return name
            .replace(/[_-]/g, ' ') // Replace underscores/hyphens with spaces
            .replace(/\.(mp4|jpg|png|jpeg|mov|gif|webp)$/i, '') // Remove extensions
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
            .trim()
            .replace(/\b\w/g, c => c.toUpperCase()) // Title Case
            .replace(/^(Img|Video|Carrossel)\s+/i, ''); // Remove prefixes
    };

    return (
        <Card className="h-full shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <span>🎨</span>
                            Top Criativos
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Os 3 anúncios campeões de conversão.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {creatives.map((creative, index) => (
                        <CreativeCard key={creative.id} creative={creative} index={index} cleanName={cleanName} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function CreativeCard({ creative, index, cleanName }: { creative: TopCreative, index: number, cleanName: (name: string) => string }) {
    const [imgError, setImgError] = useState(false);

    // Reset error state if the URL changes (e.g., after a DB update)
    useEffect(() => {
        setImgError(false);
    }, [creative.imageUrl]);

    return (
        <Link
            to={`/criativos/${creative.id}`}
            className="group relative flex flex-col rounded-xl overflow-hidden border bg-background shadow-sm hover:shadow-lg hover:border-ch-orange/50 transition-all duration-300 cursor-pointer"
        >
            {/* Media Preview */}
            <div className="aspect-[4/3] w-full bg-muted/40 relative flex items-center justify-center overflow-hidden">
                {!imgError && creative.imageUrl ? (
                    <img
                        key={creative.imageUrl}
                        src={creative.imageUrl}
                        alt={creative.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={() => setImgError(true)}
                    />
                ) : creative.videoUrl ? (
                    <div className="w-full h-full relative group/video">
                        <video
                            src={creative.videoUrl}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            muted
                            playsInline
                            loop
                            onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => { })}
                            onMouseOut={e => {
                                const el = e.target as HTMLVideoElement;
                                el.pause();
                                el.currentTime = 0;
                            }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/video:scale-110 transition-transform">
                            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20">
                                <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                        {creative.format === 'video' ? <Video className="h-8 w-8 mb-2" /> : <ImageIcon className="h-8 w-8 mb-2" />}
                        <span className="text-[10px] font-medium uppercase tracking-widest">Sem Preview</span>
                    </div>
                )}

                {/* Rank Badge */}
                <div className="absolute top-2 left-2">
                    <Badge className="bg-black/70 hover:bg-black/80 backdrop-blur-md text-white border-white/10 shadow-sm font-mono text-xs px-2">
                        #{index + 1}
                    </Badge>
                </div>

                {/* Overlay with "Ver Detalhes" on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        Ver Detalhes
                    </span>
                </div>

                {/* Format Badge */}
                <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-[9px] h-5 px-1.5 bg-background/80 hover:bg-background/90 backdrop-blur-md shadow-sm uppercase tracking-wider font-bold">
                        {creative.format === 'video' ? 'Video' : 'Imagem'}
                    </Badge>
                </div>
            </div>

            {/* Details Footer */}
            <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h4 className="font-semibold text-sm leading-tight text-foreground line-clamp-1 group-hover:text-ch-orange transition-colors" title={creative.name}>
                            {cleanName(creative.name)}
                        </h4>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 h-4 border-${creative.format === 'video' ? 'violet' : 'blue'}-500/20 bg-${creative.format === 'video' ? 'violet' : 'blue'}-500/5 text-${creative.format === 'video' ? 'violet' : 'blue'}-600 dark:text-${creative.format === 'video' ? 'violet' : 'blue'}-400 font-mono`}>
                                {creative.format === 'video' ? 'REELS' : 'FEED'}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col p-2 rounded-lg bg-muted/40 border group-hover:border-ch-orange/20 transition-colors">
                            <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                <TrendingUp className="h-3 w-3" /> Conversões
                            </span>
                            <span className="font-mono font-bold text-emerald-500 text-sm">
                                {creative.conversions}
                            </span>
                        </div>
                        <div className="flex flex-col p-2 rounded-lg bg-muted/40 border group-hover:border-ch-orange/20 transition-colors">
                            <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                <MousePointer className="h-3 w-3" /> CTR
                            </span>
                            <span className="font-mono font-bold text-blue-500 text-sm">
                                {creative.ctr.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                {creative.headline && (
                    <div className="mt-3 pt-3 border-t border-dashed">
                        <div className="flex items-start gap-2 bg-amber-500/5 rounded-md p-2 border border-amber-500/10">
                            <span className="text-[9px] bg-amber-500 text-white font-bold px-1 rounded-sm mt-0.5">HOOK</span>
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 italic leading-snug line-clamp-2">
                                "{creative.headline}"
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
}
