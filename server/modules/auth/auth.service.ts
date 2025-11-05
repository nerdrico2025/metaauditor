
import { generateToken, hashPassword, comparePassword } from '../../auth';
import { UnauthorizedError } from '../../core/errors/AppError';
import type { IUserRepository } from '../users/user.repository.interface';
import type { LoginData, RegisterData } from '@shared/schema';

export class AuthService {
  constructor(private userRepository: IUserRepository) {}

  async register(data: RegisterData) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    
    if (existingUser) {
      throw new UnauthorizedError('Usuário já existe com este email');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'operador',
      companyId: data.companyId,
    });

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    };
  }

  async login(data: LoginData) {
    const user = await this.userRepository.findByEmail(data.email);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const isPasswordValid = await comparePassword(data.password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    await this.userRepository.updateLastLogin(user.id);

    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    };
  }
}
