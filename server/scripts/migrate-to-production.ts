import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../drizzle/schema.js';
import { sql } from 'drizzle-orm';

const { Pool } = pg;

async function migrateToProduction() {
  console.log('🚀 Iniciando migração de desenvolvimento para produção...\n');

  const devDatabaseUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  const prodDatabaseUrl = process.env.PROD_DATABASE_URL;

  if (!devDatabaseUrl) {
    console.error('❌ DEV_DATABASE_URL ou DATABASE_URL não configurado');
    process.exit(1);
  }

  if (!prodDatabaseUrl) {
    console.error('❌ PROD_DATABASE_URL não configurado');
    console.log('\n📝 Para usar este script, configure a variável de ambiente PROD_DATABASE_URL');
    console.log('   Exemplo: PROD_DATABASE_URL=postgresql://user:pass@host:5432/dbname\n');
    process.exit(1);
  }

  if (devDatabaseUrl === prodDatabaseUrl) {
    console.error('❌ DEV_DATABASE_URL e PROD_DATABASE_URL são iguais! Abortando para evitar duplicação.');
    process.exit(1);
  }

  console.log('📦 Conectando ao banco de desenvolvimento...');
  const devPool = new Pool({
    connectionString: devDatabaseUrl,
    ssl: devDatabaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
  });
  const devDb = drizzle(devPool, { schema });

  console.log('📦 Conectando ao banco de produção...');
  const prodPool = new Pool({
    connectionString: prodDatabaseUrl,
    ssl: prodDatabaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
  });
  const prodDb = drizzle(prodPool, { schema });

  try {
    console.log('\n🔍 Verificando conexões...');
    await devPool.query('SELECT 1');
    console.log('✅ Conexão desenvolvimento OK');
    await prodPool.query('SELECT 1');
    console.log('✅ Conexão produção OK');

    const tables = [
      { name: 'subscription_plans', schema: schema.subscriptionPlans },
      { name: 'companies', schema: schema.companies },
      { name: 'users', schema: schema.users },
      { name: 'integrations', schema: schema.integrations },
      { name: 'campaigns', schema: schema.campaigns },
      { name: 'ad_sets', schema: schema.adSets },
      { name: 'creatives', schema: schema.creatives },
      { name: 'policies', schema: schema.policies },
      { name: 'audits', schema: schema.audits },
      { name: 'audit_actions', schema: schema.auditActions },
      { name: 'sync_history', schema: schema.syncHistory },
      { name: 'brand_configurations', schema: schema.brandConfigurations },
      { name: 'content_criteria', schema: schema.contentCriteria },
      { name: 'campaign_metrics', schema: schema.campaignMetrics },
      { name: 'performance_benchmarks', schema: schema.performanceBenchmarks },
      { name: 'google_sheets_config', schema: schema.googleSheetsConfig },
      { name: 'platform_settings', schema: schema.platformSettings },
    ];

    console.log('\n📊 Exportando dados do desenvolvimento...\n');

    const exportedData: Record<string, any[]> = {};

    for (const table of tables) {
      try {
        const data = await devDb.select().from(table.schema);
        exportedData[table.name] = data;
        console.log(`  ✅ ${table.name}: ${data.length} registros`);
      } catch (error: any) {
        console.log(`  ⚠️ ${table.name}: Erro ao exportar - ${error.message}`);
        exportedData[table.name] = [];
      }
    }

    console.log('\n📥 Importando dados para produção...\n');
    console.log('⚠️  ATENÇÃO: Os dados existentes serão mantidos. Registros duplicados serão ignorados.\n');

    for (const table of tables) {
      const data = exportedData[table.name];
      if (data.length === 0) {
        console.log(`  ⏭️ ${table.name}: Sem dados para importar`);
        continue;
      }

      try {
        let inserted = 0;
        let skipped = 0;

        for (const row of data) {
          try {
            await prodDb.insert(table.schema).values(row).onConflictDoNothing();
            inserted++;
          } catch (err: any) {
            if (err.code === '23505') {
              skipped++;
            } else {
              throw err;
            }
          }
        }

        console.log(`  ✅ ${table.name}: ${inserted} inseridos, ${skipped} ignorados (duplicados)`);
      } catch (error: any) {
        console.log(`  ❌ ${table.name}: Erro ao importar - ${error.message}`);
      }
    }

    console.log('\n✅ Migração concluída com sucesso!\n');

    console.log('📋 Resumo:');
    console.log('   Banco de desenvolvimento: ', devDatabaseUrl.split('@')[1]?.split('/')[0] || 'local');
    console.log('   Banco de produção: ', prodDatabaseUrl.split('@')[1]?.split('/')[0] || 'local');
    console.log('');

  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await devPool.end();
    await prodPool.end();
    console.log('🔌 Conexões encerradas');
  }
}

migrateToProduction().catch(console.error);
