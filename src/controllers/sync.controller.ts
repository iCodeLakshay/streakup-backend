import { asyncHandler } from '../middleware/asyncHandler';
import { pull, push, ClientHabit, ClientCompletion } from '../services/syncService';
import { User } from '../models/user.model';

export const pullSync = asyncHandler(async (req, res) => {
  const { since } = req.query;
  const result = await pull(req.user.id, since);
  res.json({ data: result });
});

export const pushSync = asyncHandler(async (req, res) => {
  const { habits, completions, lastSyncAt } = req.body as {
    habits?: ClientHabit[];
    completions?: ClientCompletion[];
    lastSyncAt?: string;
  };
  const result = await push(req.user.id, habits, completions);

  // Update lastSyncAt on the user record
  await User.findByIdAndUpdate(req.user.id, { lastSyncAt: lastSyncAt ?? new Date() });

  res.json({ data: result });
});
