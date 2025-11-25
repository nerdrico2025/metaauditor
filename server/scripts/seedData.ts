import bcrypt from 'bcryptjs';
import { db } from '../src/infrastructure/database/connection.js';
import { users } from '../drizzle/schema.js';

export async function checkIfDatabaseEmpty(): Promise<boolean> {
  try {
    const result = await db.select().from(users);
    return result.length === 0;
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
        firstName: 'Admin',
        lastName: 'User',
        role: 'super_admin',
        isActive: true,
      },
    ]).onConflictDoNothing();

    console.log('✅ Database seeded (or already exists)');
  } catch (error) {
    console.warn('⚠️ Seed skipped (data may already exist):', (error as Error).message);
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}