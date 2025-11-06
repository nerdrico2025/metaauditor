
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { AIAnalysisService } from '../../infrastructure/services/AIAnalysisService.js';
import { nanoid } from 'nanoid';

const router = Router();
const aiAnalysisService = new AIAnalysisService();

// Get all creatives for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creatives = await storage.getCreativesByUser(userId);
    res.json(creatives);
  } catch (error) {
    next(error);
  }
});

// Get creatives by campaign
router.get('/campaign/:campaignId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatives = await storage.getCreativesByCampaign(req.params.campaignId);
    res.json(creatives);
  } catch (error) {
    next(error);
  }
});

// Get creative by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creative = await storage.getCreativeById(req.params.id);
    if (!creative) {
      return res.status(404).json({ message: 'Criativo não encontrado' });
    }
    res.json(creative);
  } catch (error) {
    next(error);
  }
});

// Create creative
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creative = await storage.createCreative({
      ...req.body,
      userId,
    });
    res.status(201).json(creative);
  } catch (error) {
    next(error);
  }
});

// Update creative
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creative = await storage.updateCreative(req.params.id, req.body);
    if (!creative) {
      return res.status(404).json({ message: 'Criativo não encontrado' });
    }
    res.json(creative);
  } catch (error) {
    next(error);
  }
});

// Analyze creative with AI
router.post('/:id/analyze', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const creative = await storage.getCreativeById(req.params.id);
    
    if (!creative) {
      return res.status(404).json({ message: 'Criativo não encontrado' });
    }

    // Validate that creative has a real image (not placeholder)
    if (!creative.imageUrl || creative.imageUrl.includes('placeholder.com')) {
      return res.status(400).json({ 
        message: 'Criativo sem imagem real',
        details: 'Para analisar um criativo, ele precisa ter uma imagem válida. Importe criativos do Meta Ads ou Google Ads, ou adicione uma imagem manualmente.'
      });
    }

    // Get brand configuration and content criteria for the user
    const brandConfigs = await storage.getBrandConfigurationsByUser(userId);
    const brandConfig = brandConfigs.length > 0 ? brandConfigs[0] : null;
    
    const contentCriteriaList = await storage.getContentCriteriaByUser(userId);
    const contentCriteria = contentCriteriaList.length > 0 ? contentCriteriaList[0] : null;
    
    const performanceBenchmarks = await storage.getPerformanceBenchmarksByUser(userId);

    // Perform AI analysis
    const complianceAnalysis = await aiAnalysisService.analyzeCreativeCompliance(
      creative,
      brandConfig,
      contentCriteria
    );
    
    const performanceAnalysis = await aiAnalysisService.analyzeCreativePerformance(
      creative,
      performanceBenchmarks
    );

    // Calculate overall compliance status
    const complianceStatus = complianceAnalysis.score >= 80 ? 'conforme' : 
                            complianceAnalysis.score >= 60 ? 'parcialmente_conforme' : 
                            'nao_conforme';

    // Create audit record
    const audit = await storage.createAudit({
      creativeId: creative.id,
      userId,
      status: complianceStatus,
      complianceScore: complianceAnalysis.score,
      performanceScore: performanceAnalysis.score,
      issues: complianceAnalysis.issues,
      recommendations: [...complianceAnalysis.recommendations, ...performanceAnalysis.recommendations],
      aiAnalysis: {
        compliance: complianceAnalysis,
        performance: performanceAnalysis,
      },
    });

    res.json(audit);
  } catch (error) {
    console.error('Error analyzing creative:', error);
    next(error);
  }
});

// Get audits for a creative
router.get('/:id/audits', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audits = await storage.getAuditsByCreative(req.params.id);
    res.json(audits);
  } catch (error) {
    next(error);
  }
});

export default router;
