import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../repositories/IUserRepository.js';
import { UnauthorizedException } from '../../../shared/errors/AppException.js';
import { Email } from '../../../domain/value-objects/Email.js';

export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    companyId: string | null;
  };
  token: string;
}

export class LoginUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(data: LoginDTO): Promise<LoginResponse> {
    const email = new Email(data.email);

    const user = await this.userRepository.findByEmail(email.toString());
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    await this.userRepository.updateLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.companyId },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      },
      token,
    };
  }
}