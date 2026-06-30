# OMEN — Personal Command Dashboard

An AI-driven personal task dashboard built with Next.js. Talk to **OMEN** in
natural language and it creates, updates, and clears tasks for you — all backed
by a real SQLite database so your board **persists** across refreshes, browser
restarts, and server restarts. The centrepiece is an animated, reactive "orb"
that visibly responds as OMEN listens, thinks, and speaks.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript |
| Database | SQLite via Node.js 22 built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) (no native deps) |
| AI | NVIDIA NIM API (`meta/llama-4-maverick-17b-128e-instruct`), server-side only |
| Rendering | HTML Canvas (the reactive orb), pure CSS |

---

## Features

- **Natural-language task control** — "Add *Launch landing page* due Dec 31, high priority", "mark it as doing", "clear all done tasks". OMEN parses intent and mutates the board.
- **Reactive AI orb** — a Canvas-rendered ring that responds across four states (`idle` / `listening` / `thinking` / `speaking`) through brightness, size, and intensity, with frame-rate-independent timing.
- **On-demand response panel** — OMEN's replies slide out from the ring when you send a message or click the ring, then auto-hide after 30 seconds (or when you click away) to keep the stage clean.
- **Type anywhere** — just start typing and the command bar focuses automatically; no need to click it first.
- **Persistent database** — tasks survive page refreshes, browser closes, and server restarts.
- **Priority levels** — `low` / `medium` / `high`, shown as colour-coded badges.
- **Deadlines & descriptions** — stored per task and surfaced on the board.
- **Completion sparkline + year-progress bar** — at-a-glance dashboard metrics.
- **Server-side AI & secrets** — the NVIDIA API key lives in `.env` and is never sent to the browser; all task mutations happen inside the API route, not the client.
- **Safe-by-default AI actions** — the system prompt forbids inventing, duplicating, or guessing task names, and emits at most one structured `<action>` per reply.

---

## Quick Start

### 1. Requirements

- **Node.js ≥ 22.5.0** — required for the built-in `node:sqlite` module.
- An **NVIDIA NIM API key** — get one at [build.nvidia.com](https://build.nvidia.com).

### 2. Install

```bash
npm install
```

### 3. Configure environment

Copy the template and fill in your key:

```bash
cp .env.example .env
```

Edit `.env`:

```
# Path to the SQLite database file (created automatically on first run)
DATABASE_PATH="./omen.db"

# Your NVIDIA NIM API key
NVIDIA_API_KEY="your-nvidia-api-key-here"
```

The database file is created automatically on first run — no migrations needed.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build for production

```bash
npm run build
npm start
```

---

## Talking to OMEN

OMEN understands natural language for all task operations:

| You say | What happens |
|---|---|
| `Add "Launch landing page" due Dec 31, high priority` | Creates a task with deadline + priority |
| `Mark "Launch landing page" as doing` | Updates status |
| `Set description for "Launch landing page" to "needs A/B test"` | Adds a description |
| `Delete "Launch landing page"` | Removes the task |
| `Clear all done tasks` | Bulk-deletes everything marked done |
| `What should I focus on today?` | OMEN advises based on your current board |

Under the hood the model returns a structured `<action>` block (e.g.
`{"a":"create","name":"…","priority":"high"}`), which the `/api/chat` route
parses, validates against the existing board, and applies to the database.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/tasks` | Fetch all tasks |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a single task |
| `DELETE` | `/api/tasks?status=done` | Clear all done tasks |
| `POST` | `/api/chat` | Send a message to OMEN (returns reply + updated board) |

### Task object shape

```json
{
  "id": 1,
  "name": "Finish report",
  "status": "todo",
  "deadline": "2025-12-31",
  "priority": "high",
  "description": "Q4 annual report for the board",
  "createdAt": "2025-01-01 00:00:00",
  "updatedAt": "2025-01-01 00:00:00"
}
```

`status` is one of `todo` / `doing` / `done`; `priority` is `low` / `medium` / `high`.

---

## Database location

By default the SQLite file is created at `./omen.db` in the project root.
Override it with the `DATABASE_PATH` environment variable:

```
DATABASE_PATH=/data/omen.db
```

---

## Project structure

```
omen/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout + Google Fonts
│   │   ├── page.tsx                # Main UI: wires up dashboard, orb, chat
│   │   ├── globals.css             # All styles
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts         # GET, POST, DELETE /api/tasks
│   │       │   └── [id]/route.ts    # PATCH, DELETE /api/tasks/:id
│   │       └── chat/route.ts        # POST /api/chat (AI + DB mutations)
│   ├── components/
│   │   ├── Dashboard.tsx            # Completion sparkline, year bar, task list
│   │   ├── RingCanvas.tsx           # Canvas element for the reactive orb
│   │   ├── ResponsePanel.tsx        # Chat messages, typing indicator, toasts
│   │   └── ChatInput.tsx            # Message input
│   ├── hooks/
│   │   └── useRingEngine.ts         # Canvas animation engine for the orb
│   ├── lib/
│   │   └── db.ts                    # SQLite layer (node:sqlite) + CRUD
│   ├── utils/
│   │   ├── helpers.ts               # Time, escaping, lightweight markdown
│   │   └── sparkline.ts             # Completion sparkline renderer
│   └── types/
│       ├── index.ts                 # Shared Task / Message / AgentState types
│       └── node-sqlite.d.ts         # Ambient types for node:sqlite
├── .env.example                     # Env template (copy to .env)
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Deploying

Set `NVIDIA_API_KEY` (and optionally `DATABASE_PATH`) in your host's
environment-variable settings.

> **Note on the database:** `node:sqlite` is a built-in module that requires
> **Node ≥ 22.5** and writes to the local filesystem. Most serverless platforms
> (e.g. Vercel) don't provide a persistent writable disk, so for a hosted
> deployment you'll want either a host with a persistent volume
> (Railway, Fly.io, a VM) or to swap `src/lib/db.ts` for a networked database
> (PostgreSQL via `pg`, MySQL via `mysql2`, etc.). The API routes don't need to
> change — only the `db.ts` implementation.

### Docker example

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Security notes

- `.env` and the `*.db` files are gitignored — secrets and your task data never get committed.
- The NVIDIA API key is only ever read server-side in API routes; it is never bundled into client JavaScript.
