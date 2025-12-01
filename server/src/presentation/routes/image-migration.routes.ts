import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { db } from '../../infrastructure/database/connection.js';
import { creatives } from '../../shared/schema.js';
import { isNull, not, sql } from 'drizzle-orm';
import { imageStorageService } from '../../infrastructure/services/ImageStorageService.js';

const router = Router();

/**
 * Migrate existing creative images to local storage
 */
router.post('/migrate-images', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🚀 Starting image migration...');
    
    // Get all creatives with external image URLs (not already migrated)
    const creativesWithImages = await db
      .select()
      .from(creatives)
      .where(
        sql`${creatives.imageUrl} IS NOT NULL 
            AND ${creatives.imageUrl} NOT LIKE '/objects/%'
            AND ${creatives.imageUrl} NOT LIKE '/uploads/%'
            AND ${creatives.imageUrl} NOT LIKE '%placeholder%'`
      );
    
    console.log(`📊 Found ${creativesWithImages.length} creatives with external images`);
    
    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process in batches to avoid overwhelming the system
    for (const creative of creativesWithImages) {
      if (!creative.imageUrl) continue;
      
      try {
        console.log(`📥 Migrating image for creative ${creative.id}: ${creative.name}`);
        
        // Use adSetId if available, otherwise use campaignId as fallback
        const storageAdSetId = creative.adSetId || creative.campaignId || 'unknown';
        const storageCompanyId = creative.companyId || 'unknown';
        
        const permanentUrl = await imageStorageService.downloadAndSaveImage(
          creative.imageUrl,
          storageCompanyId,
          storageAdSetId
        );
        
        if (permanentUrl) {
          await db
            .update(creatives)
            .set({ imageUrl: permanentUrl })
            .where(sql`${creatives.id} = ${creative.id}`);
          
          migrated++;
          console.log(`✅ Migrated: ${creative.name} -> ${permanentUrl}`);
        } else {
          failed++;
          errors.push(`Failed to download image for creative ${creative.id}: ${creative.name}`);
          console.log(`❌ Failed to download image for creative ${creative.id}`);
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error migrating creative ${creative.id}: ${errorMsg}`);
        console.error(`❌ Error migrating creative ${creative.id}:`, error);
      }
    }
    
    console.log(`🏁 Migration complete: ${migrated} migrated, ${failed} failed`);
    
    res.json({
      success: true,
      totalFound: creativesWithImages.length,
      migrated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Image migration failed:', error);
    next(error);
  }
});

/**
 * Get migration status
 */
router.get('/migration-status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN image_url LIKE '/objects/%' OR image_url LIKE '/uploads/%' THEN 1 END) as migrated,
        COUNT(CASE WHEN image_url NOT LIKE '/objects/%' AND image_url NOT LIKE '/uploads/%' AND image_url NOT LIKE '%placeholder%' AND image_url IS NOT NULL THEN 1 END) as pending,
        COUNT(CASE WHEN image_url IS NULL OR image_url LIKE '%placeholder%' THEN 1 END) as no_image
      FROM ${creatives}
    `);
    
    res.json(result.rows[0] || {});
  } catch (error) {
    next(error);
  }
});

export default router;
