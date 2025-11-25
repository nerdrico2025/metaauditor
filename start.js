#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  console.log('🔨 Building client and server...');
  execSync('npm run build:client && npm run build:server', { stdio: 'inherit' });

  console.log('🚀 Starting server...');
  execSync('NODE_ENV=production node ./dist/main.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
