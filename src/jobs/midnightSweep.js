import cron from "node-cron";
import { Habit } from "../models/habit.model.js";
import { Completion } from "../models/completion.model.js";
import { StreakCache } from "../models/streakCache.model.js";

const getYesterdayStr = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const runMidnightSweep = async () => {
  const yesterday = getYesterdayStr();
  console.log(`[MidnightSweep] Running for yesterday: ${yesterday}`);

  let reset = 0;
  let skipped = 0;

  try {
    const habits = await Habit.find({ archivedAt: null }).select("_id userId").lean();

    for (const habit of habits) {
      try {
        const hasCompletion = await Completion.exists({ habitId: habit._id, date: yesterday });

        if (!hasCompletion) {
          await StreakCache.findOneAndUpdate(
            { habitId: habit._id },
            { currentStreak: 0, lastComputedAt: new Date() },
            { returnDocument: "after" }
          );
          reset++;
        } else {
          skipped++;
        }
      } catch (err) {
        // Per-habit failures are silent — client recomputes on next sync
        console.error(`[MidnightSweep] Failed for habit ${habit._id}:`, err.message);
      }
    }

    console.log(`[MidnightSweep] Done — reset: ${reset}, unchanged: ${skipped}`);
  } catch (err) {
    console.error("[MidnightSweep] Fatal error:", err.message);
  }
};

export const scheduleMidnightSweep = () => {
  cron.schedule("0 0 * * *", runMidnightSweep, { timezone: "UTC" });
  console.log("[MidnightSweep] Scheduled at 00:00 UTC daily");
};
