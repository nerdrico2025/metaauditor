import { db } from './server/src/infrastructure/database/connection.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function generateMigration() {
  const output = [];
  
  output.push('-- ============================================');
  output.push('-- SCRIPT DE MIGRAÇÃO: DEVELOPMENT -> PRODUCTION');
  output.push('-- Execute este script no banco de PRODUÇÃO');
  output.push('-- ============================================');
  output.push('');
  output.push('-- Desabilitar constraints temporariamente');
  output.push("SET session_replication_role = 'replica';");
  output.push('');

  // Companies
  console.log('Exportando companies...');
  const companies = await db.execute(sql`SELECT * FROM companies`);
  output.push('-- COMPANIES');
  for (const row of companies.rows) {
    output.push(`INSERT INTO companies (id, name, slug, logo_url, primary_color, status, subscription_plan, subscription_status, subscription_start_date, subscription_end_date, trial_ends_at, max_users, max_campaigns, max_audits_per_month, current_users, current_campaigns, audits_this_month, contact_email, contact_phone, billing_email, tax_id, settings, metadata, created_at, updated_at) VALUES ('${row.id}', '${row.name}', '${row.slug}', ${row.logo_url ? `'${row.logo_url}'` : 'NULL'}, ${row.primary_color ? `'${row.primary_color}'` : 'NULL'}, '${row.status}', '${row.subscription_plan}', '${row.subscription_status}', ${row.subscription_start_date ? `'${row.subscription_start_date}'` : 'NULL'}, ${row.subscription_end_date ? `'${row.subscription_end_date}'` : 'NULL'}, ${row.trial_ends_at ? `'${row.trial_ends_at}'` : 'NULL'}, ${row.max_users}, ${row.max_campaigns}, ${row.max_audits_per_month}, ${row.current_users}, ${row.current_campaigns}, ${row.audits_this_month}, ${row.contact_email ? `'${row.contact_email}'` : 'NULL'}, ${row.contact_phone ? `'${row.contact_phone}'` : 'NULL'}, ${row.billing_email ? `'${row.billing_email}'` : 'NULL'}, ${row.tax_id ? `'${row.tax_id}'` : 'NULL'}, ${row.settings ? `'${JSON.stringify(row.settings)}'` : 'NULL'}, ${row.metadata ? `'${JSON.stringify(row.metadata)}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}') ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Subscription Plans
  console.log('Exportando subscription_plans...');
  const plans = await db.execute(sql`SELECT * FROM subscription_plans`);
  output.push('-- SUBSCRIPTION PLANS');
  for (const row of plans.rows) {
    output.push(`INSERT INTO subscription_plans (id, name, slug, description, monthly_pricing, annual_pricing, price, billing_cycle, enable_trial, is_active, display_order, is_popular, investment_range, max_users, max_campaigns, max_audits_per_month, max_integrations, features, created_at, updated_at) VALUES ('${row.id}', '${row.name}', '${row.slug}', ${row.description ? `'${row.description.replace(/'/g, "''")}'` : 'NULL'}, ${row.monthly_pricing}, ${row.annual_pricing}, ${row.price}, '${row.billing_cycle}', ${row.enable_trial}, ${row.is_active}, ${row.display_order}, ${row.is_popular}, ${row.investment_range ? `'${row.investment_range}'` : 'NULL'}, ${row.max_users}, ${row.max_campaigns}, ${row.max_audits_per_month}, ${row.max_integrations}, ${row.features ? `'${JSON.stringify(row.features)}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}') ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Integrations
  console.log('Exportando integrations...');
  const integrations = await db.execute(sql`SELECT * FROM integrations`);
  output.push('-- INTEGRATIONS');
  for (const row of integrations.rows) {
    const accessToken = row.access_token ? row.access_token.replace(/'/g, "''") : null;
    const refreshToken = row.refresh_token ? row.refresh_token.replace(/'/g, "''") : null;
    output.push(`INSERT INTO integrations (id, user_id, platform, access_token, refresh_token, account_id, status, last_sync, created_at, updated_at, data_source, account_name, account_status, last_full_sync) VALUES ('${row.id}', '${row.user_id}', '${row.platform}', ${accessToken ? `'${accessToken}'` : 'NULL'}, ${refreshToken ? `'${refreshToken}'` : 'NULL'}, ${row.account_id ? `'${row.account_id}'` : 'NULL'}, '${row.status}', ${row.last_sync ? `'${row.last_sync}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}', ${row.data_source ? `'${row.data_source}'` : 'NULL'}, ${row.account_name ? `'${row.account_name}'` : 'NULL'}, ${row.account_status ? `'${row.account_status}'` : 'NULL'}, ${row.last_full_sync ? `'${row.last_full_sync}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Campaigns
  console.log('Exportando campaigns...');
  const campaigns = await db.execute(sql`SELECT * FROM campaigns`);
  output.push('-- CAMPAIGNS');
  for (const row of campaigns.rows) {
    const name = row.name ? row.name.replace(/'/g, "''") : '';
    output.push(`INSERT INTO campaigns (id, user_id, integration_id, external_id, name, platform, status, budget, created_at, updated_at, company_id, account, objective) VALUES ('${row.id}', '${row.user_id}', ${row.integration_id ? `'${row.integration_id}'` : 'NULL'}, ${row.external_id ? `'${row.external_id}'` : 'NULL'}, '${name}', '${row.platform}', '${row.status}', ${row.budget || 'NULL'}, '${row.created_at}', '${row.updated_at}', ${row.company_id ? `'${row.company_id}'` : 'NULL'}, ${row.account ? `'${row.account}'` : 'NULL'}, ${row.objective ? `'${row.objective}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Ad Sets
  console.log('Exportando ad_sets...');
  const adSets = await db.execute(sql`SELECT * FROM ad_sets`);
  output.push('-- AD SETS');
  for (const row of adSets.rows) {
    const name = row.name ? row.name.replace(/'/g, "''") : '';
    const targeting = row.targeting ? JSON.stringify(row.targeting).replace(/'/g, "''") : null;
    output.push(`INSERT INTO ad_sets (id, user_id, campaign_id, external_id, name, status, daily_budget, lifetime_budget, bid_strategy, targeting, start_time, end_time, created_at, updated_at, impressions, clicks, spend, company_id, platform) VALUES ('${row.id}', '${row.user_id}', '${row.campaign_id}', ${row.external_id ? `'${row.external_id}'` : 'NULL'}, '${name}', '${row.status}', ${row.daily_budget || 'NULL'}, ${row.lifetime_budget || 'NULL'}, ${row.bid_strategy ? `'${row.bid_strategy}'` : 'NULL'}, ${targeting ? `'${targeting}'` : 'NULL'}, ${row.start_time ? `'${row.start_time}'` : 'NULL'}, ${row.end_time ? `'${row.end_time}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}', ${row.impressions || 0}, ${row.clicks || 0}, ${row.spend || 0}, ${row.company_id ? `'${row.company_id}'` : 'NULL'}, ${row.platform ? `'${row.platform}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Creatives
  console.log('Exportando creatives...');
  const creatives = await db.execute(sql`SELECT * FROM creatives`);
  output.push('-- CREATIVES');
  for (const row of creatives.rows) {
    const name = row.name ? row.name.replace(/'/g, "''") : '';
    const text = row.text ? row.text.replace(/'/g, "''") : null;
    const headline = row.headline ? row.headline.replace(/'/g, "''") : null;
    const description = row.description ? row.description.replace(/'/g, "''") : null;
    output.push(`INSERT INTO creatives (id, user_id, campaign_id, external_id, name, type, image_url, video_url, text, headline, description, call_to_action, status, impressions, clicks, conversions, ctr, cpc, created_at, updated_at, ad_set_id, company_id, platform) VALUES ('${row.id}', '${row.user_id}', '${row.campaign_id}', ${row.external_id ? `'${row.external_id}'` : 'NULL'}, '${name}', ${row.type ? `'${row.type}'` : 'NULL'}, ${row.image_url ? `'${row.image_url}'` : 'NULL'}, ${row.video_url ? `'${row.video_url}'` : 'NULL'}, ${text ? `'${text}'` : 'NULL'}, ${headline ? `'${headline}'` : 'NULL'}, ${description ? `'${description}'` : 'NULL'}, ${row.call_to_action ? `'${row.call_to_action}'` : 'NULL'}, '${row.status}', ${row.impressions || 0}, ${row.clicks || 0}, ${row.conversions || 0}, ${row.ctr || 0}, ${row.cpc || 0}, '${row.created_at}', '${row.updated_at}', ${row.ad_set_id ? `'${row.ad_set_id}'` : 'NULL'}, ${row.company_id ? `'${row.company_id}'` : 'NULL'}, ${row.platform ? `'${row.platform}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Platform Settings
  console.log('Exportando platform_settings...');
  const platformSettings = await db.execute(sql`SELECT * FROM platform_settings`);
  output.push('-- PLATFORM SETTINGS');
  for (const row of platformSettings.rows) {
    const appSecret = row.app_secret ? row.app_secret.replace(/'/g, "''") : null;
    output.push(`INSERT INTO platform_settings (id, platform, app_id, app_secret, redirect_uri, is_configured, created_at, updated_at) VALUES ('${row.id}', '${row.platform}', ${row.app_id ? `'${row.app_id}'` : 'NULL'}, ${appSecret ? `'${appSecret}'` : 'NULL'}, ${row.redirect_uri ? `'${row.redirect_uri}'` : 'NULL'}, ${row.is_configured}, '${row.created_at}', '${row.updated_at}') ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Policies
  console.log('Exportando policies...');
  const policies = await db.execute(sql`SELECT * FROM policies`);
  output.push('-- POLICIES');
  for (const row of policies.rows) {
    const name = row.name ? row.name.replace(/'/g, "''") : '';
    const description = row.description ? row.description.replace(/'/g, "''") : null;
    const rules = row.rules ? JSON.stringify(row.rules).replace(/'/g, "''") : null;
    output.push(`INSERT INTO policies (id, user_id, name, description, platform, status, rules, created_at, updated_at, company_id) VALUES ('${row.id}', '${row.user_id}', '${name}', ${description ? `'${description}'` : 'NULL'}, '${row.platform}', '${row.status}', ${rules ? `'${rules}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}', ${row.company_id ? `'${row.company_id}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Audits
  console.log('Exportando audits...');
  const audits = await db.execute(sql`SELECT * FROM audits`);
  output.push('-- AUDITS');
  for (const row of audits.rows) {
    const results = row.results ? JSON.stringify(row.results).replace(/'/g, "''") : null;
    const recommendations = row.recommendations ? JSON.stringify(row.recommendations).replace(/'/g, "''") : null;
    output.push(`INSERT INTO audits (id, user_id, creative_id, status, score, results, recommendations, created_at, updated_at, company_id) VALUES ('${row.id}', '${row.user_id}', '${row.creative_id}', '${row.status}', ${row.score || 0}, ${results ? `'${results}'` : 'NULL'}, ${recommendations ? `'${recommendations}'` : 'NULL'}, '${row.created_at}', '${row.updated_at}', ${row.company_id ? `'${row.company_id}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push('');

  // Sync History
  console.log('Exportando sync_history...');
  const syncHistory = await db.execute(sql`SELECT * FROM sync_history`);
  output.push('-- SYNC HISTORY');
  for (const row of syncHistory.rows) {
    const metadata = row.metadata ? JSON.stringify(row.metadata).replace(/'/g, "''") : null;
    output.push(`INSERT INTO sync_history (id, integration_id, user_id, type, status, campaigns_synced, ad_sets_synced, creative_synced, error_message, started_at, completed_at, created_at, metadata) VALUES ('${row.id}', '${row.integration_id}', '${row.user_id}', '${row.type}', '${row.status}', ${row.campaigns_synced || 0}, ${row.ad_sets_synced || 0}, ${row.creative_synced || 0}, ${row.error_message ? `'${row.error_message.replace(/'/g, "''")}'` : 'NULL'}, ${row.started_at ? `'${row.started_at}'` : 'NULL'}, ${row.completed_at ? `'${row.completed_at}'` : 'NULL'}, '${row.created_at}', ${metadata ? `'${metadata}'` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`);
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
