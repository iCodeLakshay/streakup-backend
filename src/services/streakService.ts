import { Types } from 'mongoose';
import { getISOWeek, getISOWeekYear, parseISO, getDay, subDays } from 'date-fns';
import { Habit, TargetType } from '../models/habit.model';
import { Completion } from '../models/completion.model';
import { StreakCache } from '../models/streakCache.model';
import { toDateStr, yesterday } from '../utils/date';
import { StreakResult } from '../types';

export const isTargetReached = (targetType: TargetType, targetValue: number, currentStreak: number): boolean => {
  if (targetType === 'weekdays') {
    const selectedCount = [0, 1, 2, 3, 4, 5, 6].filter(i => targetValue & (1 << i)).length;
    return currentStreak >= selectedCount;
  }
  return currentStreak >= targetValue;
};

const upsertCache = async (habitId: Types.ObjectId, userId: Types.ObjectId, currentStreak: number, bestStreak: number) => {
  await StreakCache.findOneAndUpdate(
    { habitId },
    { habitId, userId, currentStreak, bestStreak, lastComputedAt: new Date() },
    { upsert: true, returnDocument: 'after' }
  );
};

const protectBest = async (habitId: Types.ObjectId, computed: number): Promise<number> => {
  const existing = await StreakCache.findOne({ habitId }).lean();
  return existing && existing.bestStreak > computed ? existing.bestStreak : computed;
};

export const computeStreak = async (habitId: Types.ObjectId, userId: Types.ObjectId): Promise<StreakResult> => {
  const habit = await Habit.findById(habitId).lean();
  const targetType: TargetType = habit?.targetType ?? 'streak';
  const targetValue: number = habit?.targetValue ?? 30;

  const completions = await Completion.find({ habitId })
    .sort({ date: -1 })
    .select('date')
    .lean();

  // --- total: count all completions, no consecutive logic ---
  if (targetType === 'total') {
    const currentStreak = completions.length;
    const bestStreak = await protectBest(habitId, currentStreak);
    await upsertCache(habitId, userId, currentStreak, bestStreak);
    return { currentStreak, bestStreak };
  }

  if (completions.length === 0) {
    await upsertCache(habitId, userId, 0, 0);
    return { currentStreak: 0, bestStreak: 0 };
  }

  // --- weekdays: consecutive selected-day completions (pause, not break on miss) ---
  if (targetType === 'weekdays') {
    const selectedDays = [0, 1, 2, 3, 4, 5, 6].filter(i => targetValue & (1 << i));
    const completionDates = new Set(completions.map(c => c.date));

    // Walk backward from today through only selected-day dates
    let currentStreak = 0;
    let date = new Date();
    // Check up to 2 years back to find the streak start
    for (let i = 0; i < 730; i++) {
      const dayOfWeek = getDay(date);
      if (selectedDays.includes(dayOfWeek)) {
        const dateStr = toDateStr(date);
        if (completionDates.has(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
      date = subDays(date, 1);
    }

    // Best streak: longest consecutive run of selected-day completions
    let bestRun = 0;
    let run = 0;
    let prevWasHit: boolean | null = null;
    // Walk from oldest to newest through selected-day dates only
    const sortedDates = [...completions].reverse().map(c => c.date);
    let scanDate = completions.length > 0 ? parseISO(sortedDates[0]) : new Date();
    const today = new Date();
    const dateSet = completionDates;
    // Rebuild selected-day walk oldest→newest
    const allSelectedDateStrs: string[] = [];
    let d = new Date(scanDate);
    while (d <= today) {
      if (selectedDays.includes(getDay(d))) {
        allSelectedDateStrs.push(toDateStr(d));
      }
      d = new Date(d.getTime() + 86400000);
    }
    run = 0;
    for (const ds of allSelectedDateStrs) {
      if (dateSet.has(ds)) {
        run++;
        bestRun = Math.max(bestRun, run);
      } else {
        run = 0;
      }
    }
    const bestStreak = await protectBest(habitId, bestRun);
    await upsertCache(habitId, userId, currentStreak, bestStreak);
    return { currentStreak, bestStreak };
  }

  // --- weekly_frequency: consecutive weeks meeting quota ---
  if (targetType === 'weekly_frequency') {
    // Group completions by ISO week key
    const weekCounts = new Map<string, number>();
    for (const { date } of completions) {
      const d = parseISO(date);
      const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    const todayD = new Date();
    const currentWeekKey = `${getISOWeekYear(todayD)}-W${String(getISOWeek(todayD)).padStart(2, '0')}`;

    // Walk backward through weeks; current week is exempt (still in progress)
    let currentStreak = 0;
    let weekDate = subDays(todayD, 7); // start from last week
    for (let i = 0; i < 104; i++) { // max 2 years
      const key = `${getISOWeekYear(weekDate)}-W${String(getISOWeek(weekDate)).padStart(2, '0')}`;
      if (key === currentWeekKey) {
        weekDate = subDays(weekDate, 7);
        continue;
      }
      const count = weekCounts.get(key) ?? 0;
      if (count >= targetValue) {
        currentStreak++;
      } else {
        break;
      }
      weekDate = subDays(weekDate, 7);
    }

    // Best: scan all weeks for max consecutive run
    const allKeys = [...weekCounts.keys()].sort();
    let bestRun = 0;
    let run = 0;
    for (const key of allKeys) {
      if (key === currentWeekKey) continue;
      if ((weekCounts.get(key) ?? 0) >= targetValue) {
        run++;
        bestRun = Math.max(bestRun, run);
      } else {
        run = 0;
      }
    }
    const bestStreak = await protectBest(habitId, bestRun);
    await upsertCache(habitId, userId, currentStreak, bestStreak);
    return { currentStreak, bestStreak };
  }

  // --- streak (default): consecutive days ---
  const today = toDateStr(new Date());
  const mostRecent = completions[0].date;
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
  bestStreak = await protectBest(habitId, bestStreak);

  await upsertCache(habitId, userId, currentStreak, bestStreak);
  return { currentStreak, bestStreak };
};
