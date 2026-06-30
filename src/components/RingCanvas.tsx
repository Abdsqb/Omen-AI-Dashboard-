'use client'

import { useRef } from 'react'
import { AgentState } from '@/types'
import { useRingEngine } from '@/hooks/useRingEngine'

interface RingCanvasProps {
  agentState: AgentState
  pulse?: number
  pulseStrength?: number
}

export default function RingCanvas({ agentState, pulse = 0, pulseStrength = 1 }: RingCanvasProps) {
  const ringCanvasRef = useRef<HTMLCanvasElement>(null)
  useRingEngine(ringCanvasRef, agentState, pulse, pulseStrength)

  return (
    <div className="ring-wrap">
      <canvas id="ringCanvas" ref={ringCanvasRef} width={700} height={700} />
    </div>
  )
}
