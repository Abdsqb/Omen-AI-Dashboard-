'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/types'
import { md } from '@/utils/helpers'

interface ResponsePanelProps {
  messages: Message[]
  isTyping: boolean
  toast: string | null
}

export default function ResponsePanel({ messages, isTyping, toast }: ResponsePanelProps) {
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages, isTyping])

  return (
    <div className="output-float">
      <div className="output-card">
        <div className="out-head">
          <div className="out-label">Response</div>
        </div>

        <div className="out-msgs" ref={msgsRef}>
          {messages.length === 0 && !isTyping && (
            <div className="out-empty">
              <div className="out-empty-ring" />
              awaiting input
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'omen' ? (
              <div key={i} className="msg omen">
                <div className="msg-role">O·M·E·N</div>
                <div
                  className="msg-body"
                  dangerouslySetInnerHTML={{ __html: md(msg.content) }}
                />
                <div className="msg-time">{msg.time}</div>
              </div>
            ) : null
          )}

          {isTyping && (
            <div className="msg omen">
              <div className="msg-role">O·M·E·N</div>
              <div className="typing">
                <span className="tdot-a" />
                <span className="tdot-a" />
                <span className="tdot-a" />
              </div>
            </div>
          )}
        </div>

        {toast && <div className="toast on">{toast}</div>}
      </div>
    </div>
  )
}
