/**
 * 🧮 Математика — реши 5 примеров за 45 секунд.
 * Score = правильные ответы × 1000
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface Props { onFinish: (score: number) => void }

const TOTAL_PROBLEMS = 5
const TIME_LIMIT = 45

type Op = '+' | '-' | '×'

function genProblem(difficulty: number): { a: number; b: number; op: Op; answer: number } {
  const ops: Op[] = difficulty < 2 ? ['+', '-'] : ['+', '-', '×']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number, answer: number
  if (op === '+') {
    a = 10 + Math.floor(Math.random() * (10 + difficulty * 15))
    b = 10 + Math.floor(Math.random() * (10 + difficulty * 15))
    answer = a + b
  } else if (op === '-') {
    a = 20 + Math.floor(Math.random() * (20 + difficulty * 15))
    b = Math.floor(Math.random() * a)
    answer = a - b
  } else {
    a = 2 + Math.floor(Math.random() * (6 + difficulty * 2))
    b = 2 + Math.floor(Math.random() * (6 + difficulty * 2))
    answer = a * b
  }
  return { a, b, op, answer }
}

export function MathGame({ onFinish }: Props) {
  const [started, setStarted] = useState(false)
  const [problems] = useState(() => Array.from({ length: TOTAL_PROBLEMS }, (_, i) => genProblem(i)))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [feedback, setFeedback] = useState<'ok' | 'fail' | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const finish = useCallback((finalCorrect: number) => {
    if (finished) return
    setFinished(true)
    clearInterval(timerRef.current)
    setTimeout(() => onFinish(finalCorrect * 1000), 900)
  }, [finished, onFinish])

  useEffect(() => {
    if (!started) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { finish(correct); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [started, correct, finish])

  const submit = () => {
    const prob = problems[idx]
    const userAnswer = parseInt(input, 10)
    const isCorrect = userAnswer === prob.answer
    const newCorrect = correct + (isCorrect ? 1 : 0)
    setFeedback(isCorrect ? 'ok' : 'fail')
    setTimeout(() => {
      setFeedback(null)
      setInput('')
      if (idx + 1 >= TOTAL_PROBLEMS) {
        finish(newCorrect)
      } else {
        setIdx(i => i + 1)
        setCorrect(newCorrect)
        inputRef.current?.focus()
      }
    }, 500)
  }

  if (!started) return (
    <div style={wrap}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🧮</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Математика</div>
      <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
        Реши {TOTAL_PROBLEMS} примеров за {TIME_LIMIT} секунд.<br/>Чем быстрее и точнее — тем выше счёт.
      </div>
      <button onClick={() => setStarted(true)} style={btn('#3b82f6')}>Начать</button>
    </div>
  )

  if (finished) return (
    <div style={wrap}>
      <div style={{ fontSize: 48 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
        Правильно: {correct}/{TOTAL_PROBLEMS}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>Результат отправляется...</div>
    </div>
  )

  const prob = problems[idx]
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Прогресс + таймер */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Задача {idx + 1}/{TOTAL_PROBLEMS} · ✅ {correct}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: timerColor }}>⏱ {timeLeft}с</div>
      </div>

      {/* Пример */}
      <div style={{
        textAlign: 'center',
        background: feedback === 'ok' ? 'rgba(34,197,94,0.15)'
          : feedback === 'fail' ? 'rgba(239,68,68,0.15)'
          : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '28px 16px', marginBottom: 20,
        transition: 'background 0.2s',
      }}>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>
          {prob.a} {prob.op} {prob.b} = ?
        </div>
        {feedback && (
          <div style={{ fontSize: 18, marginTop: 10, color: feedback === 'ok' ? '#22c55e' : '#ef4444' }}>
            {feedback === 'ok' ? '✅ Верно!' : `❌ Ответ: ${prob.answer}`}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="number"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && input && submit()}
        autoFocus
        disabled={!!feedback}
        placeholder="Твой ответ..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, padding: '12px 14px',
          color: '#fff', fontSize: 18, textAlign: 'center',
          outline: 'none', marginBottom: 12,
        }}
      />
      <button onClick={submit} disabled={!input || !!feedback} style={btn('#6366f1')}>
        Ответить →
      </button>
    </div>
  )
}

const wrap: React.CSSProperties = {
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
