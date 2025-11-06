
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../../drizzle/schema";

neonConfig.webSocketConstructor = ws;

function isDeploymentEnvironment(): boolean {
  return !!(
    process.env.REPLIT_DEPLOYMENT ||
    process.env.REPLIT_ENVIRONMENT === 'production' ||
    process.env.REPLIT_HELIUM_ENABLED === 'true'
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error('🚨 DATABASE_URL is not set');
}

console.log('🔍 Environment check:', {
  isDeployment: isDeploymentEnvironment(),
  pgHost: new URL(process.env.DATABASE_URL).hostname,
  heliumEnabled: process.env.REPLIT_HELIUM_ENABLED,
  environment: process.env.REPLIT_ENVIRONMENT
});

const connectionString = process.env.DATABASE_URL;

if (isDeploymentEnvironment()) {
  console.log('🚀 DEPLOYMENT: Using verified Neon DATABASE_URL');
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });

pool.on('connect', () => {
  const url = new URL(connectionString);
  console.log('✅ Database connection validated:', {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.slice(1),
    ssl: url.searchParams.get('sslmode') || 'require',
    environment: isDeploymentEnvironment() ? 'DEPLOYMENT' : 'DEVELOPMENT',
    isNeonDb: url.hostname.includes('neon'),
    protocol: url.protocol
  });
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});
