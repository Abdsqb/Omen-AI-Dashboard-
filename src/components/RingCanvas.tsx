'use client'

import { useRef } from 'react'
import { AgentState } from '@/types'
import { useRingEngine } from '@/hooks/useRingEngine'

interface RingCanvasProps {
  agentState: AgentState
}

export default function RingCanvas({ agentState }: RingCanvasProps) {
  const ringCanvasRef = useRef<HTMLCanvasElement>(null)
  useRingEngine(ringCanvasRef, agentState)

  return (
    <div className="ring-wrap">
      <canvas id="ringCanvas" ref={ringCanvasRef} width={700} height={700} />
    </div>
  )
}
