import mongoose, { Document, Types } from 'mongoose';

interface ICompletion {
  habitId: Types.ObjectId;
  userId: Types.ObjectId;
  date: string;
  completedAt: Date;
  createdAt: Date;
}

export type ICompletionDocument = Document<unknown, object, ICompletion> & ICompletion & { _id: Types.ObjectId };

const completionSchema = new mongoose.Schema<ICompletion>(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Enforces one completion per habit per day
completionSchema.index({ habitId: 1, date: 1 }, { unique: true });

// sync pull filters { userId, createdAt: { $gt } }; push checks
// { userId, habitId: { $in }, date: { $in } }.
completionSchema.index({ userId: 1, createdAt: 1 });
completionSchema.index({ userId: 1, habitId: 1, date: 1 });

export const Completion = mongoose.model<ICompletion>('Completion', completionSchema);
