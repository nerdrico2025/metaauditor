import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { objectStorageService, ObjectNotFoundError } from '../../infrastructure/services/ObjectStorageService.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/objects/*', async (req: Request, res: Response) => {
  try {
    const objectPath = req.path;
    await objectStorageService.downloadObject(objectPath, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Error serving object:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/objects/upload/creative', authenticateToken, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req as any).user?.companyId;
    const { adSetId } = req.body;
    const file = req.file;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!adSetId) {
      return res.status(400).json({ error: 'AdSet ID is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const extension = file.originalname.split('.').pop() || 'jpg';
    const result = await objectStorageService.uploadCreative(companyId, adSetId, file.buffer, extension);

    res.json({ 
      objectPath: result.objectPath,
      success: true
    });
  } catch (error) {
    console.error('Error uploading creative:', error);
    next(error);
  }
});

router.post('/api/objects/upload/logo', authenticateToken, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req as any).user?.companyId;
    const file = req.file;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const extension = file.originalname.split('.').pop() || 'png';
    const result = await objectStorageService.uploadLogo(companyId, file.buffer, extension);

    res.json({ 
      objectPath: result.objectPath,
      success: true
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    next(error);
  }
});

router.post('/api/objects/upload', authenticateToken, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req as any).user?.companyId;
    const { type, subPath } = req.body;
    const file = req.file;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!type || !['creatives', 'logos', 'documents'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be creatives, logos, or documents' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const extension = file.originalname.split('.').pop() || 'jpg';
    const objectPath = objectStorageService.generateObjectPath({ companyId, type, subPath }, extension);
    const result = await objectStorageService.uploadFromBuffer(objectPath, file.buffer);

    res.json({ 
      objectPath: result.objectPath,
      success: true
    });
  } catch (error) {
    console.error('Error uploading file:', error);
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
