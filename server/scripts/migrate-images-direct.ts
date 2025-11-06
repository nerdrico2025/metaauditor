#!/usr/bin/env tsx

/**
 * Script to migrate existing creative images to local storage (direct database access)
 * Usage: tsx server/scripts/migrate-images-direct.ts
 */

import { db } from '../src/infrastructure/database/connection.js';
import { creatives } from '../src/shared/schema.js';
import { sql } from 'drizzle-orm';
import { imageStorageService } from '../src/infrastructure/services/ImageStorageService.js';

async function migrateImages() {
  try {
    console.log('🚀 Starting direct image migration...');
    console.log('');
    
    // Get all creatives with external image URLs (not already migrated)
    const creativesWithImages = await db
      .select()
      .from(creatives)
      .where(
        sql`${creatives.imageUrl} IS NOT NULL 
            AND ${creatives.imageUrl} NOT LIKE '/uploads/%'
            AND ${creatives.imageUrl} NOT LIKE '%placeholder%'`
      );
    
    console.log(`📊 Found ${creativesWithImages.length} creatives with external images`);
    console.log('');
    
    if (creativesWithImages.length === 0) {
      console.log('✅ No images to migrate!');
      return;
    }
    
    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process each creative
    for (const creative of creativesWithImages) {
      if (!creative.imageUrl) continue;
      
      try {
        console.log(`📥 [${migrated + failed + 1}/${creativesWithImages.length}] Migrating: ${creative.name}`);
        console.log(`   URL: ${creative.imageUrl.substring(0, 80)}...`);
        
        const permanentUrl = await imageStorageService.downloadAndSaveImage(creative.imageUrl);
        
        if (permanentUrl) {
          await db
            .update(creatives)
            .set({ imageUrl: permanentUrl })
            .where(sql`${creatives.id} = ${creative.id}`);
          
          migrated++;
          console.log(`   ✅ Saved to: ${permanentUrl}`);
        } else {
          failed++;
          errors.push(`Failed to download image for creative ${creative.id}: ${creative.name}`);
          console.log(`   ❌ Failed to download`);
        }
        console.log('');
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error migrating creative ${creative.id}: ${errorMsg}`);
        console.error(`   ❌ Error: ${errorMsg}`);
        console.log('');
      }
    }
    
    console.log('═══════════════════════════════════════');
    console.log('🏁 Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Total creatives found: ${creativesWithImages.length}`);
    console.log(`✅ Successfully migrated: ${migrated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('═══════════════════════════════════════');
    
    if (errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors:');
      errors.forEach((error) => console.log(`  - ${error}`));
    }
    
    console.log('');
    console.log('✨ Done! Your images are now stored locally and will never expire!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateImages();
