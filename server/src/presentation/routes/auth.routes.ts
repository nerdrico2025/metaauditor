
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();
const authController = new AuthController();

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', authenticateToken, (req, res, next) => authController.me(req, res, next));

export default router;
