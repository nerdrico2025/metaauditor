import { Router, Request, Response } from 'express';
import { SheetsSyncService } from '../../infrastructure/services/SheetsSyncService.js';
import { db } from '../../infrastructure/database/connection.js';
import { googleSheetsConfig, integrations } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const sheetsSyncService = new SheetsSyncService();

// Sync data from Google Sheets
router.post('/sync-single-tab-now', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get or create a default integration for Google Sheets
    let [integration] = await db.select().from(integrations).where(eq(integrations.platform, 'google_sheets')).limit(1);
    
    if (!integration) {
      const [newIntegration] = await db.insert(integrations).values({
        userId: user.id,
        platform: 'google_sheets',
        status: 'active',
        accountId: 'default',
      }).returning();
      integration = newIntegration;
    }
    
    const result = await sheetsSyncService.syncSingleTab(user.id, integration.id);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error syncing Google Sheets:', error);
    return res.status(500).json({ error: 'Failed to sync Google Sheets data' });
  }
});

// Get sync status
router.get('/sync/status', async (req: Request, res: Response) => {
  try {
    const syncStatus = await sheetsSyncService.getSyncStatus();
    return res.status(200).json({ data: { syncStatus } });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Create Google Sheets configuration
router.post('/sheets/config', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { sheetId, tabGid, name } = req.body;
    
    if (!sheetId || !name) {
      return res.status(400).json({ error: 'Sheet ID and name are required' });
    }
    
    const [config] = await db.insert(googleSheetsConfig).values({
      userId: user.id,
      companyId: user.companyId || null,
      sheetId,
      tabGid: tabGid || '0',
      name,
      status: 'active',
    }).returning();
    
    return res.status(201).json(config);
  } catch (error) {
    console.error('Error creating Google Sheets config:', error);
    return res.status(500).json({ error: 'Failed to create configuration' });
  }
});

// Get all Google Sheets configurations
router.get('/sheets/config', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const configs = await db.select().from(googleSheetsConfig).where(eq(googleSheetsConfig.userId, user.id));
    
    return res.status(200).json(configs);
  } catch (error) {
    console.error('Error getting Google Sheets configs:', error);
    return res.status(500).json({ error: 'Failed to get configurations' });
  }
});

// Update Google Sheets configuration
router.put('/sheets/config/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    const { sheetId, tabGid, name, status } = req.body;
    
    const [config] = await db.update(googleSheetsConfig)
      .set({
        sheetId,
        tabGid,
        name,
        status,
        updatedAt: new Date(),
      })
      .where(eq(googleSheetsConfig.id, id))
      .returning();
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    return res.status(200).json(config);
  } catch (error) {
    console.error('Error updating Google Sheets config:', error);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Delete Google Sheets configuration
router.delete('/sheets/config/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    
    await db.delete(googleSheetsConfig).where(eq(googleSheetsConfig.id, id));
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting Google Sheets config:', error);
    return res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

export default router;
