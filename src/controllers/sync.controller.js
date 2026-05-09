import { asyncHandler } from "../middleware/asyncHandler.js";
import { pull, push } from "../services/syncService.js";
import { User } from "../models/user.model.js";

export const pullSync = asyncHandler(async (req, res) => {
  const { since } = req.query;
  const result = await pull(req.user.id, since);
  res.json({ data: result });
});

export const pushSync = asyncHandler(async (req, res) => {
  const { habits, completions, lastSyncAt } = req.body;
  const result = await push(req.user.id, habits, completions);

  // Update lastSyncAt on the user record
  await User.findByIdAndUpdate(req.user.id, { lastSyncAt: lastSyncAt ?? new Date() });

  res.json({ data: result });
});
