
import { Router } from 'express';
import { CreativeController } from './creative.controller';
import { CreativeService } from './creative.service';
import { CreativeRepository } from './creative.repository';
import { authenticate } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validation.middleware';
import { insertCreativeSchema } from '@shared/schema';

const router = Router();

// Dependency Injection
const creativeRepository = new CreativeRepository();
const creativeService = new CreativeService(creativeRepository);
const creativeController = new CreativeController(creativeService);

// Routes
router.get('/', authenticate, creativeController.getAll);
router.get('/:id', authenticate, creativeController.getById);
router.get('/campaign/:campaignId', authenticate, creativeController.getByCampaign);
router.post('/', authenticate, validate(insertCreativeSchema), creativeController.create);
router.put('/:id', authenticate, creativeController.update);
router.delete('/:id', authenticate, creativeController.delete);

export default router;
