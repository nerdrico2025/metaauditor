
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get dashboard metrics
router.get('/metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let campaigns = await storage.getCampaignsByUser(userId);
    let creatives = await storage.getCreativesByUser(userId);
    let audits = await storage.getAuditsByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      campaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(creatives.map(c => c.id));
      audits = audits.filter(a => creativeIds.has(a.creativeId));
    }
    
    // Count compliant and non-compliant from audits
    // conforme = fully compliant
    // parcialmente_conforme or nao_conforme = non-compliant (has issues)
    const compliantAudits = audits.filter(a => a.status === 'conforme').length;
    const nonCompliantAudits = audits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    ).length;
    
    // Calculate average CTR from creatives
    const creativesWithCtr = creatives.filter(c => 
      c.impressions && c.impressions > 0 && c.clicks !== null && c.clicks !== undefined
    );
    let averageCtr = 0;
    if (creativesWithCtr.length > 0) {
      const totalCtr = creativesWithCtr.reduce((sum, c) => {
        const ctr = (c.clicks || 0) / (c.impressions || 1) * 100;
        return sum + ctr;
      }, 0);
      averageCtr = totalCtr / creativesWithCtr.length;
    }
    
    res.json({
      activeCampaigns: campaigns.filter(c => c.status === 'Ativo' || c.status === 'active' || c.status === 'Em veiculação').length,
      averageCtr,
      compliant: compliantAudits,
      nonCompliant: nonCompliantAudits,
    });
  } catch (error) {
    next(error);
  }
});

// Get recent audits
router.get('/recent-audits', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let audits = await storage.getRecentAudits(userId, 50); // Get more initially for filtering
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      
      const creatives = await storage.getCreativesByUser(userId);
      const filteredCreatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(filteredCreatives.map(c => c.id));
      
      audits = audits.filter(a => creativeIds.has(a.creativeId));
    }
    
    res.json(audits.slice(0, 10)); // Return only 10 after filtering
  } catch (error) {
    next(error);
  }
});

// Get problem creatives (creatives with non-compliant audits)
router.get('/problem-creatives', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let audits = await storage.getAuditsByUser(userId);
    let problemAudits = audits.filter(a => a.status === 'non_compliant' || a.status === 'nao_conforme');
    
    // Filter by integrationId if provided
    if (integrationId) {
      const campaigns = await storage.getCampaignsByUser(userId);
      const filteredCampaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(filteredCampaigns.map(c => c.id));
      
      const creatives = await storage.getCreativesByUser(userId);
      const filteredCreatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(filteredCreatives.map(c => c.id));
      
      problemAudits = problemAudits.filter(a => creativeIds.has(a.creativeId));
    }
    
    // Remove duplicates - keep only the most recent audit per creative
    const uniqueAuditsMap = new Map<string, typeof problemAudits[0]>();
    for (const audit of problemAudits) {
      const existing = uniqueAuditsMap.get(audit.creativeId);
      if (!existing || new Date(audit.createdAt) > new Date(existing.createdAt)) {
        uniqueAuditsMap.set(audit.creativeId, audit);
      }
    }
    const uniqueAudits = Array.from(uniqueAuditsMap.values());
    
    // Limit to 5 results
    const limitedAudits = uniqueAudits.slice(0, 5);
    
    // Get creative details for problem audits
    const problemCreatives = await Promise.all(
      limitedAudits.map(async (audit) => {
        const creative = await storage.getCreativeById(audit.creativeId);
        return creative ? { ...creative, audit } : null;
      })
    );
    
    res.json(problemCreatives.filter(Boolean));
  } catch (error) {
    next(error);
  }
});

// Get daily metrics - supports period filter (7, 14, 30, 60, 90 days or custom range)
router.get('/daily-metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    const period = parseInt(req.query.period as string) || 7;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    let campaigns = await storage.getCampaignsByUser(userId);
    let creatives = await storage.getCreativesByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      campaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
    }
    
    // Calculate number of days to show
    let numDays = period;
    let rangeStart: Date;
    let rangeEnd: Date;
    
    if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd = new Date(endDate);
      numDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      rangeEnd = new Date();
      rangeStart = new Date();
      rangeStart.setDate(rangeEnd.getDate() - numDays + 1);
    }
    
    // Calculate LIFETIME TOTALS from creatives
    const lifetimeSpend = creatives.reduce((sum, c) => sum + ((c.clicks || 0) * (Number(c.cpc) || 0)), 0);
    const lifetimeImpressions = creatives.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const lifetimeClicks = creatives.reduce((sum, c) => sum + (c.clicks || 0), 0);
    
    // IMPORTANT: Scale totals proportionally to the period
    // Assume lifetime data represents ~90 days of activity
    // Longer periods = more total data, shorter periods = less total data
    const LIFETIME_DAYS = 90;
    const periodRatio = Math.min(numDays / LIFETIME_DAYS, 1.0);
    
    const periodSpend = lifetimeSpend * periodRatio;
    const periodImpressions = Math.floor(lifetimeImpressions * periodRatio);
    const periodClicks = Math.floor(lifetimeClicks * periodRatio);
    
    // Generate daily metrics with deterministic variation
    const days = [];
    let totalWeight = 0;
    const dayWeights: number[] = [];
    
    // First pass: calculate weights for each day
    for (let i = 0; i < numDays; i++) {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayWeight = isWeekend ? 0.7 : 1.1;
      
      const dateHash = (date.getDate() * 7 + date.getMonth() * 31) % 100;
      const hashVariation = 0.9 + (dateHash / 500);
      
      const weight = dayWeight * hashVariation;
      dayWeights.push(weight);
      totalWeight += weight;
    }
    
    // Second pass: distribute period totals proportionally by weight
    for (let i = 0; i < numDays; i++) {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const proportion = dayWeights[i] / totalWeight;
      
      const daySpend = periodSpend * proportion;
      const dayImpressions = Math.floor(periodImpressions * proportion);
      const dayClicks = Math.floor(periodClicks * proportion);
      const dayCtr = dayImpressions > 0 ? (dayClicks / dayImpressions) * 100 : 0;
      
      days.push({
        date: dateStr,
        spend: Math.max(0, daySpend),
        impressions: dayImpressions,
        clicks: dayClicks,
        ctr: dayCtr,
      });
    }
    
    res.json(days);
  } catch (error) {
    next(error);
  }
});

// Get top campaigns by spend
router.get('/top-campaigns', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let campaigns = await storage.getCampaignsByUser(userId);
    let creatives = await storage.getCreativesByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      campaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
    }
    
    // Calculate metrics per campaign from creatives (spend = clicks * cpc)
    const campaignMetrics = campaigns.map(campaign => {
      const campaignCreatives = creatives.filter(c => c.campaignId === campaign.id);
      const spend = campaignCreatives.reduce((sum, c) => sum + ((c.clicks || 0) * (Number(c.cpc) || 0)), 0);
      const impressions = campaignCreatives.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const clicks = campaignCreatives.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status || 'Desconhecido',
        spend,
        impressions,
        clicks,
        ctr,
        platform: campaign.platform || 'meta',
      };
    });
    
    // Sort by spend descending and return top 5
    const topCampaigns = campaignMetrics
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
    
    res.json(topCampaigns);
  } catch (error) {
    next(error);
  }
});

// Get compliance statistics
router.get('/compliance-stats', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const integrationId = req.query.integrationId as string | undefined;
    
    let campaigns = await storage.getCampaignsByUser(userId);
    let creatives = await storage.getCreativesByUser(userId);
    let audits = await storage.getAuditsByUser(userId);
    
    // Filter by integrationId if provided
    if (integrationId) {
      campaigns = campaigns.filter(c => c.integrationId === integrationId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      creatives = creatives.filter(c => campaignIds.has(c.campaignId));
      const creativeIds = new Set(creatives.map(c => c.id));
      audits = audits.filter(a => creativeIds.has(a.creativeId));
    }
    
    // Get unique creatives with audits (latest audit per creative)
    const latestAuditPerCreative = new Map<string, any>();
    audits.forEach(audit => {
      const existing = latestAuditPerCreative.get(audit.creativeId);
      if (!existing || new Date(audit.createdAt) > new Date(existing.createdAt)) {
        latestAuditPerCreative.set(audit.creativeId, audit);
      }
    });
    
    const uniqueAudits = Array.from(latestAuditPerCreative.values());
    
    const compliant = uniqueAudits.filter(a => a.status === 'conforme' || a.status === 'compliant').length;
    const nonCompliant = uniqueAudits.filter(a => 
      a.status === 'non_compliant' || 
      a.status === 'nao_conforme' || 
      a.status === 'parcialmente_conforme'
    ).length;
    
    // Pending = creatives without audits
    const auditedCreativeIds = new Set(uniqueAudits.map(a => a.creativeId));
    const pending = creatives.filter(c => !auditedCreativeIds.has(c.id)).length;
    
    const total = compliant + nonCompliant + pending;
    const complianceRate = total > 0 ? (compliant / total) * 100 : 0;
    
    res.json({
      total,
      compliant,
      nonCompliant,
      pending,
      complianceRate,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
