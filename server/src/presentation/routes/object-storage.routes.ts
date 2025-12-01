import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { objectStorageService, ObjectNotFoundError } from '../../infrastructure/services/ObjectStorageService';
import { ObjectPermission } from '../../infrastructure/services/ObjectAcl';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

router.get('/objects/*', async (req: Request, res: Response) => {
  try {
    const objectPath = req.path;
    const objectFile = await objectStorageService.getObjectFile(objectPath);
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Error serving object:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/objects/upload/creative', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;
    const { adSetId, extension = 'jpg' } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!adSetId) {
      return res.status(400).json({ error: 'AdSet ID is required' });
    }

    const { uploadURL, objectPath } = await objectStorageService.getCreativeUploadURL(
      companyId,
      adSetId,
      extension
    );

    res.json({ 
      uploadURL, 
      objectPath,
      method: 'PUT'
    });
  } catch (error) {
    console.error('Error getting creative upload URL:', error);
    next(error);
  }
});

router.post('/api/objects/upload/logo', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;
    const { extension = 'png' } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const { uploadURL, objectPath } = await objectStorageService.getLogoUploadURL(
      companyId,
      extension
    );

    res.json({ 
      uploadURL, 
      objectPath,
      method: 'PUT'
    });
  } catch (error) {
    console.error('Error getting logo upload URL:', error);
    next(error);
  }
});

router.post('/api/objects/upload', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;
    const { type, subPath, extension = 'jpg' } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!type || !['creatives', 'logos', 'documents'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be creatives, logos, or documents' });
    }

    const { uploadURL, objectPath } = await objectStorageService.getUploadURL(
      { companyId, type, subPath },
      extension
    );

    res.json({ 
      uploadURL, 
      objectPath,
      method: 'PUT'
    });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    next(error);
  }
});

router.put('/api/objects/acl', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;
    const { objectPath, visibility = 'private' } = req.body;
    
    if (!objectPath) {
      return res.status(400).json({ error: 'Object path is required' });
    }

    const normalizedPath = objectStorageService.normalizeObjectPath(objectPath);
    
    await objectStorageService.setObjectAcl(normalizedPath, {
      owner: userId,
      companyId,
      visibility,
    });

    res.json({ 
      success: true,
      objectPath: normalizedPath 
    });
  } catch (error) {
    console.error('Error setting object ACL:', error);
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: 'Object not found' });
    }
    next(error);
  }
});

router.delete('/api/objects', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { objectPath } = req.body;
    
    if (!objectPath) {
      return res.status(400).json({ error: 'Object path is required' });
    }

    await objectStorageService.deleteObject(objectPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting object:', error);
    next(error);
  }
});

export default router;
