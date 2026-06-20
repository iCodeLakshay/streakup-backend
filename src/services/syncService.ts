import { Habit } from '../models/habit.model';
import { Completion } from '../models/completion.model';
import { PullResult, PushResult, SyncConflict } from '../types';

export interface ClientHabit {
  _id?: string;
  updatedAt?: string;
  name?: string;
  emoji?: string | null;
  color?: string | null;
  note?: string | null;
  archivedAt?: string | null;
}

export interface ClientCompletion {
  habitId?: string;
  date?: string;
  completedAt?: string;
}

export const pull = async (userId: string, since: unknown): Promise<PullResult> => {
  const sinceDate = since ? new Date(since as string) : new Date(0);

  const [habits, completions] = await Promise.all([
    Habit.find({ userId, updatedAt: { $gt: sinceDate } }).lean(),
    Completion.find({ userId, createdAt: { $gt: sinceDate } }).lean(),
  ]);

  // Deletions = archived habits updated after sinceDate
  const deletions = habits
    .filter((h) => h.archivedAt !== null)
    .map((h) => ({ id: h._id, archivedAt: h.archivedAt as Date }));

  return {
    habits: habits.filter((h) => h.archivedAt === null),
    completions,
    deletions,
  };
};

export const push = async (
  userId: string,
  clientHabits: ClientHabit[] = [],
  clientCompletions: ClientCompletion[] = []
): Promise<PushResult> => {
  const conflicts: SyncConflict[] = [];

  // --- Habits ---
  // Batch-read all referenced server habits in ONE query (avoids N findOnes),
  // then apply individual validated writes (habits per user are few, and
  // individual writes preserve schema validation / mass-assignment protection).
  const habitIds = clientHabits.map((h) => h._id).filter(Boolean);
  const serverHabits = habitIds.length
    ? await Habit.find({ _id: { $in: habitIds }, userId }).lean()
    : [];
  const serverHabitMap = new Map(serverHabits.map((h) => [String(h._id), h]));

  for (const clientHabit of clientHabits) {
    // Whitelist only the fields a client is allowed to set. Never spread the raw
    // client object (prevents mass assignment of userId, _id-on-update, etc.).
    const fields = {
      name: clientHabit.name,
      emoji: clientHabit.emoji ?? null,
      color: clientHabit.color ?? null,
      note: clientHabit.note ?? null,
      archivedAt: clientHabit.archivedAt ? new Date(clientHabit.archivedAt) : null,
    };

    const serverHabit = clientHabit._id ? serverHabitMap.get(String(clientHabit._id)) : undefined;

    if (!serverHabit) {
      // New habit from client — insert it (schema validators enforce limits).
      await Habit.create({ ...fields, userId });
      continue;
    }

    if (new Date(clientHabit.updatedAt ?? 0) > new Date(serverHabit.updatedAt)) {
      // runValidators so name length / enums are enforced on the sync path too.
      await Habit.findByIdAndUpdate(
        serverHabit._id,
        { ...fields, updatedAt: clientHabit.updatedAt },
        { runValidators: true }
      );
    } else {
      // Server is newer — client is stale, report as conflict
      conflicts.push({ type: 'habit', id: serverHabit._id, serverRecord: serverHabit as unknown as Record<string, unknown> });
    }
  }

  // --- Completions ---
  // Fully batched: 2 reads (owned habits + existing completions) then one
  // insertMany, instead of 2 queries + 1 write per completion.
  if (clientCompletions.length > 0) {
    // 1) Resolve which referenced habits this user actually owns. Verifying
    //    ownership prevents writing completions against another user's habitId
    //    (the {habitId,date} unique index is global → would block their check-in).
    const refHabitIds = [...new Set(clientCompletions.map((c) => c.habitId).filter((id): id is string => !!id))];
    const ownedHabits = refHabitIds.length
      ? await Habit.find({ _id: { $in: refHabitIds }, userId }).select('_id').lean()
      : [];
    const ownedIds = ownedHabits.map((h) => h._id);
    const ownedSet = new Set(ownedIds.map((id) => String(id)));

    // 2) Fetch existing completions only for the (habit, date) pairs being pushed.
    const pushDates = [...new Set(clientCompletions.map((c) => c.date).filter((d): d is string => !!d))];
    const existing = ownedIds.length && pushDates.length
      ? await Completion.find({ userId, habitId: { $in: ownedIds }, date: { $in: pushDates } })
          .select('habitId date')
          .lean()
      : [];
    const seen = new Set(existing.map((e) => `${String(e.habitId)}|${e.date}`));

    // 3) Build the insert set (whitelisted fields, de-duped within the batch).
    const toInsert: { habitId: string; userId: string; date: string; completedAt: Date }[] = [];
    for (const c of clientCompletions) {
      if (!c.habitId || !c.date || !ownedSet.has(String(c.habitId))) continue;
      const key = `${String(c.habitId)}|${c.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        habitId: c.habitId,
        userId,
        date: c.date,
        completedAt: c.completedAt ? new Date(c.completedAt) : new Date(),
      });
    }

    if (toInsert.length > 0) {
      try {
        // ordered:false validates each doc and keeps inserting past any
        // duplicate-key race (completions are immutable — no conflict handling).
        await Completion.insertMany(toInsert, { ordered: false });
      } catch {
        // Ignore duplicate-key races; non-conflicting docs are still inserted.
      }
    }
  }

  return { conflicts };
};
