import { Router } from 'express';
import { query, body } from 'express-validator';
import { pullSync, pushSync } from '../controllers/sync.controller';
import { validate } from '../middleware/validate';

const router = Router();

router.get(
  '/pull',
  query('since').optional().isISO8601().withMessage('since must be a valid ISO 8601 date'),
  validate,
  pullSync
);

router.post(
  '/push',
  body('habits').optional().isArray(),
  body('completions').optional().isArray(),
  body('lastSyncAt').optional().isISO8601().withMessage('lastSyncAt must be a valid ISO 8601 date'),
  validate,
  pushSync
);

export default router;
