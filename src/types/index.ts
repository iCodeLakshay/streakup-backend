import { Types } from 'mongoose';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

export interface SyncConflict {
  type: 'habit';
  id: Types.ObjectId;
  serverRecord: Record<string, unknown>;
}

export interface PullResult {
  habits: unknown[];
  completions: unknown[];
  deletions: { id: Types.ObjectId; archivedAt: Date }[];
}

export interface PushResult {
  conflicts: SyncConflict[];
}
