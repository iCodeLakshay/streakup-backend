import { Types } from 'mongoose';
import { Habit, TargetType } from '../models/habit.model';
import { Completion } from '../models/completion.model';
import { asyncHandler } from '../middleware/asyncHandler';
import { computeStreak, isTargetReached } from '../services/streakService';

export const listHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ userId: req.user.id, archivedAt: null }).lean();
  res.json({ data: habits });
});

export const createHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note, targetType, targetValue } = req.body as {
    name: string;
    emoji?: string;
    color?: string;
    note?: string;
    targetType: TargetType;
    targetValue: number;
  };
  const habit = await Habit.create({ userId: req.user.id, name, emoji, color, note, targetType, targetValue });
  res.status(201).json({ data: habit });
});

export const updateHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note, targetType, targetValue, targetCompletedAt } = req.body as {
    name?: string;
    emoji?: string;
    color?: string;
    note?: string;
    targetType?: TargetType;
    targetValue?: number;
    targetCompletedAt?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (emoji !== undefined) updates.emoji = emoji;
  if (color !== undefined) updates.color = color;
  if (note !== undefined) updates.note = note;
  if (targetType !== undefined) updates.targetType = targetType;
  if (targetValue !== undefined) updates.targetValue = targetValue;
  if (targetCompletedAt !== undefined) updates.targetCompletedAt = targetCompletedAt ? new Date(targetCompletedAt) : null;

  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, archivedAt: null },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!habit) {
    res.status(404).json({ error: 'Habit not found' });
    return;
  }

  res.json({ data: habit });
});

export const deleteHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, archivedAt: null },
    { archivedAt: new Date() },
    { new: true }
  );

  if (!habit) {
    res.status(404).json({ error: 'Habit not found' });
    return;
  }

  res.status(204).send();
});

export const checkIn = asyncHandler(async (req, res) => {
  const { date } = req.body as { date: string };

  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id, archivedAt: null }).lean();
  if (!habit) {
    res.status(404).json({ error: 'Habit not found' });
    return;
  }

  const completion = await Completion.create({
    habitId: habit._id,
    userId: req.user.id,
    date,
    completedAt: new Date(),
  });

  const streak = await computeStreak(habit._id as Types.ObjectId, new Types.ObjectId(req.user.id));

  let targetJustReached = false;
  if (isTargetReached(habit.targetType, habit.targetValue, streak.currentStreak) && !habit.targetCompletedAt) {
    await Habit.findByIdAndUpdate(habit._id, { targetCompletedAt: new Date() });
    targetJustReached = true;
  }

  res.status(201).json({ data: { completion, streak, targetJustReached } });
});

export const undo = asyncHandler(async (req, res) => {
  const { date } = req.body as { date: string };

  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id, archivedAt: null }).lean();
  if (!habit) {
    res.status(404).json({ error: 'Habit not found' });
    return;
  }

  const deleted = await Completion.findOneAndDelete({ habitId: habit._id, userId: req.user.id, date });
  if (!deleted) {
    res.status(404).json({ error: 'No completion found for that date' });
    return;
  }

  await computeStreak(habit._id as Types.ObjectId, new Types.ObjectId(req.user.id));

  res.status(204).send();
});
