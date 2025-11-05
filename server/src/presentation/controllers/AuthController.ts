
import { Request, Response, NextFunction } from 'express';
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase';
import { UserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { loginSchema } from '../../../../shared/schema';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      const userRepository = new UserRepository();
      const loginUseCase = new LoginUseCase(userRepository);
      
      const result = await loginUseCase.execute(validatedData);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response) {
    res.json({ message: 'Logout realizado com sucesso' });
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      
      const userRepository = new UserRepository();
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      });
    } catch (error) {
      next(error);
    }
  }
}
