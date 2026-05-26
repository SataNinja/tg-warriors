/**
 * GameLauncher — оверлей для запуска мини-игры по типу и отправки результата.
 */
import { useState } from 'react'
import { ReactionGame } from './ReactionGame'
import { MathGame } from './MathGame'
import { MemoryGame } from './MemoryGame'
import { AimGame } from './AimGame'
import { submitBattleScore } from '../../api/client'

interface Props {
  battleId: number
  gameType: string          // reaction | math | memory | aim
  opponentName: string
  day: number
  battleNum: number
  onClose: () => void
  onDone: (score: number) => void
}

const GAME_META: Record<string, { emoji: string; name: string; desc: string }> = {
  reaction: { emoji: '⚡', name: 'Реакция',    desc: 'Нажми в нужный момент' },
  math:     { emoji: '🧮', name: 'Математика', desc: 'Реши примеры быстро' },
  memory:   { emoji: '🧠', name: 'Память',     desc: 'Запомни последовательность' },
  aim:      { emoji: '🎯', name: 'Меткость',   desc: 'Попади в мишень' },
}

export function GameLauncher({ battleId, gameType, opponentName, day, battleNum, onClose, onDone }: Props) {
  const [phase, setPhase] = useState<'preview' | 'playing' | 'submitting' | 'result'>('preview')
  const [finalScore, setFinalScore] = useState(0)
  const [error, setError] = useState('')

  const meta = GAME_META[gameType] ?? { emoji: '⚔️', name: gameType, desc: '' }

  const handleFinish = async (score: number) => {
    setFinalScore(score)
    setPhase('submitting')
    try {
      await submitBattleScore(battleId, score)
      setPhase('result')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка отправки результата')
      setPhase('result')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(6px)',
    }}>
      {/* Шапка */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: 24 }}>{meta.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.name} · День {day}, Битва {battleNum}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>vs {opponentName}</div>
        </div>
        {phase === 'preview' && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: 22, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* Контент */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {phase === 'preview' && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>{meta.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{meta.name}</div>
            <div style={{ fontSize: 14, opacity: 0.65, marginBottom: 8 }}>{meta.desc}</div>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '8px 16px', marginBottom: 32,
              fontSize: 13, opacity: 0.7,
            }}>
              Соперник: <b>{opponentName}</b> — играет независимо от тебя.<br/>
              Оба результата сравниваются автоматически.
            </div>
            <button
              onClick={() => setPhase('playing')}
              style={{
                display: 'block', width: '100%',
                background: 'rgba(99,102,241,0.35)',
                border: '1px solid rgba(129,140,248,0.6)',
                borderRadius: 14, padding: '14px 0',
                color: '#fff', fontSize: 17, fontWeight: 800,
                cursor: 'pointer',
              }}
            >⚔️ Начать битву</button>
          </div>
        )}

        {phase === 'playing' && (
          <>
            {gameType === 'reaction' && <ReactionGame onFinish={handleFinish} />}
            {gameType === 'math'     && <MathGame onFinish={handleFinish} />}
            {gameType === 'memory'   && <MemoryGame onFinish={handleFinish} />}
            {gameType === 'aim'      && <AimGame onFinish={handleFinish} />}
          </>
        )}

        {phase === 'submitting' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Отправка результата...</div>
          </div>
        )}

        {phase === 'result' && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{error ? '⚠️' : '🏆'}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              {error ? 'Ошибка' : 'Результат записан!'}
            </div>
            {error ? (
              <div style={{ fontSize: 14, color: '#f87171', marginBottom: 20 }}>{error}</div>
            ) : (
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
                {finalScore.toLocaleString()} очков
              </div>
            )}
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 32 }}>
              Победитель определится, когда соперник тоже сыграет.
            </div>
            <button
              onClick={() => { onDone(finalScore); onClose() }}
              style={{
                display: 'block', width: '100%',
                background: 'rgba(34,197,94,0.25)',
                border: '1px solid rgba(34,197,94,0.5)',
                borderRadius: 12, padding: '13px 0',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: 'pointer',
              }}
            >Закрыть</button>
          </div>
        )}
      </div>
    </div>
  )
}
