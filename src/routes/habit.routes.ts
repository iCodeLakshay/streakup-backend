import { Router } from 'express';
import { body, param } from 'express-validator';
import { listHabits, createHabit, updateHabit, deleteHabit, checkIn, undo } from '../controllers/habit.controller';
import { validate } from '../middleware/validate';

const router = Router();

const mongoId = param('id').isMongoId().withMessage('Invalid habit ID');

const habitBodyRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 40 }).withMessage('Name must be 40 characters or less'),
  body('emoji').optional({ nullable: true }).isString(),
  body('color').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }).isString(),
];

const patchRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 40 }).withMessage('Name must be 40 characters or less'),
  body('emoji').optional({ nullable: true }).isString(),
  body('color').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }).isString(),
];

const dateRule = body('date')
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage('date must be in YYYY-MM-DD format');

// Route definitions
router.get('/', listHabits);
router.post('/', habitBodyRules, validate, createHabit);
router.patch('/:id', mongoId, patchRules, validate, updateHabit);
router.delete('/:id', mongoId, validate, deleteHabit);
router.post('/:id/complete', mongoId, dateRule, validate, checkIn);
router.delete('/:id/undo', mongoId, dateRule, validate, undo);

export default router;
