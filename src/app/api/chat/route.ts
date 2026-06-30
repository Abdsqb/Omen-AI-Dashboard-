import { NextRequest, NextResponse } from 'next/server'
import {
  getAllTasks,
  createTask,
  findTaskByName,
  updateTask,
  deleteTask,
  deleteDoneTasks,
  Task,
} from '@/lib/db'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'
const MODEL = "meta/llama-4-maverick-17b-128e-instruct"

const SYS = `You are OMEN, a sharp and characterful AI assistant embedded in a personal command dashboard. You have personality — be engaging, direct, and confident.

Your critical responsibility is PERFECT task management. Before executing any task action, you must internally verify:
1. What exactly did the user ask for?
2. Does the task name I'm using EXACTLY match what's on the board?
3. Am I performing the RIGHT action (create/update/delete)?

TASK RULES — follow these without exception:
- NEVER invent, assume, or guess a task name. Use only names visible on the current board.
- NEVER create a task that already exists. Check the board first.
- NEVER delete or update a task unless its exact name is on the board.
- When updating status, confirm the task exists before acting.
- If the user is vague (e.g. "that task" or "the last one"), ask for clarification instead of guessing.
- Only emit ONE <action> block per reply. Never chain multiple actions in one response.

ACTIONS — wrap in <action></action>:
  <action>{"a":"create","name":"task name","status":"todo","deadline":"YYYY-MM-DD or null","priority":"low|medium|high","description":"optional text or null"}</action>
  <action>{"a":"delete","name":"exact task name"}</action>
  <action>{"a":"update","name":"exact task name","status":"todo|doing|done"}</action>
  <action>{"a":"update","name":"exact task name","deadline":"YYYY-MM-DD","priority":"low|medium|high","description":"text"}</action>
  <action>{"a":"clear_done"}</action>

- Priority defaults to "medium" if not specified.
- Deadline and description are optional (use null to clear them).
- If you cannot confidently execute the request, say so and ask the user to clarify.`



function boardCtx(tasks: Task[]) {
  const now = new Date().toISOString().split('T')[0]
  const todo  = tasks.filter(t => t.status === 'todo')
  const doing = tasks.filter(t => t.status === 'doing')
  const done  = tasks.filter(t => t.status === 'done')
  const fmt = (t: Task) =>
    `"${t.name}"` +
    (t.deadline    ? ' due:' + t.deadline : '') +
    (t.priority && t.priority !== 'medium' ? ' [' + t.priority + ']' : '') +
    (t.description ? ' desc:"' + t.description + '"' : '')
  return (
    `Date:${now} | Todo:${todo.length} Doing:${doing.length} Done:${done.length}\n` +
    `Todo: ${todo.map(fmt).join(', ')  || 'none'}\n` +
    `Doing: ${doing.map(fmt).join(', ') || 'none'}\n` +
    `Done: ${done.map(t => `"${t.name}"`).join(', ') || 'none'}`
  )
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const tasks = getAllTasks()
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NVIDIA_API_KEY not set in .env' },
        { status: 500 }
      )
    }

    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: SYS + '\n\nCurrent board:\n' + boardCtx(tasks),
          },
          ...messages,
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 1024,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stream: false,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg =
        (err as { message?: string })?.message ||
        (err as { error?: { message?: string } })?.error?.message ||
        `NVIDIA API error ${res.status}`
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const data = await res.json()
    const message = data.choices?.[0]?.message ?? {}
    const reply: string = message.content || '(no response)'

    const actionMatch = reply.match(/<action>([\s\S]*?)<\/action>/)
    let actionResult: string | null = null

    if (actionMatch) {
      try {
        const act = JSON.parse(actionMatch[1].trim())

        if (act.a === 'create') {
          const exists = findTaskByName(act.name)
          if (!exists) {
            createTask({
              name: act.name,
              status: act.status || 'todo',
              deadline: act.deadline || null,
              priority: act.priority || 'medium',
              description: act.description || null,
            })
            actionResult = `Created "${act.name}"`
          } else {
            actionResult = `"${act.name}" already exists`
          }
        } else if (act.a === 'delete') {
          const task = findTaskByName(act.name)
          if (task) {
            deleteTask(task.id)
            actionResult = `Deleted "${act.name}"`
          } else {
            actionResult = `Not found: "${act.name}"`
          }
        } else if (act.a === 'update') {
          const task = findTaskByName(act.name)
          if (task) {
            const updateData: Record<string, unknown> = {}
            if (act.status      !== undefined) updateData.status      = act.status
            if (act.deadline    !== undefined) updateData.deadline    = act.deadline
            if (act.priority    !== undefined) updateData.priority    = act.priority
            if (act.description !== undefined) updateData.description = act.description
            updateTask(task.id, updateData)
            actionResult = `Updated "${task.name}"`
          } else {
            actionResult = `Not found: "${act.name}"`
          }
        } else if (act.a === 'clear_done') {
          const count = deleteDoneTasks()
          actionResult = `Cleared ${count} task(s)`
        }
      } catch {
        // Malformed JSON in action block — skip silently
      }
    }

    const cleanReply = reply.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
    const updatedTasks = getAllTasks()

    return NextResponse.json({
      reply: cleanReply,
      actionResult,
      tasks: updatedTasks,
    })
  } catch (error) {
    console.error('POST /api/chat error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}