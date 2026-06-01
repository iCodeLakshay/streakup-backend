import { Types } from 'mongoose';
import { Habit } from '../models/habit.model';
import { Completion } from '../models/completion.model';
import { asyncHandler } from '../middleware/asyncHandler';
import { computeStreak } from '../services/streakService';

export const listHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ userId: req.user.id, archivedAt: null }).lean();
  res.json({ data: habits });
});

export const createHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note } = req.body as { name: string; emoji?: string; color?: string; note?: string };
  const habit = await Habit.create({ userId: req.user.id, name, emoji, color, note });
  res.status(201).json({ data: habit });
});

export const updateHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note } = req.body as { name?: string; emoji?: string; color?: string; note?: string };

  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, archivedAt: null },
    { name, emoji, color, note },
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

  res.status(201).json({ data: { completion, streak } });
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
