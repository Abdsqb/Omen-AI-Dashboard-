'use client'

import { useRef } from 'react'

interface ChatInputProps {
  input: string
  onChange: (value: string) => void
  onSend: () => void
}

export default function ChatInput({ input, onChange, onSend }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="input-zone">
      <textarea
        ref={inputRef}
        className="cinput"
        placeholder="Speak to OMEN…"
        rows={1}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
