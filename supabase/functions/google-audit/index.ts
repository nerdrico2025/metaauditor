
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditResult {
    brand_violations: Array<{
        keyword_id: string;
        text: string;
        match_type: string;
        issue: string;
        severity: 'high' | 'medium';
    }>;
    geo_violations: Array<{
        city: string;
        region: string;
        clicks: number;
        cost: number;
        issue: string;
        severity: 'high' | 'medium';
    }>;
    brand_health_score: number;
}

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

        // Extract and verify Auth Token manually (since verify_jwt will be false)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid Token', details: authError }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        // 1. Fetch Configuration (Mocked for now, normally from policies)
        const BRAND_TERMS = ['click auditor', 'clickhero', 'click hero'];
        const ALLOWED_CITIES = ['São Paulo', 'Curitiba', 'Rio de Janeiro', 'Belo Horizonte'];
        const GEO_CLICK_THRESHOLD = 5; // Stricter for demo

        // 2. Audit Keywords (Brand Protection)
        const { data: keywords, error: kwError } = await supabase
            .from('google_keywords')
            .select('id, text, match_type, status')
            .eq('status', 'ENABLED');

        if (kwError) throw kwError;

        const brandViolations: AuditResult['brand_violations'] = [];

        for (const kw of (keywords || [])) {
            const lowerText = kw.text.toLowerCase();
            const containsBrand = BRAND_TERMS.some(term => lowerText.includes(term));

            if (containsBrand) {
                // Rule: Brand terms must not be BROAD match without explicit control
                // In this simplified audit, BROAD on brand is a violation
                if (kw.match_type === 'BROAD') {
                    brandViolations.push({
                        keyword_id: kw.id,
                        text: kw.text,
                        match_type: kw.match_type,
                        issue: 'Termo de marca em correspondência ampla (Risco de Canibalização)',
                        severity: 'high'
                    });
                }
            }
        }

        // 3. Audit Geo Performance
        const { data: geoStats, error: geoError } = await supabase
            .from('google_geo_performance')
            .select('*');

        if (geoError) throw geoError;

        const geoViolations: AuditResult['geo_violations'] = [];

        for (const stat of (geoStats || [])) {
            // Check if city is allowed
            // Note: city_name might be null for generic regions
            // Logic: If city is NOT in allowed list AND clicks > threshold = Violation
            if (stat.city_name && !ALLOWED_CITIES.includes(stat.city_name)) {
                if (stat.clicks > GEO_CLICK_THRESHOLD) {
                    geoViolations.push({
                        city: stat.city_name,
                        region: stat.region_name,
                        clicks: stat.clicks,
                        cost: stat.cost_micros / 1000000,
                        issue: `Free BID: Veiculação fora da praça permitida (> ${GEO_CLICK_THRESHOLD} cliques)`,
                        severity: 'high'
                    });
                }
            }
        }

        // 4. Calculate Score
        let score = 100;
        score -= (brandViolations.length * 15);
        score -= (geoViolations.length * 10);
        score = Math.max(0, score); // Min 0

        const result: AuditResult = {
            brand_violations: brandViolations,
            geo_violations: geoViolations,
            brand_health_score: score
        };

        return new Response(JSON.stringify(result), {
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

