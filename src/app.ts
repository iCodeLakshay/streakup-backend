import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import habitRouter from './routes/habit.routes';
import syncRouter from './routes/sync.routes';
import { authenticate } from './middleware/authenticate';
import './types'; // activate Express.Request augmentation

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests' },
});

// General limiter for authenticated data routes — guards against abuse/DoS of
// the habit and (loop-heavy) sync endpoints.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests' },
});

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1', (_req, res) => {
  res.json({ message: 'StreakUp API v1.0.0' });
});

app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/habits', apiLimiter, authenticate, habitRouter);
app.use('/api/v1/sync', apiLimiter, authenticate, syncRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
