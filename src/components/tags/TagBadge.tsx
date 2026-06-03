import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/hooks/useTags';
import { X } from 'lucide-react';

interface TagBadgeProps {
    tag: Tag;
    onRemove?: () => void;
    className?: string;
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
    return (
        <Badge
            variant="secondary"
            style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                borderColor: `${tag.color}40`
            }}
            className={`flex items-center gap-1 font-medium ${className}`}
        >
            {tag.name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="hover:bg-slate-200 rounded-full p-0.5"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </Badge>
    );
}

export function TagList({ tags, onRemoveTag, className }: {
    tags?: { tag: Tag }[],
    onRemoveTag?: (tagId: string) => void,
    className?: string
}) {
    if (!tags || tags.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {tags.map(({ tag }) => (
                <TagBadge
                    key={tag.id}
                    tag={tag}
                    onRemove={onRemoveTag ? () => onRemoveTag(tag.id) : undefined}
                />
            ))}
        </div>
    );
}
