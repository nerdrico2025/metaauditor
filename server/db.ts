import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// 🚨 DEPLOYMENT ENVIRONMENT DETECTION AND FIX 🚨
// This fixes the persistent "ENOTFOUND helium" error in Replit deploy previews
function isDeploymentEnvironment(): boolean {
  return !!(
    process.env.REPLIT_DEPLOYMENT ||
    process.env.REPLIT_ENVIRONMENT === 'production' ||
    process.env.REPLIT_HELIUM_ENABLED === 'true'
  );
}

function clearProblematicPGVariables() {
  // In deployment environments, Replit sets PGHOST=helium which doesn't exist
  // We must clear these to prevent the @neondatabase/serverless client from using them
  const deployment = isDeploymentEnvironment();
  
  if (deployment && process.env.PGHOST === 'helium') {
    console.log('🚨 DEPLOYMENT FIX: Detected PGHOST=helium, clearing problematic PG variables');
    delete process.env.PGHOST;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    delete process.env.PGDATABASE;
    delete process.env.PGPORT;
  }
  
  console.log('🔍 Environment check:', {
    isDeployment: deployment,
    pgHost: process.env.PGHOST || 'undefined',
    heliumEnabled: process.env.REPLIT_HELIUM_ENABLED,
    environment: process.env.REPLIT_ENVIRONMENT || process.env.NODE_ENV
  });
}

// Clear problematic variables BEFORE doing anything else
clearProblematicPGVariables();

// Robust DATABASE_URL detection with deployment-specific logic
function getDatabaseUrl(): string {
  const envDatabaseUrl = process.env.DATABASE_URL;
  const isDeployment = isDeploymentEnvironment();
  
  // In deployment environment, DATABASE_URL is our only reliable source
  if (isDeployment) {
    if (envDatabaseUrl && envDatabaseUrl.includes('neon.tech')) {
      console.log('🚀 DEPLOYMENT: Using verified Neon DATABASE_URL');
      return envDatabaseUrl;
    } else if (envDatabaseUrl) {
      console.warn('⚠️ DEPLOYMENT: DATABASE_URL present but not Neon format:', envDatabaseUrl.substring(0, 30) + '...');
      return envDatabaseUrl;
    }
  }
  
  // Development environment logic
  if (envDatabaseUrl && !envDatabaseUrl.includes('@helium/') && !envDatabaseUrl.includes('@helium:')) {
    console.log('🔗 DEVELOPMENT: Using environment DATABASE_URL');
    return envDatabaseUrl;
  }
  
  // Fallback options
  const neonUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_NEON;
  if (neonUrl) {
    console.log('🔗 Using Neon-specific DATABASE_URL');
    return neonUrl;
  }
  
  // Last resort - log error details
  if (envDatabaseUrl) {
    try {
      const urlObj = new URL(envDatabaseUrl);
      console.warn('⚠️ Last resort - using DATABASE_URL with hostname:', urlObj.hostname);
      return envDatabaseUrl;
    } catch (e) {
      console.error('❌ Invalid DATABASE_URL format:', e);
    }
  }
  
  throw new Error("❌ CRITICAL: No valid DATABASE_URL found. Check deployment configuration.");
}

const DATABASE_URL = getDatabaseUrl();

// Validate and log connection details
const urlObj = new URL(DATABASE_URL);
const isHeliumHost = urlObj.hostname === 'helium';

if (isHeliumHost) {
  console.error('❌ CRITICAL ERROR: Still attempting to connect to "helium" hostname!');
  console.error('🔧 DATABASE_URL:', DATABASE_URL.substring(0, 50) + '...');
  throw new Error('DEPLOYMENT CONFIGURATION ERROR: Cannot connect to helium hostname');
}

console.log('✅ Database connection validated:', {
  host: urlObj.hostname,
  port: urlObj.port || '5432',
  database: urlObj.pathname.substring(1),
  ssl: urlObj.searchParams.get('sslmode'),
  environment: isDeploymentEnvironment() ? 'DEPLOYMENT' : 'DEVELOPMENT',
  isNeonDb: urlObj.hostname.includes('neon.tech'),
  protocol: urlObj.protocol
});

// Connection configuration with deployment-specific settings
const connectionConfig = {
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // More conservative settings for deployment
  max: isDeploymentEnvironment() ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // Increased for deployment
  // Force connection string usage over individual PG* vars
  host: undefined,
  user: undefined, 
  password: undefined,
  database: undefined,
  port: undefined
};

export const pool = new Pool(connectionConfig);

// Enhanced error handling with deployment-specific messaging
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  
  if (err.message.includes('ENOTFOUND helium')) {
    console.error('🚨 HELIUM ERROR DETECTED - This should be fixed now!');
    console.error('🔧 Current DATABASE_URL host:', urlObj.hostname);
    console.error('🔧 Environment:', isDeploymentEnvironment() ? 'DEPLOYMENT' : 'DEVELOPMENT');
  }
  
  if (err.message.includes('ENOTFOUND')) {
    console.error('🔧 DNS Resolution failed for host:', err.message);
  }
});

pool.on('connect', () => {
  const env = isDeploymentEnvironment() ? 'DEPLOYMENT' : 'DEVELOPMENT';
  console.log(`✅ Database connected successfully in ${env} environment`);
});

export const db = drizzle({ client: pool, schema });