import { Habit } from "../models/habit.model.js";
import { Completion } from "../models/completion.model.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { computeStreak } from "../services/streakService.js";

export const listHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ userId: req.user.id, archivedAt: null }).lean();
  res.json({ data: habits });
});

export const createHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note } = req.body;
  const habit = await Habit.create({ userId: req.user.id, name, emoji, color, note });
  res.status(201).json({ data: habit });
});

export const updateHabit = asyncHandler(async (req, res) => {
  const { name, emoji, color, note } = req.body;

  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, archivedAt: null },
    { name, emoji, color, note },
    { new: true, runValidators: true }
  );

  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
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
    return res.status(404).json({ error: "Habit not found" });
  }

  res.status(204).send();
});

export const checkIn = asyncHandler(async (req, res) => {
  const { date } = req.body;

  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id, archivedAt: null }).lean();
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }

  const completion = await Completion.create({
    habitId: habit._id,
    userId: req.user.id,
    date,
    completedAt: new Date(),
  });

  const streak = await computeStreak(habit._id, req.user.id);

  res.status(201).json({ data: { completion, streak } });
});

export const undo = asyncHandler(async (req, res) => {
  const { date } = req.body;

  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id, archivedAt: null }).lean();
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }

  const deleted = await Completion.findOneAndDelete({ habitId: habit._id, userId: req.user.id, date });
  if (!deleted) {
    return res.status(404).json({ error: "No completion found for that date" });
  }

  await computeStreak(habit._id, req.user.id);

  res.status(204).send();
});
