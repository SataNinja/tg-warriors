/**
 * 🎯 Меткость — нажми на движущуюся мишень 10 раз.
 * Каждая мишень держится 1.8 сек. Score = попадания × 500 (макс 5000)
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface Props { onFinish: (score: number) => void }

const TOTAL = 10
const VISIBLE_MS = 1800
const TARGET_SIZE = 62

interface Target { x: number; y: number; id: number }

export function AimGame({ onFinish }: Props) {
  const [started, setStarted] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [done, setDone] = useState(false)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const countRef = useRef(0)
  const hitsRef = useRef(0)

  const spawnTarget = useCallback(() => {
    if (countRef.current >= TOTAL) return
    const area = areaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const maxX = rect.width - TARGET_SIZE
    const maxY = rect.height - TARGET_SIZE
    setTarget({
      x: Math.max(0, Math.floor(Math.random() * maxX)),
      y: Math.max(0, Math.floor(Math.random() * maxY)),
      id: countRef.current,
    })
    timerRef.current = setTimeout(() => {
      // Пропущена мишень
      countRef.current++
      setTarget(null)
      setFlash('miss')
      setTimeout(() => setFlash(null), 300)
      if (countRef.current >= TOTAL) {
        setDone(true)
        setTimeout(() => onFinish(hitsRef.current * 500), 800)
      } else {
        setTimeout(spawnTarget, 400)
      }
    }, VISIBLE_MS)
  }, [onFinish])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleHit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (!target) return
    clearTimeout(timerRef.current)
    countRef.current++
    hitsRef.current++
    setHits(h => h + 1)
    setTarget(null)
    setFlash('hit')
    setTimeout(() => setFlash(null), 250)
    if (countRef.current >= TOTAL) {
      setDone(true)
      setTimeout(() => onFinish(hitsRef.current * 500), 800)
    } else {
      setTimeout(spawnTarget, 350)
    }
  }

  if (!started) return (
    <div style={centerCol}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🎯</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Меткость</div>
      <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
        {TOTAL} мишеней появятся по одной.<br/>
        Нажми на каждую до того, как она исчезнет.<br/>
        Максимальный счёт: {TOTAL * 500} очков.
      </div>
      <button
        onClick={() => { setStarted(true); setTimeout(spawnTarget, 600) }}
        style={btn('#3b82f6')}
      >Начать</button>
    </div>
  )

  if (done) return (
    <div style={centerCol}>
      <div style={{ fontSize: 48 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
        Попаданий: {hits}/{TOTAL}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>Результат отправляется...</div>
    </div>
  )

  const progress = countRef.current
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>🎯 {progress}/{TOTAL}</div>
        <div style={{ fontSize: 13, color: '#22c55e' }}>✅ {hits} попаданий</div>
      </div>

      <div
        ref={areaRef}
        style={{
          position: 'relative', height: 260,
          background: flash === 'hit' ? 'rgba(34,197,94,0.15)'
            : flash === 'miss' ? 'rgba(239,68,68,0.12)'
            : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, overflow: 'hidden',
          transition: 'background 0.15s',
          cursor: 'crosshair',
        }}
      >
        {!target && !flash && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            fontSize: 13, opacity: 0.3,
          }}>Жди мишень...</div>
        )}

        {target && (
          <div
            onClick={handleHit}
            onTouchStart={handleHit}
            style={{
              position: 'absolute',
              left: target.x, top: target.y,
              width: TARGET_SIZE, height: TARGET_SIZE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              animation: 'popIn 0.2s ease-out',
            }}
          >
            <div style={{
              width: TARGET_SIZE, height: TARGET_SIZE,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(185,28,28,0.7) 60%, transparent 100%)',
              border: '3px solid rgba(255,255,255,0.8)',
              boxShadow: '0 0 16px rgba(239,68,68,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>🎯</div>
          </div>
        )}
      </div>

      {/* Прогресс-бар */}
      <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 6 }}>
        <div style={{
          width: `${(progress / TOTAL) * 100}%`,
          background: '#6366f1', borderRadius: 8, height: '100%',
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}

const centerCol: React.CSSProperties = {
  minHeight: 280, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
}
function btn(color: string): React.CSSProperties {
  return {
    display: 'block', width: '100%',
    background: `${color}30`, border: `1px solid ${color}80`,
    borderRadius: 10, padding: '11px 0',
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  }
}
