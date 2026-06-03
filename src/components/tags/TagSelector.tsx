import React, { useState } from 'react';
import { Check, Plus, Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTags, useTagMutations, Tag } from '@/hooks/useTags';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
    entityId: string;
    entityType: 'campaign' | 'creative';
    selectedTags: { tag: Tag }[];
}

const COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'
];

export function TagSelector({ entityId, entityType, selectedTags }: TagSelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const { data: allTags = [] } = useTags(entityType);
    const { createTag, addTagToEntity, removeTagFromEntity } = useTagMutations();

    const selectedIds = new Set(selectedTags.map(t => t.tag.id));

    const handleSelect = (tag: Tag) => {
        if (selectedIds.has(tag.id)) {
            removeTagFromEntity.mutate({ tagId: tag.id, entityId, entityType });
        } else {
            addTagToEntity.mutate({ tagId: tag.id, entityId, entityType });
        }
    };

    const handleCreateTag = () => {
        if (!searchValue) return;

        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        createTag.mutate({
            name: searchValue,
            color: randomColor,
            entity_type: entityType
        }, {
            onSuccess: (newTag) => {
                addTagToEntity.mutate({ tagId: newTag.id, entityId, entityType });
                setSearchValue('');
            }
        });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                    <Plus className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Buscar ou criar tag..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-xs h-8"
                                onClick={handleCreateTag}
                                disabled={createTag.isPending}
                            >
                                <Plus className="mr-2 h-3 w-3" />
                                Criar "{searchValue}"
                            </Button>
                        </CommandEmpty>
                        <CommandGroup>
                            {allTags.map((tag) => (
                                <CommandItem
                                    key={tag.id}
                                    value={tag.name}
                                    onSelect={() => handleSelect(tag)}
                                    className="flex items-center justify-between"
                                >
                                    <div className="flex items-center">
                                        <div
                                            className="w-2 h-2 rounded-full mr-2"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span>{tag.name}</span>
                                    </div>
                                    {selectedIds.has(tag.id) && (
                                        <Check className="h-3 w-3 text-primary" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
