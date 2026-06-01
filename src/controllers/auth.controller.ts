import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { asyncHandler } from '../middleware/asyncHandler';

const signToken = (user: { _id: Types.ObjectId; email: string }): string =>
  jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as StringValue,
  });

export const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const user = await User.create({ email, password });
  const token = signToken(user);

  res.status(201).json({ token, user: { id: user._id, email: user.email } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken(user);

  res.json({ token, user: { id: user._id, email: user.email } });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: { id: user._id, email: user.email, createdAt: user.createdAt } });
});
