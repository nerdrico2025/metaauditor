import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchActiveCampaignIds } from '../_shared/activeCampaignScope.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
    report_type: 'performance' | 'campaigns' | 'creatives' | 'audits';
    date_from?: string;
    date_to?: string;
    campaign_id?: string;
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
            .select('company_id, companies(name)')
            .eq('id', user.id)
            .single();

        if (!userData?.company_id) {
            throw new Error('User not associated with company');
        }

        const { report_type, date_from, date_to, campaign_id } = await req.json() as ReportRequest;

        const companyId = userData.company_id;
        const companyName = (userData as any).companies?.name || 'Empresa';
        const dateFromStr = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateToStr = date_to || new Date().toISOString().split('T')[0];

        let reportData: Record<string, unknown> = {
            company_name: companyName,
            report_type,
            date_from: dateFromStr,
            date_to: dateToStr,
            generated_at: new Date().toISOString(),
        };

        // Fetch data based on report type
        if (report_type === 'performance' || report_type === 'campaigns') {
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('id, name, status, objective, impressions, clicks, spend, conversions')
                .eq('company_id', companyId);

            const totals = (campaigns || []).reduce(
                (acc, c) => ({
                    impressions: acc.impressions + (c.impressions || 0),
                    clicks: acc.clicks + (c.clicks || 0),
                    spend: acc.spend + (Number(c.spend) || 0),
                    conversions: acc.conversions + (c.conversions || 0),
                }),
                { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
            );

            reportData = {
                ...reportData,
                summary: {
                    total_campaigns: campaigns?.length || 0,
                    active_campaigns: campaigns?.filter(c => c.status === 'active').length || 0,
                    total_impressions: totals.impressions,
                    total_clicks: totals.clicks,
                    total_spend: totals.spend.toFixed(2),
                    total_conversions: totals.conversions,
                    avg_ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0',
                    avg_cpc: totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0',
                },
                campaigns: campaigns?.slice(0, 20).map(c => ({
                    name: c.name,
                    status: c.status,
                    objective: c.objective,
                    impressions: c.impressions,
                    clicks: c.clicks,
                    spend: Number(c.spend || 0).toFixed(2),
                    ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0',
                })),
            };
        }

        if (report_type === 'creatives') {
            const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
            const query = supabase
                .from('creatives')
                .select('id, name, type, status, impressions, clicks, ctr, cpc, performance_score')
                .eq('company_id', companyId)
                .order('performance_score', { ascending: false })
                .limit(50);

            if (activeCampaignIds.length > 0) {
                query.in('campaign_id', activeCampaignIds);
            } else {
                query.in('campaign_id', ['00000000-0000-0000-0000-000000000000']);
            }

            if (campaign_id) {
                query.eq('campaign_id', campaign_id);
            }

            const { data: creatives } = await query;

            reportData = {
                ...reportData,
                summary: {
                    total_creatives: creatives?.length || 0,
                    avg_ctr: creatives?.length
                        ? (creatives.reduce((a, c) => a + (c.ctr || 0), 0) / creatives.length).toFixed(2)
                        : '0',
                    avg_performance: creatives?.length
                        ? (creatives.reduce((a, c) => a + (c.performance_score || 0), 0) / creatives.length).toFixed(0)
                        : '0',
                },
                creatives: creatives?.map(c => ({
                    name: c.name,
                    type: c.type,
                    status: c.status,
                    impressions: c.impressions,
                    clicks: c.clicks,
                    ctr: c.ctr?.toFixed(2) || '0',
                    cpc: c.cpc?.toFixed(2) || '0',
                    score: c.performance_score || 0,
                })),
            };
        }

        if (report_type === 'audits') {
            const activeCampaignIds = await fetchActiveCampaignIds(supabase, companyId);
            let scopedCreativeIds: string[] = [];
            if (activeCampaignIds.length > 0) {
                const { data: scopedCreatives } = await supabase
                    .from('creatives')
                    .select('id')
                    .eq('company_id', companyId)
                    .in('campaign_id', activeCampaignIds);
                scopedCreativeIds = (scopedCreatives ?? []).map((c) => c.id);
            }

            let auditsQuery = supabase
                .from('audits')
                .select('id, status, compliance_score, performance_score, created_at, creatives(name)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (scopedCreativeIds.length > 0) {
                auditsQuery = auditsQuery.in('creative_id', scopedCreativeIds);
            } else {
                auditsQuery = auditsQuery.in('creative_id', ['00000000-0000-0000-0000-000000000000']);
            }

            const { data: audits } = await auditsQuery;

            const statusCounts = (audits || []).reduce(
                (acc, a) => {
                    if (a.status === 'approved') acc.approved++;
                    else if (a.status === 'rejected') acc.rejected++;
                    else acc.review++;
                    return acc;
                },
                { approved: 0, rejected: 0, review: 0 }
            );

            reportData = {
                ...reportData,
                summary: {
                    total_audits: audits?.length || 0,
                    ...statusCounts,
                    avg_compliance: audits?.length
                        ? (audits.reduce((a, au) => a + (au.compliance_score || 0), 0) / audits.length).toFixed(0)
                        : '0',
                },
                audits: audits?.map(a => ({
                    creative_name: (a as any).creatives?.name || 'N/A',
                    status: a.status,
                    compliance_score: a.compliance_score,
                    performance_score: a.performance_score,
                    date: a.created_at,
                })),
            };
        }

        // Generate HTML report
        const html = generateReportHtml(reportData, report_type);

        // Save report record
        await supabase.from('reports').insert({
            company_id: companyId,
            user_id: user.id,
            report_type,
            date_from: dateFromStr,
            date_to: dateToStr,
            data: reportData,
        });

        return new Response(html, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/html; charset=utf-8',
            },
            status: 200,
        });

    } catch (error) {
        console.error('Report generation error:', error);
        return new Response(
            JSON.stringify({ success: false, error: String(error) }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});

function generateReportHtml(data: Record<string, unknown>, type: string): string {
    const summary = data.summary as Record<string, unknown>;
    const title = {
        performance: 'Relatório de Performance',
        campaigns: 'Relatório de Campanhas',
        creatives: 'Relatório de Criativos',
        audits: 'Relatório de Auditorias',
    }[type] || 'Relatório';

    let tableHtml = '';

    if (type === 'performance' || type === 'campaigns') {
        const campaigns = data.campaigns as Array<Record<string, unknown>> || [];
        tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Status</th>
            <th>Impressões</th>
            <th>Cliques</th>
            <th>CTR</th>
            <th>Gasto</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.map(c => `
            <tr>
              <td>${c.name}</td>
              <td><span class="status-${c.status}">${c.status}</span></td>
              <td>${Number(c.impressions).toLocaleString('pt-BR')}</td>
              <td>${Number(c.clicks).toLocaleString('pt-BR')}</td>
              <td>${c.ctr}%</td>
              <td>R$ ${c.spend}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    } else if (type === 'creatives') {
        const creatives = data.creatives as Array<Record<string, unknown>> || [];
        tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Criativo</th>
            <th>Tipo</th>
            <th>CTR</th>
            <th>CPC</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${creatives.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.type}</td>
              <td>${c.ctr}%</td>
              <td>R$ ${c.cpc}</td>
              <td>${c.score}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    } else if (type === 'audits') {
        const audits = data.audits as Array<Record<string, unknown>> || [];
        tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Criativo</th>
            <th>Status</th>
            <th>Conformidade</th>
            <th>Performance</th>
          </tr>
        </thead>
        <tbody>
          ${audits.map(a => `
            <tr>
              <td>${a.creative_name}</td>
              <td><span class="status-${a.status}">${a.status}</span></td>
              <td>${a.compliance_score || 0}%</td>
              <td>${a.performance_score || 0}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Click Auditor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0d12; color: #e5e5e5; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #2a2a35; }
    .logo { font-size: 24px; font-weight: bold; color: #ff6b35; }
    .report-info { text-align: right; color: #8a8a9a; font-size: 14px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 40px; }
    .metric { background: #1a1a24; padding: 20px; border-radius: 12px; }
    .metric-value { font-size: 28px; font-weight: bold; color: #ff6b35; }
    .metric-label { font-size: 13px; color: #8a8a9a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: #1a1a24; border-radius: 12px; overflow: hidden; }
    th, td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #2a2a35; }
    th { background: #22222e; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #8a8a9a; }
    td { font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .status-active, .status-approved { color: #22c55e; }
    .status-paused, .status-rejected { color: #ef4444; }
    .status-review { color: #eab308; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a35; text-align: center; color: #8a8a9a; font-size: 12px; }
    @media print {
      body { background: white; color: #1a1a24; padding: 20px; }
      .metric, table { background: #f5f5f5; }
      th { background: #e5e5e5; }
      .logo { color: #ff6b35; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">⚡ Click Auditor</div>
        <h1>${title}</h1>
      </div>
      <div class="report-info">
        <div>${data.company_name}</div>
        <div>${data.date_from} até ${data.date_to}</div>
      </div>
    </div>

    <div class="summary">
      ${Object.entries(summary).map(([key, value]) => `
        <div class="metric">
          <div class="metric-value">${typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</div>
          <div class="metric-label">${formatMetricLabel(key)}</div>
        </div>
      `).join('')}
    </div>

    ${tableHtml}

    <div class="footer">
      Relatório gerado em ${new Date().toLocaleString('pt-BR')} • Click Auditor
    </div>
  </div>
</body>
</html>`;
}

function formatMetricLabel(key: string): string {
    const labels: Record<string, string> = {
        total_campaigns: 'Total de Campanhas',
        active_campaigns: 'Campanhas Ativas',
        total_impressions: 'Impressões',
        total_clicks: 'Cliques',
        total_spend: 'Gasto Total',
        total_conversions: 'Conversões',
        avg_ctr: 'CTR Médio',
        avg_cpc: 'CPC Médio',
        total_creatives: 'Total de Criativos',
        avg_performance: 'Score Médio',
        total_audits: 'Total de Auditorias',
        approved: 'Aprovadas',
        rejected: 'Rejeitadas',
        review: 'Em Revisão',
        avg_compliance: 'Conformidade Média',
    };
    return labels[key] || key;
}
