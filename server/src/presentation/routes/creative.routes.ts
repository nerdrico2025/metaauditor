
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { AIAnalysisService } from '../../infrastructure/services/AIAnalysisService.js';
import { nanoid } from 'nanoid';

const router = Router();
const aiAnalysisService = new AIAnalysisService();

// Get all creatives for user with pagination and filters
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const campaignId = req.query.campaignId as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const integrationId = req.query.integrationId as string | undefined;
    
    let creatives = await storage.getCreativesByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
    }
    
    // Apply filters
    if (campaignId) {
      creatives = creatives.filter(c => c.campaignId === campaignId);
    }
    if (status && status !== 'all') {
      creatives = creatives.filter(c => c.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      creatives = creatives.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.headline?.toLowerCase().includes(searchLower) ||
        c.text?.toLowerCase().includes(searchLower)
      );
    }
    
    // Calculate pagination
    const total = creatives.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedCreatives = creatives.slice(offset, offset + limit);
    
    res.json({
      creatives: paginatedCreatives,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
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
    let companyId = (req as any).user?.companyId;
    
    // If companyId is not in token, fetch from user record
    if (!companyId && userId) {
      const user = await storage.getUserById(userId);
      companyId = user?.companyId || null;
    }
    
    const creative = await storage.createCreative({
      ...req.body,
      userId,
      companyId,
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
    const userCompanyId = (req as any).user?.companyId;
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

    // Get applicable policy for this creative
    const policies = await storage.getPoliciesByUser(userId);
    
    // Find policy: first try campaign-specific, then use default or first global
    let applicablePolicy = policies.find(p => 
      p.scope === 'campaign' && 
      p.campaignIds && 
      Array.isArray(p.campaignIds) &&
      p.campaignIds.includes(creative.campaignId)
    );
    
    if (!applicablePolicy) {
      applicablePolicy = policies.find(p => p.isDefault && p.scope === 'global');
    }
    
    if (!applicablePolicy) {
      applicablePolicy = policies.find(p => p.scope === 'global');
    }

    if (!applicablePolicy && policies.length > 0) {
      applicablePolicy = policies[0];
    }

    // Perform AI analysis using the selected policy
    const complianceAnalysis = await aiAnalysisService.analyzeCreativeCompliance(
      creative,
      applicablePolicy
    );
    
    const performanceAnalysis = await aiAnalysisService.analyzeCreativePerformance(
      creative,
      applicablePolicy
    );

    // Calculate overall compliance status
    const complianceStatus = complianceAnalysis.score >= 80 ? 'conforme' : 
                            complianceAnalysis.score >= 60 ? 'parcialmente_conforme' : 
                            'nao_conforme';

    // Create audit record with policy reference and company_id
    const audit = await storage.createAudit({
      creativeId: creative.id,
      companyId: creative.companyId || userCompanyId,
      policyId: applicablePolicy?.id,
      status: complianceStatus,
      complianceScore: complianceAnalysis.score,
      performanceScore: performanceAnalysis.score,
      issues: complianceAnalysis.issues,
      recommendations: [...complianceAnalysis.recommendations, ...performanceAnalysis.recommendations],
      aiAnalysis: {
        compliance: complianceAnalysis,
        performance: performanceAnalysis,
        policyUsed: applicablePolicy?.name || 'No policy',
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

// Analyze multiple creatives with AI (batch)
router.post('/analyze-batch', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const userCompanyId = (req as any).user?.companyId;
    const { creativeIds } = req.body;
    
    if (!creativeIds || !Array.isArray(creativeIds) || creativeIds.length === 0) {
      return res.status(400).json({ message: 'Lista de creative IDs é obrigatória' });
    }

    // Get all policies for user (will be selected per creative)
    const policies = await storage.getPoliciesByUser(userId);

    const results: {
      success: Array<{ id: string; auditId: string }>;
      failed: Array<{ id: string; error: string }>;
      total: number;
    } = {
      success: [],
      failed: [],
      total: creativeIds.length
    };

    // Process each creative
    for (const creativeId of creativeIds) {
      try {
        const creative = await storage.getCreativeById(creativeId);
        
        // Multi-tenant access check
        const hasAccess = creative && (
          userRole === 'super_admin' ||
          (userCompanyId && creative.companyId === userCompanyId)
        );
        
        if (!creative || !hasAccess) {
          results.failed.push({ id: creativeId, error: 'Criativo não encontrado' });
          continue;
        }

        // Skip creatives without valid images
        if (!creative.imageUrl || creative.imageUrl.includes('placeholder.com')) {
          results.failed.push({ id: creativeId, error: 'Criativo sem imagem válida' });
          continue;
        }

        // Find applicable policy for this creative
        let applicablePolicy = policies.find(p => 
          p.scope === 'campaign' && 
          p.campaignIds && 
          Array.isArray(p.campaignIds) &&
          p.campaignIds.includes(creative.campaignId)
        );
        
        if (!applicablePolicy) {
          applicablePolicy = policies.find(p => p.isDefault && p.scope === 'global');
        }
        
        if (!applicablePolicy) {
          applicablePolicy = policies.find(p => p.scope === 'global');
        }

        if (!applicablePolicy && policies.length > 0) {
          applicablePolicy = policies[0];
        }

        // Perform AI analysis using the selected policy
        const complianceAnalysis = await aiAnalysisService.analyzeCreativeCompliance(
          creative,
          applicablePolicy
        );
        
        const performanceAnalysis = await aiAnalysisService.analyzeCreativePerformance(
          creative,
          applicablePolicy
        );

        // Calculate overall compliance status
        const complianceStatus = complianceAnalysis.score >= 80 ? 'conforme' : 
                                complianceAnalysis.score >= 60 ? 'parcialmente_conforme' : 
                                'nao_conforme';

        // Create audit record with policy reference and company_id
        const audit = await storage.createAudit({
          creativeId: creative.id,
          companyId: creative.companyId || userCompanyId,
          policyId: applicablePolicy?.id,
          status: complianceStatus,
          complianceScore: complianceAnalysis.score,
          performanceScore: performanceAnalysis.score,
          issues: complianceAnalysis.issues,
          recommendations: [...complianceAnalysis.recommendations, ...performanceAnalysis.recommendations],
          aiAnalysis: {
            compliance: complianceAnalysis,
            performance: performanceAnalysis,
            policyUsed: applicablePolicy?.name || 'No policy',
          },
        });

        results.success.push({ id: creativeId, auditId: audit.id });
      } catch (error) {
        console.error(`Error analyzing creative ${creativeId}:`, error);
        results.failed.push({ 
          id: creativeId, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error in batch analysis:', error);
    next(error);
  }
});

// Delete all creatives for user
router.delete('/bulk/all', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    await storage.deleteAllCreativesByUser(userId);
    
    // Reset lastSync for all user integrations to force FULL sync next time
    const integrations = await storage.getIntegrationsByUser(userId);
    for (const integration of integrations) {
      await storage.updateIntegration(integration.id, { lastSync: null });
    }
    
    res.json({ message: 'Todos os anúncios foram excluídos com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
