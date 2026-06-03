
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { company_id } = await req.json();

        if (!company_id) throw new Error('Company ID is required');

        // 1. Mock Campaigns
        const campaigns = [
            {
                company_id,
                google_id: 'GC-1001',
                name: 'Institucional - Brand Protection',
                status: 'ENABLED',
                advertising_channel_type: 'SEARCH',
                budget_amount: 5000,
                spend: 1250.45,
                impressions: 15400,
                clicks: 3450,
                conversions: 450,
                ctr: 22.4,
                avg_cpc: 0.36
            },
            {
                company_id,
                google_id: 'GC-1002',
                name: 'Performance Max - Vendas SP',
                status: 'ENABLED',
                advertising_channel_type: 'PERFORMANCE_MAX',
                budget_amount: 12000,
                spend: 8450.20,
                impressions: 450000,
                clicks: 12500,
                conversions: 320,
                ctr: 2.7,
                avg_cpc: 0.67
            },
            {
                company_id,
                google_id: 'GC-1003',
                name: 'Competitors - Attack',
                status: 'PAUSED',
                advertising_channel_type: 'SEARCH',
                budget_amount: 3000,
                spend: 450.00,
                impressions: 1200,
                clicks: 80,
                conversions: 2,
                ctr: 6.6,
                avg_cpc: 5.62
            }
        ];

        const { data: insertedCampaigns, error: campError } = await supabase
            .from('google_campaigns')
            .upsert(campaigns, { onConflict: 'google_id' }) // Assumes google_id is unique enough for stub
            .select();

        if (campError) throw campError;

        // 2. Mock Ad Groups (for first campaign)
        const adGroups = [
            {
                campaign_id: insertedCampaigns[0].id,
                google_id: 'AG-1001',
                name: 'Exact Match - Brand',
                status: 'ENABLED',
                cpc_bid_micros: 1000000
            },
            {
                campaign_id: insertedCampaigns[0].id,
                google_id: 'AG-1002',
                name: 'Phrase Match - Brand',
                status: 'ENABLED',
                cpc_bid_micros: 800000
            }
        ];

        const { data: insertedAdGroups, error: agError } = await supabase
            .from('google_ad_groups')
            .upsert(adGroups, { onConflict: 'google_id' })
            .select();

        if (agError) throw agError;

        // 3. Mock Ads with Creative Intelligence
        const ads = [
            {
                ad_group_id: insertedAdGroups[0].id,
                google_id: 'AD-1001',
                type: 'RESPONSIVE_SEARCH_AD',
                status: 'ENABLED',
                headlines: ['Click Auditor Oficial', 'Inteligência para Ads', 'Auditoria Automática'],
                descriptions: ['Proteja sua marca e escale resultados.', 'Teste grátis nossa IA.'],
                final_urls: ['https://clickhero.com.br'],
                creative_category: 'TEXT',
                creative_elements: ['brand_logo', 'minimalist']
            },
            {
                ad_group_id: insertedAdGroups[1].id,
                google_id: 'AD-1002',
                type: 'VIDEO_AD',
                status: 'ENABLED',
                headlines: ['Veja como funciona'],
                descriptions: ['Demo completa da plataforma.'],
                final_urls: ['https://clickhero.com.br/demo'],
                creative_category: 'VIDEO',
                creative_elements: ['human_face', 'ai_voiceover', 'dynamic_text']
            },
            {
                ad_group_id: insertedAdGroups[1].id,
                google_id: 'AD-1003',
                type: 'IMAGE_AD',
                status: 'PAUSED',
                headlines: ['Promoção Exclusiva'],
                descriptions: ['Desconto para agências.'],
                final_urls: ['https://clickhero.com.br/promo'],
                creative_category: 'IMAGE',
                creative_elements: ['text_heavy', 'product_shot', 'contrast_high']
            }
        ];

        await supabase.from('google_ads').upsert(ads, { onConflict: 'google_id' });

        // 4. Mock Keywords (Audit Scenarios)
        const keywords = [
            // Safe Brand Keyword
            {
                ad_group_id: insertedAdGroups[0].id,
                google_id: 'KW-1001',
                text: '[clickhero]',
                match_type: 'EXACT',
                status: 'ENABLED',
                quality_score: 10,
                impressions: 5000,
                clicks: 2000,
                cost_micros: 500000000,
                conversions: 300
            },
            // Violation: Broad Match Brand without Negative
            {
                ad_group_id: insertedAdGroups[1].id,
                google_id: 'KW-1002',
                text: 'clickhero login',
                match_type: 'BROAD',
                status: 'ENABLED',
                quality_score: 7,
                impressions: 1200,
                clicks: 150,
                cost_micros: 200000000,
                conversions: 20
            }
        ];

        await supabase.from('google_keywords').upsert(keywords, { onConflict: 'google_id' });

        // 4. Mock Geo Performance (Audit Scenarios)

        // 4. Mock Geo Performance (Audit Scenarios & Visualizations)
        const curDate = new Date().toISOString().split('T')[0];
        const geoPerformance = [
            // Major Cities - High Volume
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                city_name: 'São Paulo',
                region_name: 'São Paulo', // Southeast
                impressions: 45000,
                clicks: 2100,
                cost_micros: 3500000000, // ~3.5k
                conversions: 150
            },
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                city_name: 'Rio de Janeiro',
                region_name: 'Rio de Janeiro', // Southeast
                impressions: 28000,
                clicks: 1200,
                cost_micros: 1800000000, // ~1.8k
                conversions: 85
            },
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                city_name: 'Belo Horizonte',
                region_name: 'Minas Gerais', // Southeast
                impressions: 15000,
                clicks: 650,
                cost_micros: 850000000, // ~850
                conversions: 42
            },
            // South Region
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Curitiba',
                region_name: 'Paraná',
                impressions: 12000,
                clicks: 580,
                cost_micros: 720000000,
                conversions: 38
            },
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Porto Alegre',
                region_name: 'Rio Grande do Sul',
                impressions: 11500,
                clicks: 520,
                cost_micros: 680000000,
                conversions: 35
            },
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Florianópolis',
                region_name: 'Santa Catarina',
                impressions: 8000,
                clicks: 390,
                cost_micros: 540000000,
                conversions: 22
            },
            // Northeast Region
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Salvador',
                region_name: 'Bahia',
                impressions: 18000,
                clicks: 720,
                cost_micros: 650000000, // Lower CPC
                conversions: 28
            },
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Recife',
                region_name: 'Pernambuco',
                impressions: 14000,
                clicks: 610,
                cost_micros: 580000000,
                conversions: 25
            },
            // Center-West
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                city_name: 'Brasília',
                region_name: 'Distrito Federal',
                impressions: 22000,
                clicks: 950,
                cost_micros: 1200000000, // Higher CPC
                conversions: 60
            },
            // Violation: Free BID City with > 10 clicks
            {
                campaign_id: insertedCampaigns[1].id,
                date: curDate,
                city_name: 'Manaus', // Not in allowed list (assumed for audit)
                region_name: 'Amazonas',
                impressions: 800,
                clicks: 45, // > 10 trigger
                cost_micros: 50000000,
                conversions: 0
            }
        ];

        // Ensure we clear old geo data for these campaigns to avoid duplicates if not using unique constraints properly or just to be safe
        // For stub, upsert/insert is fine as long as RLS doesn't block.
        // We will insert. In a real scenario, we'd delete old data for the date first.
        await supabase.from('google_geo_performance').upsert(geoPerformance, { onConflict: 'campaign_id, city_name, date', ignoreDuplicates: false }); // Assuming composite key exists or just inserting

        // 5. Mock Auction Insights
        const auctionInsights = [
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                domain: 'clickhero.com.br', // You
                impression_share: 85.5,
                top_of_page_rate: 92.0,
                position_above_rate: 0,
                overlap_rate: 0,
                outranking_share: 0
            },
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                domain: 'competitor-a.com',
                impression_share: 45.2,
                top_of_page_rate: 60.0,
                position_above_rate: 15.5,
                overlap_rate: 30.2,
                outranking_share: 40.5
            },
            {
                campaign_id: insertedCampaigns[0].id,
                date: curDate,
                domain: 'big-player.com',
                impression_share: 30.1,
                top_of_page_rate: 80.0,
                position_above_rate: 25.0,
                overlap_rate: 20.0,
                outranking_share: 55.0
            }
        ];

        await supabase.from('google_auction_insights').insert(auctionInsights);

        return new Response(JSON.stringify({ success: true, message: 'Google Ads stub data sync complete' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
