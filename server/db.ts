import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Priority order for DATABASE_URL detection
// 1. Direct environment variable (Replit sets this correctly)
// 2. Fallback to a known Neon pattern if available
function getDatabaseUrl(): string {
  const envDatabaseUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL contains 'helium' hostname, it's the cached/stale config
  // We should prioritize the real Neon PostgreSQL URL
  if (envDatabaseUrl && !envDatabaseUrl.includes('@helium/')) {
    console.log('🔗 Using environment DATABASE_URL');
    return envDatabaseUrl;
  }
  
  // Check for Neon-specific environment variables
  const neonUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_NEON;
  if (neonUrl) {
    console.log('🔗 Using Neon-specific DATABASE_URL');
    return neonUrl;
  }
  
  // If we get here and have any DATABASE_URL, log a warning but try to use it
  if (envDatabaseUrl) {
    console.warn('⚠️ Using potentially stale DATABASE_URL with hostname:', new URL(envDatabaseUrl).hostname);
    return envDatabaseUrl;
  }
  
  throw new Error("No valid DATABASE_URL found. Ensure the database is properly configured.");
}

const DATABASE_URL = getDatabaseUrl();

// Log connection info for debugging (without exposing credentials)
const urlObj = new URL(DATABASE_URL);
console.log('🔗 Database connection info:', {
  host: urlObj.hostname,
  port: urlObj.port,
  database: urlObj.pathname.substring(1),
  ssl: urlObj.searchParams.get('sslmode'),
  environment: process.env.NODE_ENV,
  isNeonDb: urlObj.hostname.includes('neon.tech')
});

// Enhanced connection configuration for different environments
const connectionConfig = {
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pooling configuration
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(connectionConfig);

// Graceful connection handling
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.message.includes('ENOTFOUND helium')) {
    console.error('🚨 Detected helium hostname error - this is likely a stale configuration');
  }
});

pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

export const db = drizzle({ client: pool, schema });