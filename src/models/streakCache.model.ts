import mongoose, { Document, Types } from 'mongoose';

interface IStreakCache {
  habitId: Types.ObjectId;
  userId: Types.ObjectId;
  currentStreak: number;
  bestStreak: number;
  lastComputedAt: Date;
}

export type IStreakCacheDocument = Document<unknown, object, IStreakCache> & IStreakCache & { _id: Types.ObjectId };

const streakCacheSchema = new mongoose.Schema<IStreakCache>(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentStreak: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    bestStreak: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastComputedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: false }
);

export const StreakCache = mongoose.model<IStreakCache>('StreakCache', streakCacheSchema);
