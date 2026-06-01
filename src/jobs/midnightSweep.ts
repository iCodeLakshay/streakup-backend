import cron from 'node-cron';
import { Habit } from '../models/habit.model';
import { Completion } from '../models/completion.model';
import { StreakCache } from '../models/streakCache.model';
import { yesterday } from '../utils/date';
import { toDateStr } from '../utils/date';

export const runMidnightSweep = async (): Promise<void> => {
  const yesterdayStr = yesterday(toDateStr(new Date()));
  console.log(`[MidnightSweep] Running for yesterday: ${yesterdayStr}`);

  let reset = 0;
  let skipped = 0;

  try {
    const habits = await Habit.find({ archivedAt: null }).select('_id userId').lean();

    for (const habit of habits) {
      try {
        const hasCompletion = await Completion.exists({ habitId: habit._id, date: yesterdayStr });

        if (!hasCompletion) {
          await StreakCache.findOneAndUpdate(
            { habitId: habit._id },
            { currentStreak: 0, lastComputedAt: new Date() },
            { returnDocument: 'after' }
          );
          reset++;
        } else {
          skipped++;
        }
      } catch (err) {
        // Per-habit failures are silent — client recomputes on next sync
        console.error(`[MidnightSweep] Failed for habit ${habit._id}:`, (err as Error).message);
      }
    }

    console.log(`[MidnightSweep] Done — reset: ${reset}, unchanged: ${skipped}`);
  } catch (err) {
    console.error('[MidnightSweep] Fatal error:', (err as Error).message);
  }
};

export const scheduleMidnightSweep = (): void => {
  cron.schedule('0 0 * * *', runMidnightSweep, { timezone: 'UTC' });
  console.log('[MidnightSweep] Scheduled at 00:00 UTC daily');
};
