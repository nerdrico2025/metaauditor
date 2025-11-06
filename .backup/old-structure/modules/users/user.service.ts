
import { hashPassword } from '../../auth';
import { NotFoundError, ValidationError } from '../../core/errors/AppError';
import type { IUserRepository } from './user.repository.interface';
import type { CreateUserData, UpdateUserData, UpdateProfileData, ChangePasswordData } from '@shared/schema';
import { comparePassword } from '../../auth';

export class UserService {
  constructor(private userRepository: IUserRepository) {}

  async getAllUsers() {
    return await this.userRepository.findAll();
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }
    return user;
  }

  async createUser(data: CreateUserData) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ValidationError('Usuário com este email já existe');
    }

    const hashedPassword = await hashPassword(data.password);

    return await this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    });
  }

  async updateUser(id: string, data: UpdateUserData) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    if (user.role === 'administrador' && data.role && data.role !== 'administrador') {
      throw new ValidationError('Não é possível alterar o nível de administrador');
    }

    return await this.userRepository.update(id, data);
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ValidationError('Você não pode deletar sua própria conta');
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    if (user.role === 'administrador') {
      throw new ValidationError('Não é possível deletar usuários administradores');
    }

    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Usuário não encontrado');
    }
  }

  async updateProfile(id: string, data: UpdateProfileData) {
    const updated = await this.userRepository.update(id, data);
    if (!updated) {
      throw new NotFoundError('Usuário não encontrado');
    }
    return updated;
  }

  async changePassword(id: string, data: ChangePasswordData) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    const isCurrentPasswordValid = await comparePassword(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new ValidationError('Senha atual incorreta');
    }

    const hashedNewPassword = await hashPassword(data.newPassword);
    await this.userRepository.update(id, { password: hashedNewPassword });
  }
}
