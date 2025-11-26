import { db } from '../src/infrastructure/database/connection.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function generateMigration() {
  const output: string[] = [];
  
  output.push('-- ============================================');
  output.push('-- SCRIPT DE MIGRAÇÃO: DEVELOPMENT -> PRODUCTION');
  output.push('-- Execute este script no banco de PRODUÇÃO');
  output.push('-- ============================================');
  output.push('');
  output.push('-- Desabilitar constraints temporariamente');
  output.push("SET session_replication_role = 'replica';");
  output.push('');

  const escape = (val: any) => val ? String(val).replace(/'/g, "''") : null;
  const quote = (val: any) => val !== null && val !== undefined ? `'${escape(val)}'` : 'NULL';

  // Companies
  console.log('Exportando companies...');
  const companies = await db.execute(sql`SELECT * FROM companies`);
  output.push('-- COMPANIES');
  for (const row of companies.rows as any[]) {
    output.push(`INSERT INTO companies (id, name, slug, logo_url, primary_color, status, subscription_plan, subscription_status, subscription_start_date, subscription_end_date, trial_ends_at, max_users, max_campaigns, max_audits_per_month, current_users, current_campaigns, audits_this_month, contact_email, contact_phone, billing_email, tax_id, settings, metadata, created_at, updated_at) VALUES (${quote(row.id)}, ${quote(row.name)}, ${quote(row.slug)}, ${quote(row.logo_url)}, ${quote(row.primary_color)}, ${quote(row.status)}, ${quote(row.subscription_plan)}, ${quote(row.subscription_status)}, ${quote(row.subscription_start_date)}, ${quote(row.subscription_end_date)}, ${quote(row.trial_ends_at)}, ${row.max_users}, ${row.max_campaigns}, ${row.max_audits_per_month}, ${row.current_users}, ${row.current_campaigns}, ${row.audits_this_month}, ${quote(row.contact_email)}, ${quote(row.contact_phone)}, ${quote(row.billing_email)}, ${quote(row.tax_id)}, ${row.settings ? quote(JSON.stringify(row.settings)) : 'NULL'}, ${row.metadata ? quote(JSON.stringify(row.metadata)) : 'NULL'}, ${quote(row.created_at)}, ${quote(row.updated_at)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Subscription Plans
  console.log('Exportando subscription_plans...');
  const plans = await db.execute(sql`SELECT * FROM subscription_plans`);
  output.push('-- SUBSCRIPTION PLANS');
  for (const row of plans.rows as any[]) {
    output.push(`INSERT INTO subscription_plans (id, name, slug, description, monthly_pricing, annual_pricing, price, billing_cycle, enable_trial, is_active, display_order, is_popular, investment_range, max_users, max_campaigns, max_audits_per_month, max_integrations, features, created_at, updated_at) VALUES (${quote(row.id)}, ${quote(row.name)}, ${quote(row.slug)}, ${quote(row.description)}, ${row.monthly_pricing}, ${row.annual_pricing}, ${row.price}, ${quote(row.billing_cycle)}, ${row.enable_trial}, ${row.is_active}, ${row.display_order}, ${row.is_popular}, ${quote(row.investment_range)}, ${row.max_users}, ${row.max_campaigns}, ${row.max_audits_per_month}, ${row.max_integrations}, ${row.features ? quote(JSON.stringify(row.features)) : 'NULL'}, ${quote(row.created_at)}, ${quote(row.updated_at)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Integrations
  console.log('Exportando integrations...');
  const integrations = await db.execute(sql`SELECT * FROM integrations`);
  output.push('-- INTEGRATIONS');
  for (const row of integrations.rows as any[]) {
    output.push(`INSERT INTO integrations (id, user_id, platform, access_token, refresh_token, account_id, status, last_sync, created_at, updated_at, data_source, account_name, account_status, last_full_sync) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.platform)}, ${quote(row.access_token)}, ${quote(row.refresh_token)}, ${quote(row.account_id)}, ${quote(row.status)}, ${quote(row.last_sync)}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${quote(row.data_source)}, ${quote(row.account_name)}, ${quote(row.account_status)}, ${quote(row.last_full_sync)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Campaigns
  console.log('Exportando campaigns...');
  const campaigns = await db.execute(sql`SELECT * FROM campaigns`);
  output.push(`-- CAMPAIGNS (${campaigns.rows.length} registros)`);
  for (const row of campaigns.rows as any[]) {
    output.push(`INSERT INTO campaigns (id, user_id, integration_id, external_id, name, platform, status, budget, created_at, updated_at, company_id, account, objective) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.integration_id)}, ${quote(row.external_id)}, ${quote(row.name)}, ${quote(row.platform)}, ${quote(row.status)}, ${row.budget || 'NULL'}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${quote(row.company_id)}, ${quote(row.account)}, ${quote(row.objective)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Ad Sets
  console.log('Exportando ad_sets...');
  const adSets = await db.execute(sql`SELECT * FROM ad_sets`);
  output.push(`-- AD SETS (${adSets.rows.length} registros)`);
  for (const row of adSets.rows as any[]) {
    output.push(`INSERT INTO ad_sets (id, user_id, campaign_id, external_id, name, status, daily_budget, lifetime_budget, bid_strategy, targeting, start_time, end_time, created_at, updated_at, impressions, clicks, spend, company_id, platform) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.campaign_id)}, ${quote(row.external_id)}, ${quote(row.name)}, ${quote(row.status)}, ${row.daily_budget || 'NULL'}, ${row.lifetime_budget || 'NULL'}, ${quote(row.bid_strategy)}, ${row.targeting ? quote(JSON.stringify(row.targeting)) : 'NULL'}, ${quote(row.start_time)}, ${quote(row.end_time)}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${row.impressions || 0}, ${row.clicks || 0}, ${row.spend || 0}, ${quote(row.company_id)}, ${quote(row.platform)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Creatives (depois de campaigns e ad_sets)
  console.log('Exportando creatives...');
  const creatives = await db.execute(sql`SELECT * FROM creatives`);
  output.push(`-- CREATIVES (${creatives.rows.length} registros)`);
  for (const row of creatives.rows as any[]) {
    output.push(`INSERT INTO creatives (id, user_id, campaign_id, external_id, name, type, image_url, video_url, text, headline, description, call_to_action, status, impressions, clicks, conversions, ctr, cpc, created_at, updated_at, ad_set_id, company_id, platform) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.campaign_id)}, ${quote(row.external_id)}, ${quote(row.name)}, ${quote(row.type)}, ${quote(row.image_url)}, ${quote(row.video_url)}, ${quote(row.text)}, ${quote(row.headline)}, ${quote(row.description)}, ${quote(row.call_to_action)}, ${quote(row.status)}, ${row.impressions || 0}, ${row.clicks || 0}, ${row.conversions || 0}, ${row.ctr || 0}, ${row.cpc || 0}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${quote(row.ad_set_id)}, ${quote(row.company_id)}, ${quote(row.platform)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Platform Settings
  console.log('Exportando platform_settings...');
  const platformSettings = await db.execute(sql`SELECT * FROM platform_settings`);
  output.push('-- PLATFORM SETTINGS');
  for (const row of platformSettings.rows as any[]) {
    output.push(`INSERT INTO platform_settings (id, platform, app_id, app_secret, redirect_uri, is_configured, created_at, updated_at) VALUES (${quote(row.id)}, ${quote(row.platform)}, ${quote(row.app_id)}, ${quote(row.app_secret)}, ${quote(row.redirect_uri)}, ${row.is_configured}, ${quote(row.created_at)}, ${quote(row.updated_at)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Policies
  console.log('Exportando policies...');
  const policies = await db.execute(sql`SELECT * FROM policies`);
  output.push('-- POLICIES');
  for (const row of policies.rows as any[]) {
    output.push(`INSERT INTO policies (id, user_id, name, description, platform, status, rules, created_at, updated_at, company_id) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.name)}, ${quote(row.description)}, ${quote(row.platform)}, ${quote(row.status)}, ${row.rules ? quote(JSON.stringify(row.rules)) : 'NULL'}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${quote(row.company_id)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Audits
  console.log('Exportando audits...');
  const audits = await db.execute(sql`SELECT * FROM audits`);
  output.push('-- AUDITS');
  for (const row of audits.rows as any[]) {
    output.push(`INSERT INTO audits (id, user_id, creative_id, status, score, results, recommendations, created_at, updated_at, company_id) VALUES (${quote(row.id)}, ${quote(row.user_id)}, ${quote(row.creative_id)}, ${quote(row.status)}, ${row.score || 0}, ${row.results ? quote(JSON.stringify(row.results)) : 'NULL'}, ${row.recommendations ? quote(JSON.stringify(row.recommendations)) : 'NULL'}, ${quote(row.created_at)}, ${quote(row.updated_at)}, ${quote(row.company_id)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Sync History
  console.log('Exportando sync_history...');
  const syncHistory = await db.execute(sql`SELECT * FROM sync_history`);
  output.push('-- SYNC HISTORY');
  for (const row of syncHistory.rows as any[]) {
    output.push(`INSERT INTO sync_history (id, integration_id, user_id, type, status, campaigns_synced, ad_sets_synced, creative_synced, error_message, started_at, completed_at, created_at, metadata) VALUES (${quote(row.id)}, ${quote(row.integration_id)}, ${quote(row.user_id)}, ${quote(row.type)}, ${quote(row.status)}, ${row.campaigns_synced || 0}, ${row.ad_sets_synced || 0}, ${row.creative_synced || 0}, ${quote(row.error_message)}, ${quote(row.started_at)}, ${quote(row.completed_at)}, ${quote(row.created_at)}, ${row.metadata ? quote(JSON.stringify(row.metadata)) : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  output.push('-- Reabilitar constraints');
  output.push("SET session_replication_role = 'origin';");
  output.push('');
  output.push('-- FIM DO SCRIPT');

  fs.writeFileSync('/home/runner/workspace/migration_to_production.sql', output.join('\n'));
  console.log('\n✅ Script salvo em: migration_to_production.sql');
  console.log(`Total de linhas: ${output.length}`);
  
  process.exit(0);
}

generateMigration().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
