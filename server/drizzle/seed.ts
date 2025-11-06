
import { db } from '../server/src/infrastructure/database/connection';
import * as schema from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Starting database seed...');
  
  try {
    // Criar empresa padrão
    const [company] = await db.insert(schema.companies).values({
      name: 'Empresa Demo',
      slug: 'demo',
      status: 'active',
      subscriptionPlan: 'professional',
    }).returning();

    console.log('✅ Empresa criada:', company.name);

    // Criar super admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [superAdmin] = await db.insert(schema.users).values({
      email: 'admin@demo.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'super_admin',
      companyId: company.id,
    }).returning();

    console.log('✅ Super Admin criado:', superAdmin.email);

    console.log('🎉 Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

seed()
  .catch(console.error)
  .finally(() => process.exit(0));
