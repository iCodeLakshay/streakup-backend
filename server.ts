import 'dotenv/config';
import { connectDB } from './src/config/db';
import { scheduleMidnightSweep } from './src/jobs/midnightSweep';
import app from './src/app';

if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error('Missing required environment variables: JWT_SECRET, MONGODB_URI');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;

const start = async (): Promise<void> => {
  await connectDB();
  scheduleMidnightSweep();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err: Error) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
