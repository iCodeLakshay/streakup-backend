import mongoose from "mongoose";

const streakCacheSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

export const StreakCache = mongoose.model("StreakCache", streakCacheSchema);
