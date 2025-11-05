
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from './auth';

async function resetUserPassword() {
  try {
    const email = 'rafael@clickhero.com.br';
    const newPassword = 'X@drez13'; // Senha padrão de demonstração

    console.log('🔐 Resetting password for user:', email);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    const [updatedUser] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, email))
      .returning();

    if (!updatedUser) {
      console.error('❌ User not found:', email);
      process.exit(1);
    }

    console.log('✅ Password reset successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 New Password:', newPassword);
    console.log('👤 User ID:', updatedUser.id);
    console.log('🎯 Role:', updatedUser.role);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
}

resetUserPassword();
