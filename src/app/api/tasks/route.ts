import { NextRequest, NextResponse } from 'next/server'
import { getAllTasks, createTask, deleteDoneTasks } from '@/lib/db'

export async function GET() {
  try {
    const tasks = getAllTasks()
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, status, deadline, priority, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 })
    }

    const task = createTask({
      name: name.trim(),
      status: status || 'todo',
      deadline: deadline || null,
      priority: priority || 'medium',
      description: description || null,
    })
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    if (status === 'done') {
      const count = deleteDoneTasks()
      return NextResponse.json({ deleted: count })
    }

    return NextResponse.json({ error: 'Invalid delete query' }, { status: 400 })
  } catch (error) {
    console.error('DELETE /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 })
  }
}
