#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  console.log('🔨 Building client...');
  execSync('npm run build:client', { stdio: 'inherit', cwd: __dirname });

  console.log('🔨 Building server...');
  execSync('npm run build:server', { stdio: 'inherit', cwd: __dirname });

  console.log('🚀 Starting server...');
  execSync('npm run start --workspace=server', { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('❌ Error during startup:', error.message);
  process.exit(1);
}
