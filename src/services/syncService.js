import { Habit } from "../models/habit.model.js";
import { Completion } from "../models/completion.model.js";

export const pull = async (userId, since) => {
  const sinceDate = since ? new Date(since) : new Date(0);

  const [habits, completions] = await Promise.all([
    Habit.find({ userId, updatedAt: { $gt: sinceDate } }).lean(),
    Completion.find({ userId, createdAt: { $gt: sinceDate } }).lean(),
  ]);

  // Deletions = archived habits updated after sinceDate
  const deletions = habits
    .filter((h) => h.archivedAt !== null)
    .map((h) => ({ id: h._id, archivedAt: h.archivedAt }));

  return {
    habits: habits.filter((h) => h.archivedAt === null),
    completions,
    deletions,
  };
};

export const push = async (userId, clientHabits = [], clientCompletions = []) => {
  const conflicts = [];

  // --- Habits ---
  for (const clientHabit of clientHabits) {
    const serverHabit = await Habit.findOne({ _id: clientHabit._id, userId }).lean();

    if (!serverHabit) {
      // New habit from client — insert it
      await Habit.create({ ...clientHabit, userId });
      continue;
    }

    if (new Date(clientHabit.updatedAt) > new Date(serverHabit.updatedAt)) {
      await Habit.findByIdAndUpdate(serverHabit._id, {
        name: clientHabit.name,
        emoji: clientHabit.emoji,
        color: clientHabit.color,
        note: clientHabit.note,
        archivedAt: clientHabit.archivedAt ?? null,
        updatedAt: clientHabit.updatedAt,
      });
    } else {
      // Server is newer — client is stale, report as conflict
      conflicts.push({ type: "habit", id: serverHabit._id, serverRecord: serverHabit });
    }
  }

  // --- Completions ---
  for (const clientCompletion of clientCompletions) {
    const exists = await Completion.findOne({
      habitId: clientCompletion.habitId,
      userId,
      date: clientCompletion.date,
    }).lean();

    if (!exists) {
      await Completion.create({ ...clientCompletion, userId });
    }
    // Completions are immutable once written — no conflict resolution needed
  }

  return { conflicts };
};
