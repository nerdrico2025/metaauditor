import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

router.get('/consolidated-metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    const campaigns = await storage.getCampaignsByUser(userId);
    const creatives = await storage.getCreativesByUser(userId);
    const audits = await storage.getAuditsByUser(userId);
    const adSets = await storage.getAdSetsByUser(userId);
    
    const activeCampaigns = campaigns.filter(c => c.status === 'Ativo' || c.status === 'active' || c.status === 'Em veiculação').length;
    const compliantAudits = audits.filter(a => a.status === 'conforme').length;
    const nonCompliantAudits = audits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    ).length;
    const pendingAudits = audits.filter(a => a.status === 'pendente' || !a.status).length;
    
    const avgComplianceScore = audits.length > 0 
      ? audits.reduce((sum, a) => sum + parseFloat(String(a.complianceScore || 0)), 0) / audits.length 
      : 0;
    
    res.json({
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns,
        inactive: campaigns.length - activeCampaigns,
      },
      adSets: {
        total: adSets.length,
      },
      creatives: {
        total: creatives.length,
        analyzed: audits.length,
        pending: creatives.length - audits.length,
      },
      audits: {
        total: audits.length,
        compliant: compliantAudits,
        nonCompliant: nonCompliantAudits,
        pending: pendingAudits,
        avgComplianceScore: avgComplianceScore.toFixed(2),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/rejection-reasons', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const audits = await storage.getAuditsByUser(userId);
    
    const nonCompliantAudits = audits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    );
    
    const reasonsMap: Record<string, { count: number; creativeIds: string[]; examples: string[] }> = {};
    
    // Category display names
    const categoryDisplayNames: Record<string, string> = {
      'logo': 'Logo/Marca',
      'cores': 'Cores da Marca',
      'texto': 'Texto/Tipografia',
      'palavras_proibidas': 'Palavras Proibidas',
      'palavras_obrigatorias': 'Palavras Obrigatórias',
      'copywriting': 'Copywriting',
      'outro': 'Outros'
    };

    for (const audit of nonCompliantAudits) {
      const issues = audit.issues as any[] || [];
      const aiAnalysis = audit.aiAnalysis as any || {};
      
      for (const issue of issues) {
        // Handle both string (legacy) and object formats
        let category: string;
        let description: string;
        
        if (typeof issue === 'string') {
          // Legacy string format - try to categorize
          description = issue;
          const lowerText = issue.toLowerCase();
          if (lowerText.includes('logo') || lowerText.includes('marca')) {
            category = 'Logo/Marca';
          } else if (lowerText.includes('cor') || lowerText.includes('paleta')) {
            category = 'Cores da Marca';
          } else if (lowerText.includes('proibid')) {
            category = 'Palavras Proibidas';
          } else if (lowerText.includes('obrigatór') || lowerText.includes('faltando') || lowerText.includes('ausente')) {
            category = 'Palavras Obrigatórias';
          } else if (lowerText.includes('copy') || lowerText.includes('texto') || lowerText.includes('título') || lowerText.includes('cta')) {
            category = 'Copywriting';
          } else {
            category = 'Outros';
          }
        } else {
          // New object format
          const rawCategory = issue.category || issue.type || 'outro';
          category = categoryDisplayNames[rawCategory] || rawCategory;
          description = issue.description || issue.message || '';
        }
        
        if (!reasonsMap[category]) {
          reasonsMap[category] = { count: 0, creativeIds: [], examples: [] };
        }
        reasonsMap[category].count++;
        reasonsMap[category].creativeIds.push(audit.creativeId);
        if (description && reasonsMap[category].examples.length < 3) {
          reasonsMap[category].examples.push(description);
        }
      }
      
      if (aiAnalysis.rejectionReasons) {
        for (const reason of aiAnalysis.rejectionReasons) {
          const category = reason.category || reason.type || 'AI Analysis';
          const description = reason.reason || reason.description || '';
          
          if (!reasonsMap[category]) {
            reasonsMap[category] = { count: 0, creativeIds: [], examples: [] };
          }
          reasonsMap[category].count++;
          reasonsMap[category].creativeIds.push(audit.creativeId);
          if (description && reasonsMap[category].examples.length < 3) {
            reasonsMap[category].examples.push(description);
          }
        }
      }
      
      if (aiAnalysis.issues) {
        for (const issue of aiAnalysis.issues) {
          const category = issue.category || issue.type || 'AI Issue';
          const description = issue.description || issue.message || '';
          
          if (!reasonsMap[category]) {
            reasonsMap[category] = { count: 0, creativeIds: [], examples: [] };
          }
          reasonsMap[category].count++;
          reasonsMap[category].creativeIds.push(audit.creativeId);
          if (description && reasonsMap[category].examples.length < 3) {
            reasonsMap[category].examples.push(description);
          }
        }
      }
    }
    
    const reasons = Object.entries(reasonsMap)
      .map(([category, data]) => ({
        category,
        count: data.count,
        uniqueCreatives: [...new Set(data.creativeIds)].length,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      totalNonCompliant: nonCompliantAudits.length,
      reasons,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/by-keyword', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const keyword = (req.query.keyword as string || '').toLowerCase().trim();
    
    if (!keyword) {
      return res.json({ creatives: [], keyword: '' });
    }
    
    const audits = await storage.getAuditsByUser(userId);
    const nonCompliantAudits = audits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    );
    
    const matchedCreativeIds: Set<string> = new Set();
    const matchedAudits: any[] = [];
    
    for (const audit of nonCompliantAudits) {
      const issues = audit.issues as any[] || [];
      const aiAnalysis = audit.aiAnalysis as any || {};
      
      let matched = false;
      const matchedIssues: string[] = [];
      
      for (const issue of issues) {
        const description = (issue.description || issue.message || '').toLowerCase();
        if (description.includes(keyword)) {
          matched = true;
          matchedIssues.push(issue.description || issue.message);
        }
      }
      
      if (aiAnalysis.rejectionReasons) {
        for (const reason of aiAnalysis.rejectionReasons) {
          const description = (reason.reason || reason.description || '').toLowerCase();
          if (description.includes(keyword)) {
            matched = true;
            matchedIssues.push(reason.reason || reason.description);
          }
        }
      }
      
      if (aiAnalysis.issues) {
        for (const issue of aiAnalysis.issues) {
          const description = (issue.description || issue.message || '').toLowerCase();
          if (description.includes(keyword)) {
            matched = true;
            matchedIssues.push(issue.description || issue.message);
          }
        }
      }
      
      const prohibitedTerms = aiAnalysis.prohibitedTermsFound || [];
      if (prohibitedTerms.some((t: string) => t.toLowerCase().includes(keyword))) {
        matched = true;
        matchedIssues.push(`Termo proibido encontrado: ${prohibitedTerms.filter((t: string) => t.toLowerCase().includes(keyword)).join(', ')}`);
      }
      
      if (matched) {
        matchedCreativeIds.add(audit.creativeId);
        matchedAudits.push({
          auditId: audit.id,
          creativeId: audit.creativeId,
          status: audit.status,
          complianceScore: audit.complianceScore,
          matchedIssues: [...new Set(matchedIssues)],
        });
      }
    }
    
    const creatives = await Promise.all(
      [...matchedCreativeIds].map(async (creativeId) => {
        const creative = await storage.getCreativeById(creativeId);
        const audit = matchedAudits.find(a => a.creativeId === creativeId);
        return creative ? { ...creative, audit } : null;
      })
    );
    
    res.json({
      keyword,
      totalMatches: matchedCreativeIds.size,
      creatives: creatives.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const format = req.query.format as string || 'json';
    
    const campaigns = await storage.getCampaignsByUser(userId);
    const creatives = await storage.getCreativesByUser(userId);
    const audits = await storage.getAuditsByUser(userId);
    
    const exportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCampaigns: campaigns.length,
        totalCreatives: creatives.length,
        totalAudits: audits.length,
        compliant: audits.filter(a => a.status === 'conforme').length,
        nonCompliant: audits.filter(a => a.status === 'non_compliant' || a.status === 'nao_conforme' || a.status === 'parcialmente_conforme').length,
      },
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        platform: c.platform,
        objective: c.objective,
        budget: c.budget,
      })),
      audits: await Promise.all(audits.map(async (audit) => {
        const creative = await storage.getCreativeById(audit.creativeId);
        return {
          id: audit.id,
          status: audit.status,
          complianceScore: audit.complianceScore,
          performanceScore: audit.performanceScore,
          createdAt: audit.createdAt,
          creative: creative ? {
            id: creative.id,
            name: creative.name,
            type: creative.type,
            platform: creative.platform,
          } : null,
          issues: audit.issues,
        };
      })),
    };
    
    if (format === 'csv') {
      const csvRows = [
        ['Creative ID', 'Creative Name', 'Status', 'Compliance Score', 'Issues', 'Date'].join(','),
      ];
      
      for (const audit of exportData.audits) {
        const issues = (audit.issues as any[] || []).map(i => i.description || i.message || '').join('; ');
        csvRows.push([
          audit.creative?.id || '',
          `"${audit.creative?.name || ''}"`,
          audit.status,
          audit.complianceScore,
          `"${issues}"`,
          audit.createdAt,
        ].join(','));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=click-auditor-report.csv');
      return res.send(csvRows.join('\n'));
    }
    
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

export default router;
