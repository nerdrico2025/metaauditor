import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
    export_type: 'campaigns' | 'creatives' | 'metrics';
    spreadsheet_id?: string; // If provided, append to existing spreadsheet
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) {
            throw new Error('Unauthorized');
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData?.company_id) {
            throw new Error('User not associated with company');
        }

        const { export_type } = await req.json() as ExportRequest;
        const companyId = userData.company_id;

        let exportData: Record<string, unknown>[] = [];
        let headers: string[] = [];

        if (export_type === 'campaigns') {
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('name, status, objective, impressions, clicks, spend, conversions, created_at')
                .eq('company_id', companyId);

            headers = ['Nome', 'Status', 'Objetivo', 'Impressões', 'Cliques', 'Gasto', 'Conversões', 'Criado em'];
            exportData = (campaigns || []).map(c => ({
                name: c.name,
                status: c.status,
                objective: c.objective || '',
                impressions: c.impressions || 0,
                clicks: c.clicks || 0,
                spend: c.spend || 0,
                conversions: c.conversions || 0,
                created_at: c.created_at,
            }));
        } else if (export_type === 'creatives') {
            const { data: creatives } = await supabase
                .from('creatives')
                .select('name, type, status, impressions, clicks, ctr, cpc, performance_score, created_at')
                .eq('company_id', companyId);

            headers = ['Nome', 'Tipo', 'Status', 'Impressões', 'Cliques', 'CTR', 'CPC', 'Score', 'Criado em'];
            exportData = (creatives || []).map(c => ({
                name: c.name,
                type: c.type || '',
                status: c.status || '',
                impressions: c.impressions || 0,
                clicks: c.clicks || 0,
                ctr: c.ctr || 0,
                cpc: c.cpc || 0,
                performance_score: c.performance_score || 0,
                created_at: c.created_at,
            }));
        } else if (export_type === 'metrics') {
            const { data: metrics } = await supabase
                .from('campaign_metrics')
                .select('date, impressions, clicks, spend, conversions')
                .eq('company_id', companyId)
                .order('date', { ascending: false })
                .limit(365);

            headers = ['Data', 'Impressões', 'Cliques', 'Gasto', 'Conversões'];
            exportData = (metrics || []).map(m => ({
                date: m.date,
                impressions: m.impressions || 0,
                clicks: m.clicks || 0,
                spend: m.spend || 0,
                conversions: m.conversions || 0,
            }));
        }

        // Generate CSV
        const csvLines = [headers.join(',')];
        for (const row of exportData) {
            const values = Object.values(row).map(v => {
                if (typeof v === 'string' && v.includes(',')) {
                    return `"${v}"`;
                }
                return String(v);
            });
            csvLines.push(values.join(','));
        }
        const csv = csvLines.join('\n');

        // In a real implementation, this would:
        // 1. Create a new Google Sheet using Google Sheets API
        // 2. Or append to existing spreadsheet if spreadsheet_id is provided
        // For now, we return the CSV data

        return new Response(csv, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${export_type}_export_${new Date().toISOString().split('T')[0]}.csv"`,
            },
            status: 200,
        });

    } catch (error) {
        console.error('Export error:', error);
        return new Response(
            JSON.stringify({ success: false, error: String(error) }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
