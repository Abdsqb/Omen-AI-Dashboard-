'use client'

import { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react'

interface ChatInputProps {
  input: string
  onChange: (value: string) => void
  onSend: () => void
}

export default function ChatInput({ input, onChange, onSend }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)
  const movingTimer = useRef<NodeJS.Timeout | null>(null)

  const [caretX, setCaretX] = useState(0)
  const [focused, setFocused] = useState(false)
  const [moving, setMoving] = useState(false)

  // Position the custom caret by measuring the text up to the cursor. A solid
  // "moving" window suppresses the blink right after a keystroke (like VS Code).
  const updateCaret = useCallback(() => {
    const el = inputRef.current
    const mirror = mirrorRef.current
    if (!el || !mirror) return
    const pos = el.selectionStart ?? el.value.length
    mirror.textContent = el.value.slice(0, pos)
    setCaretX(mirror.offsetWidth - el.scrollLeft)

    setMoving(true)
    if (movingTimer.current) clearTimeout(movingTimer.current)
    movingTimer.current = setTimeout(() => setMoving(false), 650)
  }, [])

  // Recompute whenever the controlled value changes.
  useLayoutEffect(() => { updateCaret() }, [input, updateCaret])

  // Start typing anywhere → focus the input so the keystroke lands there,
  // no click required. Only for plain printable keys (ignore shortcuts and
  // navigation/function keys), and only when not already typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = inputRef.current
      if (!el || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length !== 1) return // printable single character only
      const active = document.activeElement
      if (active === el) return
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      el.focus()
      // The browser routes this same keystroke into the now-focused input.
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
      return
    }
    // Caret/arrow movement updates after the browser applies it.
    requestAnimationFrame(updateCaret)
  }

  return (
    <div className="input-zone">
      <div className="cinput-wrap">
        <textarea
          ref={inputRef}
          className="cinput"
          placeholder="Speak to OMEN…"
          rows={1}
          wrap="off"
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCaret}
          onClick={updateCaret}
          onSelect={updateCaret}
          onScroll={updateCaret}
          onFocus={() => { setFocused(true); updateCaret() }}
          onBlur={() => setFocused(false)}
        />
        <span ref={mirrorRef} className="cinput-mirror" aria-hidden="true" />
        <span
          className={`cinput-caret${focused ? ' on' : ''}${moving ? ' moving' : ''}`}
          style={{ transform: `translateX(${caretX}px)` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
