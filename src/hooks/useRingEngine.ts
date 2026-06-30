import { useEffect, useRef } from 'react'
import { AgentState } from '@/types'

export function useRingEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  agentState: AgentState,
  pulse: number = 0,
  pulseStrength: number = 1
) {
  const stateRef = useRef(agentState)
  useEffect(() => { stateRef.current = agentState }, [agentState])

  // A counter that increments on each pulse trigger; the loop watches it and
  // fires a one-shot pulse when it changes. `pulseStrength` (0..1) scales how
  // strong that pulse is — full for opening, barely-there for closing.
  const pulseRef = useRef(pulse)
  const strengthRef = useRef(pulseStrength)
  useEffect(() => { pulseRef.current = pulse }, [pulse])
  useEffect(() => { strengthRef.current = pulseStrength }, [pulseStrength])

  useEffect(() => {
    const RC = canvasRef.current
    if (!RC) return
    const rctx = RC.getContext('2d')!
    const W = 700, H = 700, CX = 350, CY = 350
    const RING_R = 248

    // Guard against stacked animation loops. Dev Fast Refresh (frequent here
    // because the project lives in a OneDrive folder) can leave a previous loop
    // running; each extra loop redraws the canvas every frame with a drifting
    // phase, so the ring appears to speed up and CPU climbs over time.
    //
    // Two mechanisms: (1) cancel the tracked rAF id, and (2) a "generation" token
    // — each new loop claims the next generation, and every frame checks it's
    // still current; any older loop (even one this guard never tracked) sees a
    // newer generation and terminates itself on its next frame.
    const win = window as typeof window & {
      __omenRingRAF?: number
      __omenRingGen?: number
    }
    if (win.__omenRingRAF != null) cancelAnimationFrame(win.__omenRingRAF)
    const myGen = win.__omenRingGen = (win.__omenRingGen ?? 0) + 1

    let T = 0, breathT = 0, thinkT = 0, speakT = 0, listenT = 0
    let hot1 = Math.PI * 1.5
    let hot2 = Math.PI * 0.5
    let flashAlpha = 0
    let pulseEnergy = 0
    let lastPulseSeen = pulseRef.current
    let prevState = 'idle'
    let lastTime: number | null = null

    // When the tab is backgrounded the browser pauses RAF; reset the clock on
    // return so the first frame back is a normal step, not a stale delta.
    const onVisibility = () => { if (!document.hidden) lastTime = null }
    document.addEventListener('visibilitychange', onVisibility)

    let cur = {
      bright: 0.72, hot1Speed: 0.004, hot2Speed: -0.003,
      wideScale: 0.95, coreScale: 1.1, flowSpeed: 0.6,
      thinkW: 0.0, speakW: 0.0, listenW: 0.0,
    }

    function drawRingFrame(timestamp: number) {
      // A newer loop has taken over — stop this one (don't reschedule).
      if (myGen !== win.__omenRingGen) return

      // Delta time in seconds, capped at 50ms to prevent tab-switch jumps
      if (lastTime === null) lastTime = timestamp
      const raw = (timestamp - lastTime) / 1000
      const dt = Math.min(raw, 0.05)
      lastTime = timestamp

      // Scale all time accumulators by dt instead of fixed increments
      const BASE = 60 // target fps normaliser
      T        += 0.009  * dt * BASE
      breathT  += 0.015  * dt * BASE
      thinkT   += 0.052  * dt * BASE
      speakT   += 0.062  * dt * BASE
      listenT  += 0.068  * dt * BASE

      rctx.clearRect(0, 0, W, H)
      flashAlpha = Math.max(0, flashAlpha - 0.018 * dt * BASE)
      pulseEnergy = Math.max(0, pulseEnergy - 0.045 * dt * BASE)

      const s = stateRef.current
      if (s !== prevState) { flashAlpha = 1.0; prevState = s }

      // Ring pulse: a one-shot swell + flash when the trigger counter changes,
      // scaled by the requested strength (full on open, very slight on close).
      if (pulseRef.current !== lastPulseSeen) {
        lastPulseSeen = pulseRef.current
        pulseEnergy = strengthRef.current
        flashAlpha = strengthRef.current
      }
      // Eased so the swell pops quickly then settles.
      const pulse = pulseEnergy * pulseEnergy

      let tgt = {
        bright: 1.0, hot1Speed: 0.005, hot2Speed: -0.004,
        wideScale: 1.1, coreScale: 1.1, flowSpeed: 1.0,
        thinkW: 0.0, speakW: 0.0, listenW: 0.0,
      }

      if (s === 'idle') {
        tgt.bright = 0.70 + Math.sin(breathT) * 0.20
        tgt.hot1Speed = 0.0028; tgt.hot2Speed = -0.0018
        tgt.wideScale = 0.88; tgt.coreScale = 1.0; tgt.flowSpeed = 0.58
      } else if (s === 'listening') {
        tgt.bright = 0.92 + Math.sin(listenT * 2.7) * 0.24
        tgt.hot1Speed = 0.015; tgt.hot2Speed = -0.010
        tgt.wideScale = 1.22; tgt.coreScale = 1.2; tgt.flowSpeed = 1.45; tgt.listenW = 1.0
      } else if (s === 'thinking') {
        tgt.bright = 0.80 + Math.sin(thinkT * 1.7) * 0.16
        tgt.hot1Speed = 0.038; tgt.hot2Speed = -0.026
        tgt.wideScale = 1.05; tgt.coreScale = 0.88; tgt.flowSpeed = 2.1; tgt.thinkW = 1.0
      } else if (s === 'speaking') {
        tgt.bright = 1.0 + Math.sin(speakT * 3.4) * 0.30
        tgt.hot1Speed = 0.022; tgt.hot2Speed = -0.016
        tgt.wideScale = 1.42; tgt.coreScale = 1.28; tgt.flowSpeed = 1.9; tgt.speakW = 1.0
      }

      const L = 1 - Math.pow(1 - 0.055, dt * BASE)
      for (const k in cur) {
        (cur as Record<string, number>)[k] += (tgt[k as keyof typeof tgt] - (cur as Record<string, number>)[k]) * L
      }

      // The ring rotates at a fixed, calm speed. State changes (idle/listening/
      // thinking/speaking) still drive brightness, size, and the intensity boosts
      // via the lerp above — but NOT the rotation speed. Holding flowSpeed
      // constant also sidesteps an artifact where changing it mid-animation
      // jolted the flow: the flow phase was computed as T × flowSpeed, and since
      // T grows without bound, any mid-run change scaled the whole elapsed time,
      // kicking the speed harder the longer the page had been open.
      cur.hot1Speed = 0.008
      cur.hot2Speed = -0.006
      cur.flowSpeed = 0.9

      hot1 += cur.hot1Speed * dt * BASE
      hot2 += cur.hot2Speed * dt * BASE

      const SAMPLES = 380
      for (let i = 0; i < SAMPLES; i++) {
        const angle = (i / SAMPLES) * Math.PI * 2
        const f1 = Math.sin(angle * 1.0 - T * cur.flowSpeed * 0.80) * 0.5 + 0.5
        const f2 = Math.sin(angle * 2.0 + T * cur.flowSpeed * 0.54) * 0.35 + 0.65
        const f3 = Math.sin(angle * 3.5 - T * cur.flowSpeed * 1.12) * 0.22 + 0.78
        const f4 = Math.sin(angle * 0.5 + T * cur.flowSpeed * 0.30) * 0.25 + 0.75
        const flowBase = f1 * f2 * f3 * f4
        const d1 = Math.abs(Math.atan2(Math.sin(angle - hot1), Math.cos(angle - hot1)))
        const hs1 = Math.pow(Math.max(0, 1 - d1 / 0.88), 5) * 4.2
        const d2 = Math.abs(Math.atan2(Math.sin(angle - hot2), Math.cos(angle - hot2)))
        const hs2 = Math.pow(Math.max(0, 1 - d2 / 0.75), 4) * 2.4
        const a1 = Math.abs(Math.atan2(Math.sin(angle - thinkT), Math.cos(angle - thinkT)))
        const a2 = Math.abs(Math.atan2(Math.sin(angle - thinkT - Math.PI), Math.cos(angle - thinkT - Math.PI)))
        const thinkBoost = (Math.pow(Math.max(0,1-a1/0.65),3)*2.2 + Math.pow(Math.max(0,1-a2/0.5),2.5)*1.5) * cur.thinkW
        const speakBoost = (
          (Math.sin(angle * 6 - speakT * 4.2) * 0.4 + 0.4) *
          (Math.sin(angle * 11 + speakT * 2.6) * 0.3 + 0.7) *
          (Math.sin(speakT * 1.9) * 0.5 + 0.5)
        ) * 1.3 * cur.speakW
        const listenBoost = Math.sin(angle * 3 - listenT * 1.3) * 0.3 * cur.listenW
        const shimmer = Math.sin(angle * 9.5 + T * 6.2) * 0.035
        const wobble = Math.sin(angle * 3.0 - T * cur.flowSpeed * 1.5) * 3.8
        const dynamicR = RING_R + wobble + pulse * 18
        const px = CX + dynamicR * Math.cos(angle)
        const py = CY + dynamicR * Math.sin(angle)
        const totalIntensity = flowBase * cur.bright + hs1 + hs2 * 0.7 + thinkBoost + speakBoost + listenBoost + shimmer + pulse * 0.55

        // Layer A: wide atmospheric bloom
        const wA = (totalIntensity + hs1 * 0.18 + hs2 * 0.1) * 0.016 * cur.wideScale
        const wR = (76 + Math.sin(angle * 3.7 + T * 0.38) * 9) * cur.wideScale
        if (wA > 0.001) {
          const g = rctx.createRadialGradient(px,py,0,px,py,wR)
          g.addColorStop(0, `rgba(115,42,225,${Math.min(.98,wA*3.8)})`)
          g.addColorStop(0.22,`rgba(98,30,205,${Math.min(.98,wA*2.2)})`)
          g.addColorStop(0.48,`rgba(78,16,172,${Math.min(.98,wA*1.0)})`)
          g.addColorStop(0.72,`rgba(56,8,142,${Math.min(.98,wA*0.38)})`)
          g.addColorStop(1, `rgba(38,0,100,0)`)
          rctx.fillStyle = g; rctx.beginPath(); rctx.arc(px,py,wR,0,Math.PI*2); rctx.fill()
        }

        // Layer B: mid violet body
        const mA = (totalIntensity + hs1*0.52 + hs2*0.32) * 0.030
        const mR = (38 + Math.sin(angle*5.2 - T*0.58)*5) * cur.wideScale
        if (mA > 0.002) {
          const g = rctx.createRadialGradient(px,py,0,px,py,mR)
          g.addColorStop(0,   `rgba(188,115,255,${Math.min(.98,mA*3.0)})`)
          g.addColorStop(0.28,`rgba(148,75,245,${Math.min(.98,mA*1.9)})`)
          g.addColorStop(0.58,`rgba(115,42,215,${Math.min(.98,mA*0.95)})`)
          g.addColorStop(1,   `rgba(82,22,182,0)`)
          rctx.fillStyle = g; rctx.beginPath(); rctx.arc(px,py,mR,0,Math.PI*2); rctx.fill()
        }

        // Layer C: tight bright filament
        const cA = (totalIntensity + hs1*1.9 + hs2*1.1) * 0.040 * cur.coreScale
        const cR = (14 + Math.sin(angle*7.2 + T*0.95)*2.2) * cur.coreScale
        if (cA > 0.003) {
          const g = rctx.createRadialGradient(px,py,0,px,py,cR)
          g.addColorStop(0,   `rgba(244,234,255,${Math.min(.98,cA*3.8)})`)
          g.addColorStop(0.20,`rgba(218,188,255,${Math.min(.98,cA*2.6)})`)
          g.addColorStop(0.50,`rgba(178,132,255,${Math.min(.98,cA*1.4)})`)
          g.addColorStop(0.80,`rgba(138,82,242,${Math.min(.98,cA*0.55)})`)
          g.addColorStop(1,   `rgba(100,32,200,0)`)
          rctx.fillStyle = g; rctx.beginPath(); rctx.arc(px,py,cR,0,Math.PI*2); rctx.fill()
        }

        // Layer D: ultra-hot pinpoint
        const heatI = (hs1 + hs2 * 0.65) * cur.bright
        if (heatI > 0.35) {
          const hR = 6 + heatI * 3.5
          const hA = heatI * 0.052
          const g = rctx.createRadialGradient(px,py,0,px,py,hR)
          g.addColorStop(0,   `rgba(255,254,255,${Math.min(.98,hA*5.5)})`)
          g.addColorStop(0.28,`rgba(242,222,255,${Math.min(.98,hA*3.2)})`)
          g.addColorStop(0.65,`rgba(205,165,255,${Math.min(.98,hA*1.4)})`)
          g.addColorStop(1,   `rgba(165,100,255,0)`)
          rctx.fillStyle = g; rctx.beginPath(); rctx.arc(px,py,hR,0,Math.PI*2); rctx.fill()
        }
      }

      // Flash burst
      if (flashAlpha > 0.01) {
        const fg = rctx.createRadialGradient(CX,CY,RING_R-28,CX,CY,RING_R+40)
        fg.addColorStop(0, `rgba(196,181,253,${flashAlpha*0.10})`)
        fg.addColorStop(0.5,`rgba(139,92,246,${flashAlpha*0.06})`)
        fg.addColorStop(1, `rgba(109,40,217,0)`)
        rctx.fillStyle = fg; rctx.fillRect(0,0,W,H)
      }

      // Outer fade mask
      const om = rctx.createRadialGradient(CX,CY,RING_R+90,CX,CY,RING_R+118)
      om.addColorStop(0,'rgba(0,0,0,0)'); om.addColorStop(1,'rgba(0,0,0,1)')
      rctx.fillStyle = om; rctx.fillRect(0,0,W,H)

      // Inner void
      const iv = rctx.createRadialGradient(CX,CY,RING_R-58,CX,CY,RING_R-20)
      iv.addColorStop(0,'rgba(0,0,0,1)'); iv.addColorStop(0.68,'rgba(0,0,0,1)'); iv.addColorStop(1,'rgba(0,0,0,0)')
      rctx.fillStyle = iv; rctx.beginPath(); rctx.arc(CX,CY,RING_R-20,0,Math.PI*2); rctx.fill()

      // Inner edge glow
      const ieg = rctx.createRadialGradient(CX,CY,RING_R-50,CX,CY,RING_R-24)
      ieg.addColorStop(0,'rgba(0,0,0,0)'); ieg.addColorStop(0.5,'rgba(50,8,110,.05)'); ieg.addColorStop(1,'rgba(90,18,180,.10)')
      rctx.fillStyle = ieg; rctx.beginPath(); rctx.arc(CX,CY,RING_R-24,0,Math.PI*2); rctx.fill()

      win.__omenRingRAF = requestAnimationFrame(drawRingFrame)
    }

    win.__omenRingRAF = requestAnimationFrame(drawRingFrame)
    return () => {
      if (win.__omenRingRAF != null) cancelAnimationFrame(win.__omenRingRAF)
      win.__omenRingRAF = undefined
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}