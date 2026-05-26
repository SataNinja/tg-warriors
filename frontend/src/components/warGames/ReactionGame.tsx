/**
 * ⚡ Реакция — нажми кнопку как только появится зелёный сигнал.
 * 5 раундов. Score = max(0, 5000 - avg_ms)
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface Props { onFinish: (score: number) => void }

type Phase = 'intro' | 'waiting' | 'ready' | 'result' | 'done'

const ROUNDS = 5
const MIN_DELAY = 1200
const MAX_DELAY = 4000

export function ReactionGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const [reactionMs, setReactionMs] = useState(0)
  const [tooEarly, setTooEarly] = useState(false)
  const readyAt = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const startRound = useCallback(() => {
    setTooEarly(false)
    setPhase('waiting')
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
    timerRef.current = setTimeout(() => {
      readyAt.current = performance.now()
      setPhase('ready')
    }, delay)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleTap = () => {
    if (phase === 'intro') { setRound(1); startRound(); return }
    if (phase === 'waiting') {
      clearTimeout(timerRef.current)
      setTooEarly(true)
      setPhase('result')
      return
    }
    if (phase === 'ready') {
      const ms = Math.round(performance.now() - readyAt.current)
      setReactionMs(ms)
      const newTimes = [...times, ms]
      setTimes(newTimes)
      setPhase('result')
      return
    }
    if (phase === 'result') {
      const nextRound = round + 1
      if (nextRound > ROUNDS) {
        setPhase('done')
        const validTimes = times.filter((_, i) => i < ROUNDS)
        const avg = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 3000
        const score = Math.max(0, Math.round(5000 - avg))
        setTimeout(() => onFinish(score), 1000)
      } else {
        setRound(nextRound)
        startRound()
      }
    }
  }

  const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0

  return (
    <div onClick={handleTap} style={{
      minHeight: 340, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 16, cursor: 'pointer', userSelect: 'none',
      transition: 'background 0.2s',
      background: phase === 'ready' ? 'rgba(34,197,94,0.25)'
        : phase === 'waiting' ? 'rgba(239,68,68,0.15)'
        : 'rgba(255,255,255,0.04)',
    }}>
      {phase === 'intro' && (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Реакция</div>
          <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
            5 раундов. Нажми как только появится зелёный экран.<br/>Не нажимай раньше времени!
          </div>
          <div style={btnStyle('#3b82f6')}>Начать</div>
        </>
      )}

      {phase === 'waiting' && (
        <>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🔴</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171' }}>Жди...</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Раунд {round}/{ROUNDS}</div>
        </>
      )}

      {phase === 'ready' && (
        <>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🟢</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>ТАП!</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Раунд {round}/{ROUNDS}</div>
        </>
      )}

      {phase === 'result' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 10 }}>
            {tooEarly ? '❌' : '✅'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {tooEarly ? 'Слишком рано!' : `${reactionMs} мс`}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
            Раунд {round}/{ROUNDS} · Среднее: {avg} мс
          </div>
          <div style={btnStyle('#6366f1')}>
            {round >= ROUNDS ? 'Финиш' : `Следующий раунд →`}
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🏁</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Среднее: {avg} мс</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>Результат отправляется...</div>
        </>
      )}
    </div>
  )
}

function btnStyle(color: string) {
  return {
    background: `${color}30`, border: `1px solid ${color}80`,
    borderRadius: 10, padding: '10px 28px',
    color: '#fff', fontSize: 14, fontWeight: 700,
  } as React.CSSProperties
}
