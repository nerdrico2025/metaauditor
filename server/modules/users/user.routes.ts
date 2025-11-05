
import { Router } from 'express';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { authenticate, authorize } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validation.middleware';
import { createUserSchema, updateUserSchema, updateProfileSchema, changePasswordSchema } from '@shared/schema';

const router = Router();

// Dependency Injection
const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// Admin routes
router.get('/', authenticate, authorize('administrador', 'super_admin'), userController.getAll);
router.post('/', authenticate, authorize('administrador', 'super_admin'), validate(createUserSchema), userController.create);
router.put('/:id', authenticate, authorize('administrador', 'super_admin'), validate(updateUserSchema), userController.update);
router.delete('/:id', authenticate, authorize('administrador', 'super_admin'), userController.delete);

// Profile routes
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, validate(updateProfileSchema), userController.updateProfile);
router.put('/profile/password', authenticate, validate(changePasswordSchema), userController.changePassword);

export default router;
