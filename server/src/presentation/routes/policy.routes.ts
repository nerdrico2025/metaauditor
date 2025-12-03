
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Setup multer for logo upload
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// Get all policies for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const policies = await storage.getPoliciesByUser(userId);
    res.json(policies);
  } catch (error) {
    next(error);
  }
});

// Get policy settings (same as getting all policies)
router.get('/settings', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const policies = await storage.getPoliciesByUser(userId);
    res.json(policies);
  } catch (error) {
    next(error);
  }
});

// Get policy by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await storage.getPolicyById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Create policy
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    let companyId = (req as any).user?.companyId;
    
    // If companyId is not in token, fetch from user record
    if (!companyId && userId) {
      const user = await storage.getUserById(userId);
      companyId = user?.companyId || null;
    }
    
    const policy = await storage.createPolicy({
      ...req.body,
      userId,
      companyId,
    });
    res.status(201).json(policy);
  } catch (error) {
    next(error);
  }
});

// Update policy
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await storage.updatePolicy(req.params.id, req.body);
    if (!policy) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Upload logo
router.post('/upload-logo', authenticateToken, uploadLogo.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }
    
    // Return the URL to access the uploaded logo
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    res.json({ url: logoUrl });
  } catch (error) {
    next(error);
  }
});

// Delete policy
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await storage.deletePolicy(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json({ message: 'Política excluída com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
