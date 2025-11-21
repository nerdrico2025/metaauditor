import { Router, Response } from 'express';
import { PlanRepository } from '../../infrastructure/database/repositories/PlanRepository.js';

const router = Router();
const planRepository = new PlanRepository();

router.get('/', async (_req, res: Response) => {
  try {
    const plans = await planRepository.getActivePlans();
    
    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: plan.price.toString(),
      billingCycle: plan.billingCycle,
      displayOrder: plan.displayOrder,
      isPopular: plan.isPopular,
      investmentRange: plan.investmentRange,
      maxUsers: plan.maxUsers,
      maxCampaigns: plan.maxCampaigns,
      maxAuditsPerMonth: plan.maxAuditsPerMonth,
      maxIntegrations: plan.maxIntegrations,
      features: plan.features as string[],
    }));

    res.json(formattedPlans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

export default router;
