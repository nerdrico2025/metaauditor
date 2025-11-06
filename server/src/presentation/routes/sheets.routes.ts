import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { SheetsSyncService } from '../../infrastructure/services/SheetsSyncService.js';
import { db } from '../../infrastructure/database/connection.js';
import { googleSheetsConfig, integrations } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const sheetsSyncService = new SheetsSyncService();

// Sync data from Google Sheets
router.post('/sync-single-tab-now', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    // Get or create a default integration for Google Sheets
    let [integration] = await db.select().from(integrations).where(eq(integrations.platform, 'google_sheets')).limit(1);
    
    if (!integration) {
      const [newIntegration] = await db.insert(integrations).values({
        userId,
        platform: 'google_sheets',
        status: 'active',
        accountId: 'default',
      }).returning();
      integration = newIntegration;
    }
    
    const result = await sheetsSyncService.syncSingleTab(userId, integration.id);
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Get sync status
router.get('/sync/status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const syncStatus = await sheetsSyncService.getSyncStatus();
    return res.status(200).json({ data: { syncStatus } });
  } catch (error) {
    next(error);
  }
});

// Create Google Sheets configuration
router.post('/sheets/config', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    const { sheetId, tabGid, name } = req.body;
    
    if (!sheetId || !name) {
      return res.status(400).json({ error: 'Sheet ID and name are required' });
    }
    
    const [config] = await db.insert(googleSheetsConfig).values({
      userId,
      companyId: null,
      sheetId,
      tabGid: tabGid || '0',
      name,
      status: 'active',
    }).returning();
    
    return res.status(201).json(config);
  } catch (error) {
    next(error);
  }
});

// Get all Google Sheets configurations
router.get('/sheets/config', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    const configs = await db.select().from(googleSheetsConfig).where(eq(googleSheetsConfig.userId, userId));
    
    return res.status(200).json(configs);
  } catch (error) {
    next(error);
  }
});

// Update Google Sheets configuration
router.put('/sheets/config/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    next(error);
  }
});

// Delete Google Sheets configuration
router.delete('/sheets/config/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    await db.delete(googleSheetsConfig).where(eq(googleSheetsConfig.id, id));
    
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
