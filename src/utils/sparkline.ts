import { Task } from '@/types'

export function drawSpark(canvas: HTMLCanvasElement, tasks: Task[]) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.offsetWidth * dpr
  canvas.height = canvas.offsetHeight * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const W = canvas.offsetWidth, H = canvas.offsetHeight
  const done = tasks.filter(t => t.status === 'done').length
  const data = [0, 0, 0, 0, 0, 0, done]
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * (W - 6) + 3, y: H - 5 - (v / max) * (H - 13) }))
  const fill = ctx.createLinearGradient(0, 0, 0, H)
  fill.addColorStop(0, 'rgba(139,92,246,.30)')
  fill.addColorStop(0.6, 'rgba(109,40,217,.06)')
  fill.addColorStop(1, 'rgba(109,40,217,0)')
  ctx.beginPath(); ctx.moveTo(pts[0].x, H)
  pts.forEach(p => ctx.lineTo(p.x, p.y))
  ctx.lineTo(pts[pts.length - 1].x, H); ctx.closePath()
  ctx.fillStyle = fill; ctx.fill()
  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(139,92,246,.9)'; ctx.shadowBlur = 7
  ctx.stroke(); ctx.shadowBlur = 0
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#c4b5fd'
    ctx.shadowColor = 'rgba(196,181,253,1)'; ctx.shadowBlur = 5
    ctx.fill(); ctx.shadowBlur = 0
  })
}
