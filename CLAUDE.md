# CLAUDE.md — StreakUp Backend (Express + MongoDB)

## Project Overview
REST API for StreakUp habit streak app. Handles auth (JWT), habit CRUD, streak computation, and offline-first sync. Built with Express.js + TypeScript + MongoDB (Mongoose).

---

## Tech Stack
- **Runtime:** Node.js 20+
- **Framework:** Express.js 5
- **Language:** TypeScript (strict mode)
- **Database:** MongoDB via Mongoose 9
- **Auth:** jsonwebtoken + bcryptjs
- **Validation:** express-validator
- **Scheduling:** node-cron (midnight streak sweep)
- **Middleware:** cors, helmet, compression, morgan
- **Rate limiting:** express-rate-limit (auth routes only)
- **Dev:** nodemon, ts-node

---

## Project Structure
```
streakup-api/
├── src/
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── habit.routes.ts
│   │   └── sync.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── habit.controller.ts
│   │   └── sync.controller.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Habit.ts
│   │   ├── Completion.ts
│   │   └── StreakCache.ts
│   ├── middleware/
│   │   ├── authenticate.ts   # JWT verify middleware
│   │   ├── validate.ts       # express-validator error handler
│   │   └── errorHandler.ts
│   ├── services/
│   │   ├── streakService.ts  # streak computation logic
│   │   └── syncService.ts    # conflict resolution logic
│   ├── jobs/
│   │   └── midnightSweep.ts  # node-cron midnight streak reset
│   ├── utils/
│   │   └── date.ts           # timezone-safe date helpers
│   ├── config/
│   │   └── db.ts             # Mongoose connection
│   └── app.ts                # Express app setup (no listen here)
├── server.ts                 # Entry point — listen + cron start
├── .env
└── tsconfig.json
```

---

## Commands
```bash
npm run dev        # nodemon + ts-node (development)
npm run build      # tsc → dist/
npm run start      # node dist/server.js (production)
npm run typecheck  # tsc --noEmit
```

---

## API Endpoints

### Auth — `/api/v1/auth`
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/register` | `{ email, password }` | `{ token, user }` |
| POST | `/login` | `{ email, password }` | `{ token, user }` |
| GET | `/me` | — | `{ user }` |

### Habits — `/api/v1/habits` (all protected)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `[ habits ]` |
| POST | `/` | `{ name, emoji, color, note }` | `{ habit }` |
| PATCH | `/:id` | `{ name?, emoji?, color?, note? }` | `{ habit }` |
| DELETE | `/:id` | — | `204` |
| POST | `/:id/complete` | `{ date: "YYYY-MM-DD" }` | `{ completion, streak }` |
| DELETE | `/:id/undo` | `{ date: "YYYY-MM-DD" }` | `204` |

### Sync — `/api/v1/sync` (all protected)
| Method | Path | Body/Query | Response |
|---|---|---|---|
| GET | `/pull` | `?since=ISO8601` | `{ habits, completions, deletions }` |
| POST | `/push` | `{ habits[], completions[], lastSyncAt }` | `{ conflicts[] }` |

---

## MongoDB Schemas

### User
```ts
{
  _id: ObjectId,
  email: String,      // unique, lowercase, indexed
  password: String,   // bcrypt hashed, never returned in responses
  createdAt: Date,
  lastSyncAt: Date
}
```

### Habit
```ts
{
  _id: ObjectId,
  userId: ObjectId,   // indexed
  name: String,       // maxlength: 40
  emoji: String,
  color: String,
  note: String,
  createdAt: Date,
  updatedAt: Date,    // updated on every PATCH — used for sync conflict resolution
  archivedAt: Date | null
}
```

### Completion
```ts
{
  _id: ObjectId,
  habitId: ObjectId,  // indexed
  userId: ObjectId,   // indexed
  date: String,       // "YYYY-MM-DD" — local date sent by client
  completedAt: Date,
  createdAt: Date
}
// Compound unique index: { habitId: 1, date: 1 }
```

### StreakCache
```ts
{
  _id: ObjectId,
  habitId: ObjectId,  // unique indexed
  userId: ObjectId,
  currentStreak: Number,
  bestStreak: Number,
  lastComputedAt: Date
}
```

---

## Architecture Rules

### Authentication
- Passwords hashed with `bcryptjs` (cost factor 12)
- JWT signed with `JWT_SECRET`, expiry `7d`
- Never return `password` field in any response — use `.select('-password')` always
- `authenticate` middleware: verify token → attach `req.user = { id, email }` → next

### Streak Computation (`services/streakService.ts`)
- `computeStreak(habitId)`: queries completions sorted by date desc, counts consecutive days back from today
- Returns `{ currentStreak, bestStreak }`
- Always recompute and update `StreakCache` after every `/complete` or `/undo` call
- **Never trust the client's streak count** — always recompute server-side

### Midnight Sweep (`jobs/midnightSweep.ts`)
- Runs via `node-cron` at `0 0 * * *` (00:00 UTC)
- For every active habit: check if yesterday has a completion
- If not: set `currentStreak = 0` in StreakCache
- Log sweep results, never throw — failures are silent (client recomputes on next sync)

### Sync Conflict Resolution (`services/syncService.ts`)
- **Last-write-wins** based on `updatedAt`
- On `POST /sync/push`: compare client `updatedAt` vs server `updatedAt` per record
- Server wins if server `updatedAt` is newer — return conflicted records in `{ conflicts[] }`
- Deletions tracked via soft-delete (`archivedAt`) — propagated to client via `deletions[]` in pull

### Validation
- Use `express-validator` chains on all POST/PATCH routes
- Centralize error extraction in `middleware/validate.ts`
- Always validate `date` format as `YYYY-MM-DD` on complete/undo routes

---

## Middleware Stack Order (in `app.ts`)
```ts
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }))
app.use(helmet())
app.use(compression())
app.use(morgan('combined'))
app.use(express.json({ limit: '1mb' }))

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes)
app.use('/api/v1/habits', authenticate, habitRoutes)
app.use('/api/v1/sync', authenticate, syncRoutes)

// Must be last
app.use(errorHandler)
```

### Rate Limiting (auth routes only)
```ts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
```

---

## Error Handling
- All async route handlers wrapped in `try/catch` or use an `asyncHandler` wrapper
- `errorHandler` middleware returns: `{ error: string, code?: string }`
- HTTP status conventions:
  - `400` validation errors
  - `401` unauthenticated
  - `403` forbidden (wrong user's resource)
  - `404` not found
  - `409` duplicate completion (same habitId + date)
  - `500` unexpected server error

---

## DO / DON'T

### DO
- Always add `userId` filter to every DB query — never query habits without scoping to `req.user.id`
- Use compound index `{ habitId: 1, date: 1 }` on completions — critical for streak query performance
- Return consistent response shapes: `{ data: ... }` for success, `{ error: ... }` for failure
- Use `lean()` on read-only Mongoose queries for performance
- Validate `habitId` ownership before any complete/undo/delete operation

### DON'T
- Don't return the `password` field — ever
- Don't trust client-sent streak counts — always recompute
- Don't use `any` — fix the type
- Don't put business logic in controllers — it goes in `services/`
- Don't use `Date.now()` for date comparisons — use `date-fns` with UTC helpers
- Don't skip the `userId` scope on any query — it's a security bug

---

## Environment Variables (`.env`)
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/streakup
JWT_SECRET=your_strong_secret_here
ALLOWED_ORIGINS=http://localhost:8081,exp://localhost:8081
NODE_ENV=development
```

---

## Key Files to Know
| File | Purpose |
|---|---|
| `src/app.ts` | Express setup, middleware, route mounting |
| `src/middleware/authenticate.ts` | JWT verification — touch carefully |
| `src/services/streakService.ts` | Core streak logic — single source of truth |
| `src/services/syncService.ts` | Conflict resolution for offline-first sync |
| `src/jobs/midnightSweep.ts` | Cron — resets streaks at midnight UTC |
| `src/models/Completion.ts` | Has critical compound unique index |
| `src/routes/sync.routes.ts` | Most complex routes — read carefully before editing |
