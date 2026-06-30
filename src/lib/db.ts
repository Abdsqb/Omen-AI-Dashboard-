/**
 * Database layer — Node.js 22+ built-in SQLite (node:sqlite).
 * Requires Node >= 22.5.0. No external dependencies.
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Task {
  id: number
  name: string
  status: string        // 'todo' | 'doing' | 'done'
  deadline: string | null
  priority: string | null  // 'low' | 'medium' | 'high'
  description: string | null
  createdAt: string
  updatedAt: string
}

// ─── Connection singleton ─────────────────────────────────────────────────────

// DATABASE_PATH env var overrides the default project-root location.
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'omen.db')

// Ensure the containing directory exists (important if DATABASE_PATH points elsewhere).
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Attach to global to survive Next.js hot-reloads in dev mode.
const g = globalThis as typeof globalThis & { __omenDb?: DatabaseSync }

function getDb(): DatabaseSync {
  if (!g.__omenDb) {
    g.__omenDb = new DatabaseSync(DB_PATH)
    migrate(g.__omenDb)
  }
  return g.__omenDb
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'todo',
      deadline    TEXT,
      priority    TEXT             DEFAULT 'medium',
      description TEXT,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getAllTasks(): Task[] {
  return getDb()
    .prepare('SELECT * FROM tasks ORDER BY createdAt ASC')
    .all() as unknown as Task[]
}

export function getTaskById(id: number): Task | null {
  const row = getDb()
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(id)
  return row ? (row as unknown as Task) : null
}

export function findTaskByName(name: string): Task | null {
  const row = getDb()
    .prepare('SELECT * FROM tasks WHERE LOWER(name) = LOWER(?)')
    .get(name)
  return row ? (row as unknown as Task) : null
}

// ─── Tolerant task resolution ───────────────────────────────────────────────
// The AI references tasks by name, but its name can differ slightly from the
// board (casing, spacing, a partial phrase, or a small typo). resolveTask finds
// the intended task through progressively looser tiers, and — crucially —
// refuses to guess when a loose match is ambiguous, returning the candidates so
// the caller can ask the user to clarify instead of acting on the wrong task.

/** Lowercase, trim, and collapse internal whitespace for tolerant comparison. */
function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Levenshtein edit distance — inputs are short task names, so this is cheap. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

export interface TaskMatch {
  task: Task | null      // the resolved task, if a confident single match was found
  ambiguous: boolean     // true when the name matched multiple tasks
  candidates: Task[]     // the competing tasks, when ambiguous
}

export function resolveTask(name: string): TaskMatch {
  const none: TaskMatch = { task: null, ambiguous: false, candidates: [] }
  const all = getAllTasks()
  if (!name || all.length === 0) return none

  const target = normalizeName(name)
  const pick = (hits: Task[]): TaskMatch | null => {
    if (hits.length === 1) return { task: hits[0], ambiguous: false, candidates: [] }
    if (hits.length > 1) return { task: null, ambiguous: true, candidates: hits }
    return null
  }

  // Tier 1 — exact match after normalization (casing/whitespace).
  const exact = pick(all.filter(t => normalizeName(t.name) === target))
  if (exact) return exact

  // Tier 2 — containment in either direction (e.g. "landing page" → "Launch landing page").
  const contains = pick(
    all.filter(t => {
      const n = normalizeName(t.name)
      return n.includes(target) || target.includes(n)
    })
  )
  if (contains) return contains

  // Tier 3 — closest by edit distance, but only when it's clearly close AND
  // clearly the single best (the runner-up must be at least one edit further).
  const scored = all
    .map(t => ({ t, d: editDistance(normalizeName(t.name), target) }))
    .sort((a, b) => a.d - b.d)
  const best = scored[0]
  const longest = Math.max(target.length, normalizeName(best.t.name).length)
  const threshold = Math.max(2, Math.floor(longest * 0.25)) // tolerate ~25% typos
  if (best.d <= threshold) {
    const tiedForBest = scored.filter(s => s.d === best.d)
    if (tiedForBest.length === 1) return { task: best.t, ambiguous: false, candidates: [] }
    return { task: null, ambiguous: true, candidates: tiedForBest.map(s => s.t) }
  }

  return none
}

export function createTask(data: {
  name: string
  status?: string
  deadline?: string | null
  priority?: string | null
  description?: string | null
}): Task {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO tasks (name, status, deadline, priority, description)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      data.name,
      data.status ?? 'todo',
      data.deadline ?? null,
      data.priority ?? 'medium',
      data.description ?? null
    )
  return getTaskById(Number(result.lastInsertRowid))!
}

export function updateTask(
  id: number,
  data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Task | null {
  const db = getDb()
  const fields: string[] = []
  const values: (string | null | number)[] = []

  if (data.name        !== undefined) { fields.push('name = ?');        values.push(data.name) }
  if (data.status      !== undefined) { fields.push('status = ?');      values.push(data.status) }
  if (data.deadline    !== undefined) { fields.push('deadline = ?');    values.push(data.deadline) }
  if (data.priority    !== undefined) { fields.push('priority = ?');    values.push(data.priority) }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }

  if (fields.length === 0) return getTaskById(id)

  fields.push("updatedAt = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getTaskById(id)
}

export function deleteTask(id: number): boolean {
  const result = getDb()
    .prepare('DELETE FROM tasks WHERE id = ?')
    .run(id)
  return result.changes > 0
}

export function deleteDoneTasks(): number {
  return getDb()
    .prepare("DELETE FROM tasks WHERE status = 'done'")
    .run().changes
}
