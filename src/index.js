import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.routes.js";
import habitRouter from "./routes/habit.routes.js";
import syncRouter from "./routes/sync.routes.js";
import { scheduleMidnightSweep } from "./jobs/midnightSweep.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(morgan("combined"));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/v1", (req, res) => {
  res.json({ message: "StreakUp API v1.0.0" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/habits", habitRouter);
app.use("/api/v1/sync", syncRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

const start = async () => {
  await connectDB();
  scheduleMidnightSweep();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
