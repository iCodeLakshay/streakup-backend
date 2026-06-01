import mongoose, { Document, Types } from 'mongoose';

interface IHabit {
  userId: Types.ObjectId;
  name: string;
  emoji: string | null;
  color: string | null;
  note: string | null;
  archivedAt: Date | null;
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
  },
  { timestamps: true }
);

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
