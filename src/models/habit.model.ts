import mongoose, { Document, Types } from 'mongoose';

export type TargetType = 'streak' | 'total' | 'weekdays' | 'weekly_frequency';

interface IHabit {
  userId: Types.ObjectId;
  name: string;
  emoji: string | null;
  color: string | null;
  note: string | null;
  archivedAt: Date | null;
  targetType: TargetType;
  targetValue: number;
  targetCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IHabitDocument = Document<unknown, object, IHabit> & IHabit & { _id: Types.ObjectId };

const habitSchema = new mongoose.Schema<IHabit>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    emoji: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    targetType: {
      type: String,
      enum: ['streak', 'total', 'weekdays', 'weekly_frequency'],
      required: true,
      default: 'streak',
    },
    targetValue: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    targetCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// listHabits filters { userId, archivedAt: null }; sync pull filters
// { userId, updatedAt: { $gt } }. Compound indexes cover both hot paths.
habitSchema.index({ userId: 1, archivedAt: 1 });
habitSchema.index({ userId: 1, updatedAt: 1 });

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
