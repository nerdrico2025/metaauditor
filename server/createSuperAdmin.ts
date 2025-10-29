
import { db } from './db';
import { users } from '@shared/schema';
import { hashPassword } from './auth';
import { eq } from 'drizzle-orm';

async function createSuperAdmin() {
  try {
    console.log('🔐 Creating Super Admin user...');

    const email = 'superadmin@clickauditor.com';
    const password = 'SuperAdmin2025!';

    // Check if super admin already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      console.log('⚠️ Super Admin already exists:', email);
      console.log('🔑 Password:', password);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create super admin (without company_id since super_admin doesn't belong to a company)
    const [superAdmin] = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      isActive: true,
      companyId: null, // Super admin doesn't belong to any company
    }).returning();

    console.log('✅ Super Admin created successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 User ID:', superAdmin.id);
    console.log('🎯 Role:', superAdmin.role);
    
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    throw error;
  }
}

createSuperAdmin()
  .then(() => {
    console.log('✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
