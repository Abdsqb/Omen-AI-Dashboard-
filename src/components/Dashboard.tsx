'use client'

import { useEffect, useRef } from 'react'
import { Task } from '@/types'
import { drawSpark } from '@/utils/sparkline'
import { priorityLabel } from '@/utils/helpers'

interface DashboardProps {
  tasks: Task[]
  yearPct: string
  yearDays: string
  yearWidth: string
}

const GROUPS: { key: Task['status']; label: string; cls: string }[] = [
  { key: 'todo',  label: 'To do',       cls: 'todo'  },
  { key: 'doing', label: 'In progress', cls: 'doing' },
  { key: 'done',  label: 'Done',        cls: 'done'  },
]

export default function Dashboard({ tasks, yearPct, yearDays, yearWidth }: DashboardProps) {
  const sparkCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = sparkCanvasRef.current
    if (canvas) setTimeout(() => drawSpark(canvas, tasks), 60)
  }, [tasks])

  return (
    <div className="dash">
      {/* Completion card */}
      <div className="dash-card top">
        <div className="dlabel">Completion</div>
        <div className="spark-wrap">
          <canvas ref={sparkCanvasRef} />
        </div>
        <div className="ybar-row">
          <span className="ybar-pct">{yearPct}</span>
          <span className="ybar-days">{yearDays}</span>
        </div>
        <div className="ybar-track">
          <div className="ybar-fill" style={{ width: yearWidth }} />
        </div>
      </div>

      {/* Task list card */}
      <div className="dash-card bottom">
        <div className="task-scroll">
          {GROUPS.map(g => {
            const items = tasks.filter(t => t.status === g.key)
            return (
              <div key={g.key} className="tgroup">
                <div className={`tgroup-head ${g.cls}`}>
                  <span className="tdot" />
                  {g.label}
                </div>
                {items.length > 0 ? items.map(t => (
                  <div key={t.id} className={`titem${g.key === 'done' ? ' tdone' : ''}`}>
                    {t.name}
                    {g.key !== 'done' && (t.deadline || t.priority) && (
                      <div className="titem-meta">
                        {priorityLabel(t.priority) && (
                          <span className={`titem-badge priority-${t.priority}`}>
                            {t.priority}
                          </span>
                        )}
                        {t.deadline && (
                          <span className="titem-badge deadline">
                            {t.deadline}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="tempty">—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
