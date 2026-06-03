import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Tag {
    id: string;
    company_id: string;
    name: string;
    color: string;
    entity_type: 'campaign' | 'creative' | 'audit';
    created_at: string;
}

export interface TagAssignment {
    tag_id: string;
    entity_id: string;
    created_at: string;
    tag?: Tag;
}

export function useTags(entityType?: 'campaign' | 'creative' | 'audit') {
    const { user } = useAuth();
    const companyId = user?.company?.id;

    return useQuery({
        queryKey: ['tags', companyId, entityType],
        queryFn: async (): Promise<Tag[]> => {
            if (!companyId) throw new Error('No company ID');

            let query = supabase
                .from('tags')
                .select('*')
                .eq('company_id', companyId);

            if (entityType) {
                query = query.eq('entity_type', entityType);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;
            return (data || []) as unknown as Tag[];
        },
        enabled: !!companyId,
    });
}

export function useEntityTags(entityId: string, entityType: 'campaign' | 'creative') {
    const tableName = entityType === 'campaign' ? 'campaign_tags' : 'creative_tags';
    const idColumn = entityType === 'campaign' ? 'campaign_id' : 'creative_id';

    return useQuery({
        queryKey: ['entity-tags', entityId],
        queryFn: async (): Promise<TagAssignment[]> => {
            const { data, error } = await (supabase
                .from(tableName) as any)
                .select('*, tag:tags(*)')
                .eq(idColumn, entityId);

            if (error) throw error;
            return (data || []).map((item: any) => ({
                ...item,
                entity_id: item[idColumn]
            }));
        },
        enabled: !!entityId,
    });
}

export function useTagMutations() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const createTag = useMutation({
        mutationFn: async (tag: Omit<Tag, 'id' | 'company_id' | 'created_at'>) => {
            if (!companyId) throw new Error('No company ID');
            const { data, error } = await supabase
                .from('tags')
                .insert({ ...tag, company_id: companyId })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            toast.success('Tag criada com sucesso!');
        },
    });

    const deleteTag = useMutation({
        mutationFn: async (tagId: string) => {
            const { error } = await supabase.from('tags').delete().eq('id', tagId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            toast.success('Tag excluída!');
        },
    });

    const addTagToEntity = useMutation({
        mutationFn: async ({ tagId, entityId, entityType }: { tagId: string; entityId: string; entityType: 'campaign' | 'creative' }) => {
            const tableName = entityType === 'campaign' ? 'campaign_tags' : 'creative_tags';
            const idColumn = entityType === 'campaign' ? 'campaign_id' : 'creative_id';

            const { data, error } = await supabase
                .from(tableName as any)
                .insert({ tag_id: tagId, [idColumn]: entityId })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['entity-tags', variables.entityId] });
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['creatives'] });
        },
    });

    const removeTagFromEntity = useMutation({
        mutationFn: async ({ tagId, entityId, entityType }: { tagId: string; entityId: string; entityType: 'campaign' | 'creative' }) => {
            const tableName = entityType === 'campaign' ? 'campaign_tags' : 'creative_tags';
            const idColumn = entityType === 'campaign' ? 'campaign_id' : 'creative_id';

            const { error } = await supabase
                .from(tableName as any)
                .delete()
                .eq('tag_id', tagId)
                .eq(idColumn, entityId);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['entity-tags', variables.entityId] });
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['creatives'] });
        },
    });

    return { createTag, deleteTag, addTagToEntity, removeTagFromEntity };
}
