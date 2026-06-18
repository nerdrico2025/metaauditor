import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: string[] = [];

    // Helper to run SQL
    const runSQL = async (label: string, sql: string) => {
        const { error } = await supabase.rpc("exec_sql", { sql });
        if (error) {
            // Try alternative approach - direct query
            results.push(`⚠ ${label}: ${error.message}`);
        } else {
            results.push(`✅ ${label}`);
        }
    };

    try {
        // ═══════════════════════════════════════════════════════════════
        // 1. FIX ALL RLS POLICIES — wrap auth.uid() in (select ...)
        //    This is the #1 cause of slow queries in Supabase
        // ═══════════════════════════════════════════════════════════════

        // Get all tables with RLS
        const tables = [
            "users", "companies", "profiles", "integrations",
            "campaigns", "ad_sets", "creatives",
            "campaign_metrics", "ad_set_metrics", "creative_metrics",
            "creative_rules", "creative_rule_checks",
            "performance_rules", "audits", "audit_issues"
        ];

        // For each table, drop all existing policies and recreate with optimized auth.uid()
        for (const table of tables) {
            try {
                // Get existing policies for this table
                const { data: policies } = await supabase.rpc("exec_sql", {
                    sql: `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = '${table}' AND schemaname = 'public';`
                });

                // Drop and recreate each policy with (select auth.uid())
                if (policies && Array.isArray(policies)) {
                    for (const policy of policies) {
                        const oldQual = policy.qual || "";
                        const oldCheck = policy.with_check || "";

                        // Check if it uses auth.uid() without select wrapper
                        if (
                            (oldQual.includes("auth.uid()") && !oldQual.includes("(select auth.uid())")) ||
                            (oldCheck.includes("auth.uid()") && !oldCheck.includes("(select auth.uid())"))
                        ) {
                            const newQual = oldQual.replace(/auth\.uid\(\)/g, "(select auth.uid())");
                            const newCheck = oldCheck.replace(/auth\.uid\(\)/g, "(select auth.uid())");

                            let recreateSQL = `DROP POLICY IF EXISTS "${policy.policyname}" ON ${table};\n`;
                            recreateSQL += `CREATE POLICY "${policy.policyname}" ON ${table}`;

                            if (policy.cmd === "SELECT") {
                                recreateSQL += ` FOR SELECT USING (${newQual});`;
                            } else if (policy.cmd === "INSERT") {
                                recreateSQL += ` FOR INSERT WITH CHECK (${newCheck || newQual});`;
                            } else if (policy.cmd === "UPDATE") {
                                recreateSQL += ` FOR UPDATE USING (${newQual})`;
                                if (newCheck) recreateSQL += ` WITH CHECK (${newCheck})`;
                                recreateSQL += ";";
                            } else if (policy.cmd === "DELETE") {
                                recreateSQL += ` FOR DELETE USING (${newQual});`;
                            } else {
                                recreateSQL += ` USING (${newQual});`;
                            }

                            await runSQL(`Fix RLS: ${table}.${policy.policyname}`, recreateSQL);
                        }
                    }
                }
            } catch (e) {
                results.push(`⚠ Could not process table ${table}: ${(e as Error).message}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 2. ADD MISSING INDEXES
        // ═══════════════════════════════════════════════════════════════

        const indexes = [
            "CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);",
            "CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);",
            "CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_integrations_company_id ON integrations(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON campaigns(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_campaigns_integration_id ON campaigns(integration_id);",
            "CREATE INDEX IF NOT EXISTS idx_creatives_company_id ON creatives(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_creatives_external_id ON creatives(external_id);",
            "CREATE INDEX IF NOT EXISTS idx_creatives_campaign_id ON creatives(campaign_id);",
            "CREATE INDEX IF NOT EXISTS idx_creatives_status ON creatives(status);",
            "CREATE INDEX IF NOT EXISTS idx_creative_rules_company_id ON creative_rules(company_id);",
            "CREATE INDEX IF NOT EXISTS idx_creative_rule_checks_creative_id ON creative_rule_checks(creative_id);",
            "CREATE INDEX IF NOT EXISTS idx_campaign_metrics_company_campaign ON campaign_metrics(company_id, campaign_id);",
            "CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(date);",
            "CREATE INDEX IF NOT EXISTS idx_audits_creative_id ON audits(creative_id);",
            "CREATE INDEX IF NOT EXISTS idx_audits_company_id ON audits(company_id);",
        ];

        for (const idx of indexes) {
            await runSQL(`Index: ${idx.match(/idx_\w+/)?.[0] || "unknown"}`, idx);
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. REFRESH POSTGREST SCHEMA CACHE + VACUUM ANALYZE
        // ═══════════════════════════════════════════════════════════════

        await runSQL("Reload PostgREST schema", "NOTIFY pgrst, 'reload schema';");
        await runSQL("ANALYZE all tables", "ANALYZE;");

        return new Response(JSON.stringify({
            success: true,
            results,
            message: `Optimization complete: ${results.filter(r => r.startsWith("✅")).length} successful, ${results.filter(r => r.startsWith("⚠")).length} warnings`
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: (err as Error).message,
            results,
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
