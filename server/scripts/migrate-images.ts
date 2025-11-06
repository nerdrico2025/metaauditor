#!/usr/bin/env tsx

/**
 * Script to migrate existing creative images to local storage
 * Usage: tsx server/scripts/migrate-images.ts
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function migrateImages() {
  try {
    console.log('🔐 Logging in...');
    
    // Login to get auth token
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usuario.teste@clickauditor-demo.com',
        password: 'TesteFacebook2025!'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (!token) {
      throw new Error('No token received from login');
    }

    console.log('✅ Login successful!');
    console.log('');
    
    // Get migration status before
    console.log('📊 Checking current status...');
    const statusBefore = await fetch(`${API_BASE}/admin/migration-status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusBeforeData = await statusBefore.json();
    console.log('Status before migration:', statusBeforeData);
    console.log('');
    
    // Execute migration
    console.log('🚀 Starting image migration...');
    console.log('This may take a few minutes depending on the number of images...');
    console.log('');
    
    const migrationResponse = await fetch(`${API_BASE}/admin/migrate-images`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!migrationResponse.ok) {
      throw new Error(`Migration failed: ${migrationResponse.statusText}`);
    }

    const result = await migrationResponse.json();
    
    console.log('');
    console.log('🏁 Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Total creatives found: ${result.totalFound}`);
    console.log(`✅ Successfully migrated: ${result.migrated}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log('═══════════════════════════════════════');
    
    if (result.errors && result.errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors:');
      result.errors.forEach((error: string) => console.log(`  - ${error}`));
    }
    
    console.log('');
    
    // Get migration status after
    console.log('📊 Final status:');
    const statusAfter = await fetch(`${API_BASE}/admin/migration-status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusAfterData = await statusAfter.json();
    console.log('Status after migration:', statusAfterData);
    
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateImages();
