
import type { Response } from 'express';
import type { AuthRequest } from '../../auth';
import { asyncHandler } from '../../core/errors/errorHandler';
import { UserService } from './user.service';
import type { CreateUserData, UpdateUserData, UpdateProfileData, ChangePasswordData } from '@shared/schema';

export class UserController {
  constructor(private userService: UserService) {}

  getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const users = await this.userService.getAllUsers();
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));

    res.json({
      status: 'success',
      data: safeUsers
    });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: CreateUserData = req.body;
    const user = await this.userService.createUser(data);

    res.status(201).json({
      status: 'success',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }
    });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: UpdateUserData = req.body;
    const updatedUser = await this.userService.updateUser(req.params.id, data);

    res.json({
      status: 'success',
      data: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        role: updatedUser!.role,
        isActive: updatedUser!.isActive,
        createdAt: updatedUser!.createdAt,
        updatedAt: updatedUser!.updatedAt,
      }
    });
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    await this.userService.deleteUser(req.params.id, req.user!.id);

    res.json({
      status: 'success',
      message: 'Usuário removido com sucesso'
    });
  });

  getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({
      status: 'success',
      data: {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
        profileImageUrl: req.user!.profileImageUrl,
        lastLoginAt: req.user!.lastLoginAt,
        createdAt: req.user!.createdAt,
      }
    });
  });

  updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: UpdateProfileData = req.body;
    const updatedUser = await this.userService.updateProfile(req.user!.id, data);

    res.json({
      status: 'success',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        profileImageUrl: updatedUser.profileImageUrl,
        updatedAt: updatedUser.updatedAt,
      }
    });
  });

  changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: ChangePasswordData = req.body;
    await this.userService.changePassword(req.user!.id, data);

    res.json({
      status: 'success',
      message: 'Senha alterada com sucesso'
    });
  });
}
