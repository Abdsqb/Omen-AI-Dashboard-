export interface Task {
  id: number
  name: string
  status: 'todo' | 'doing' | 'done'
  deadline: string | null
  priority: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface Message {
  role: 'user' | 'omen'
  content: string
  time: string
}

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking'
