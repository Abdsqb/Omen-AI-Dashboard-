'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Task, Message, AgentState } from '@/types'
import { nowTime } from '@/utils/helpers'
import Dashboard from '@/components/Dashboard'
import RingCanvas from '@/components/RingCanvas'
import ResponsePanel from '@/components/ResponsePanel'
import ChatInput from '@/components/ChatInput'

export default function OmenApp() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const [yearPct, setYearPct] = useState('0%')
  const [yearDays, setYearDays] = useState('')
  const [yearWidth, setYearWidth] = useState('0%')
  const [isTyping, setIsTyping] = useState(false)

  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load tasks on mount
  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  // Year progress bar
  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    const pct = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())
    const days = Math.ceil((end.getTime() - now.getTime()) / 86400000)
    setYearPct(Math.round(pct * 100) + '%')
    setYearDays(days + 'd left')
    setTimeout(() => setYearWidth((pct * 100) + '%'), 120)
  }, [])

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text, time: nowTime() }
    setMessages(prev => [...prev, userMsg])
    historyRef.current.push({ role: 'user', content: text })

    setAgentState('thinking')
    setIsTyping(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyRef.current }),
      })

      setIsTyping(false)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, { role: 'omen', content: `⚠️ ${err?.error || 'API error ' + res.status}`, time: nowTime() }])
        setAgentState('idle')
        historyRef.current.pop()
        return
      }

      const data = await res.json()
      const { reply, actionResult, tasks: updatedTasks } = data

      if (updatedTasks) setTasks(updatedTasks)
      if (actionResult) showToast('⚡ ' + actionResult)

      if (reply) {
        setAgentState('speaking')
        setMessages(prev => [...prev, { role: 'omen', content: reply, time: nowTime() }])
        historyRef.current.push({ role: 'assistant', content: reply })
        if (historyRef.current.length > 30) historyRef.current = historyRef.current.slice(-30)
        setTimeout(() => setAgentState('idle'), 4000)
      } else {
        setAgentState('idle')
      }
    } catch (e: unknown) {
      setIsTyping(false)
      const msg = e instanceof Error ? e.message : 'Network error'
      setMessages(prev => [...prev, { role: 'omen', content: `⚠️ Network error: ${msg}`, time: nowTime() }])
      setAgentState('idle')
      historyRef.current.pop()
    }
  }, [input, showToast])

  const handleInputChange = (value: string) => {
    setInput(value)
    setAgentState(value.trim() ? 'listening' : 'idle')
  }

  return (
    <>
      <div className="glow-orb top-left" />
      <div className="glow-orb mid-right" />

      <div className="app">
        {/* ── LEFT DASHBOARD ── */}
        <Dashboard
          tasks={tasks}
          yearPct={yearPct}
          yearDays={yearDays}
          yearWidth={yearWidth}
        />

        {/* ── CENTER STAGE ── */}
        <div className="stage">
          <div className="stage-ambient" />
          <RingCanvas agentState={agentState} />

          {/* ── FLOATING RESPONSE PANEL ── */}
          <ResponsePanel
            messages={messages}
            isTyping={isTyping}
            toast={toast}
          />
        </div>

        {/* right col spacer */}
        <div className="output-spacer" />

        {/* ── INPUT ── */}
        <ChatInput
          input={input}
          onChange={handleInputChange}
          onSend={send}
        />

        <div className="dash-bot" />
        <div className="out-bot" />
      </div>
    </>
  )
}
