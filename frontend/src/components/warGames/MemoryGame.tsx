/**
 * 🧠 Память — запомни последовательность цифр и введи её.
 * 5 раундов, сложность растёт. Score = правильные раунды × 1000
 */
import { useState, useEffect, useCallback } from 'react'

interface Props { onFinish: (score: number) => void }

const ROUNDS = 5

function genSequence(len: number): number[] {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1)
}

type Phase = 'intro' | 'show' | 'input' | 'feedback' | 'done'

export function MemoryGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(1)
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showIdx, setShowIdx] = useState(-1) // для пульсирующего показа

  const startRound = useCallback((r: number) => {
    const len = 3 + r  // раунд 1 = 4 цифры, раунд 5 = 8 цифр
    const seq = genSequence(len)
    setSequence(seq)
    setUserInput('')
    setShowIdx(-1)
    setPhase('show')

    // Показываем цифры одну за другой
    let i = 0
    const interval = setInterval(() => {
      setShowIdx(i)
      i++
      if (i >= seq.length) {
        clearInterval(interval)
        setTimeout(() => {
          setShowIdx(-1)
          setPhase('input')
        }, 600)
      }
    }, 700)
  }, [])

  const submitAnswer = () => {
    const expected = sequence.join('')
    const ok = userInput.trim() === expected
    setIsCorrect(ok)
    if (ok) setCorrect(c => c + 1)
    setPhase('feedback')
  }

  const next = () => {
    if (round >= ROUNDS) {
      setPhase('done')
      setTimeout(() => onFinish((correct + (isCorrect ? 1 : 0)) * 1000), 800)
    } else {
      const nextRound = round + 1
      setRound(nextRound)
      startRound(nextRound)
    }
  }

  if (phase === 'intro') return (
    <div style={centerCol}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🧠</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Память</div>
      <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
        {ROUNDS} раундов. Запомни последовательность цифр — она будет расти.<br/>Потом введи её точно.
      </div>
      <button onClick={() => { setRound(1); startRound(1) }} style={btn('#3b82f6')}>Начать</button>
    </div>
  )

  if (phase === 'done') return (
    <div style={centerCol}>
      <div style={{ fontSize: 48 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
        Правильно: {correct}/{ROUNDS}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>Результат отправляется...</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Раунд {round}/{ROUNDS}</div>
        <div style={{ fontSize: 13, opacity: 0.6 }}>✅ {correct} верных</div>
      </div>

      {phase === 'show' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>Запоминай!</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {sequence.map((n, i) => (
              <div key={i} style={{
                width: 48, height: 48, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800,
                background: i === showIdx ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.04)',
                border: `2px solid ${i === showIdx ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                transform: i === showIdx ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s',
                color: i <= showIdx ? '#fff' : 'transparent',
              }}>{n}</div>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 20 }}>
            {sequence.length} цифр(ы)
          </div>
        </div>
      )}

      {phase === 'input' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Введи последовательность подряд</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              {sequence.map((_, i) => (
                <div key={i} style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700,
                }}>{userInput[i] ?? ''}</div>
              ))}
            </div>
          </div>
          <input
            type="number"
            value={userInput}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, sequence.length)
              setUserInput(v)
            }}
            autoFocus
            placeholder="Введи цифры..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '12px 14px',
              color: '#fff', fontSize: 18, textAlign: 'center',
              outline: 'none', marginBottom: 12,
            }}
          />
          <button
            onClick={submitAnswer}
            disabled={userInput.length < sequence.length}
            style={btn('#6366f1')}
          >Проверить →</button>
        </div>
      )}

      {phase === 'feedback' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{isCorrect ? '✅' : '❌'}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {isCorrect ? 'Правильно!' : 'Неверно'}
          </div>
          {!isCorrect && (
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
              Правильно: <b>{sequence.join(' ')}</b><br/>
              Ты ввёл: <b>{userInput.split('').join(' ')}</b>
            </div>
          )}
          <button onClick={next} style={btn(isCorrect ? '#22c55e' : '#6366f1')}>
            {round >= ROUNDS ? 'Финиш' : 'Следующий раунд →'}
          </button>
        </div>
      )}
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
