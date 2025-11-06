import bcrypt from 'bcryptjs';
import { db } from '@infrastructure/database/connection';
import { users } from '@drizzle/schema';

export async function checkIfDatabaseEmpty(): Promise<boolean> {
  try {
    const result = await db.query.users.count();
    return result === 0;
  } catch (error) {
    console.error('Error checking if database is empty:', error);
    throw error;
  }
}

export async function seedDatabase(): Promise<void> {
  console.log('Seeding database...');

  const password = await bcrypt.hash('admin123', 10);

  try {
    await db.insert(users).values([
      {
        email: 'admin@clickhero.com',
        password: password,
        name: 'Admin User',
        role: 'super_admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    console.log('✅ Database seeded successfully!');
    console.log('📧 Email: admin@clickhero.com');
    console.log('🔑 Password: admin123');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}