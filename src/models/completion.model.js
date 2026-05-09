import mongoose from "mongoose";

const completionSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

export const Completion = mongoose.model("Completion", completionSchema);
