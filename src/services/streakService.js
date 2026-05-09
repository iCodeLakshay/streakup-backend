import { Completion } from "../models/completion.model.js";
import { StreakCache } from "../models/streakCache.model.js";

const toDateStr = (date) => date.toISOString().slice(0, 10);

const yesterday = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateStr(d);
};

export const computeStreak = async (habitId, userId) => {
  const completions = await Completion.find({ habitId })
    .sort({ date: -1 })
    .select("date")
    .lean();

  if (completions.length === 0) {
    await StreakCache.findOneAndUpdate(
      { habitId },
      { habitId, userId, currentStreak: 0, bestStreak: 0, lastComputedAt: new Date() },
      { upsert: true, returnDocument: "after" }
    );
    return { currentStreak: 0, bestStreak: 0 };
  }

  const today = toDateStr(new Date());
  const mostRecent = completions[0].date;

  // Current streak is 0 if the most recent completion is not today or yesterday
  const isActive = mostRecent === today || mostRecent === yesterday(today);

  let currentStreak = 0;
  if (isActive) {
    let expected = mostRecent;
    for (const { date } of completions) {
      if (date === expected) {
        currentStreak++;
        expected = yesterday(expected);
      } else {
        break;
      }
    }
  }

  // Best streak: scan all completions for the longest consecutive run
  let bestStreak = 0;
  let run = 1;
  for (let i = 0; i < completions.length - 1; i++) {
    if (completions[i + 1].date === yesterday(completions[i].date)) {
      run++;
    } else {
      bestStreak = Math.max(bestStreak, run);
      run = 1;
    }
  }
  bestStreak = Math.max(bestStreak, run);

  // Never let bestStreak go below the existing stored value (protects against data loss)
  const existing = await StreakCache.findOne({ habitId }).lean();
  if (existing && existing.bestStreak > bestStreak) {
    bestStreak = existing.bestStreak;
  }

  await StreakCache.findOneAndUpdate(
    { habitId },
    { habitId, userId, currentStreak, bestStreak, lastComputedAt: new Date() },
    { upsert: true, returnDocument: "after" }
  );

  return { currentStreak, bestStreak };
};
