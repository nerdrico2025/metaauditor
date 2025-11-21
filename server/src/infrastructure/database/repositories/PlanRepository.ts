import { db } from '../../db.js';
import { subscriptionPlans } from '../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';

export class PlanRepository {
  async getActivePlans() {
    return db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
      orderBy: (plans) => plans.displayOrder,
    });
  }

  async getPlanBySlug(slug: string) {
    return db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, slug),
    });
  }

  async getAllPlans() {
    return db.query.subscriptionPlans.findMany({
      orderBy: (plans) => plans.displayOrder,
    });
  }
}
