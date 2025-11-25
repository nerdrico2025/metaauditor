#!/usr/bin/env node

import { execSync, spawn } from 'child_process';

console.log('📦 Installing dependencies...');
execSync('npm install', { stdio: 'inherit' });

console.log('🔨 Building client...');
execSync('npm run build:client', { stdio: 'inherit' });

console.log('🔨 Building server...');
execSync('npm run build:server', { stdio: 'inherit' });

console.log('🚀 Starting production server...');
const server = spawn('node', ['./dist/main.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});
