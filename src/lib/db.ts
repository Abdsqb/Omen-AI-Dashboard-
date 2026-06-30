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
