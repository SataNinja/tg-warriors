import { useState, useEffect } from 'react'
import { claimDaily } from '../api/client'
import { sfxCoin, sfxError } from '../utils/sounds'

const DAILY_REWARDS = [50, 75, 120, 200, 240, 300, 700]

interface Props {
  canClaim: boolean
  rewardCoins: number
  dailyNextAt: string | null   // ISO timestamp — когда можно забрать следующий раз
  streak: number               // текущий streak (0 = ещё не получали)
  onClaimed: (coins: number) => void
}

function useCountdown(targetIso: string | null): number {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!targetIso) { setSecs(0); return }
    const target = new Date(targetIso).getTime()
    const tick = () => {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setSecs(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso])

  return secs
}

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s}с`
  return `${s}с`
}

export function DailyReward({ canClaim, rewardCoins, dailyNextAt, streak, onClaimed }: Props) {
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const countdown = useCountdown(!canClaim ? dailyNextAt : null)

  // Позиция в цикле: день который уже получен (0-based). После claim streak растёт.
  // claimedDay = (streak - 1) % 7, todayDay = streak % 7 (следующий)
  const claimedPos = streak > 0 ? ((streak - 1) % 7) : -1
  const todayPos   = streak % 7  // позиция которую получим при следующем claim

  const handle = async () => {
    setLoading(true)
    try {
      const res = await claimDaily()
      setClaimed(true)
      sfxCoin()
      onClaimed(res.coins_earned)
    } catch (e: any) {
      sfxError()
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>🎁 Ежедневные награды</span>
        {!canClaim && !claimed && countdown > 0 && (
          <span style={styles.timer}>⏰ {fmtTime(countdown)}</span>
        )}
      </div>

      {/* Календарь 7 дней */}
      <div style={styles.calendar}>
        {DAILY_REWARDS.map((coins, i) => {
          const isDone    = i < claimedPos || (claimed && i <= claimedPos + 1)
          const isToday   = !claimed && canClaim && i === todayPos
          const isNext    = !canClaim && i === todayPos
          const isDay7    = i === 6

          let bg = 'rgba(255,255,255,0.06)'
          let border = '1px solid rgba(255,255,255,0.08)'
          let opacity = 0.5
          if (isDone)  { bg = 'rgba(74,222,128,0.12)';  border = '1px solid #4ade8055'; opacity = 1 }
          if (isToday) { bg = 'rgba(251,191,36,0.18)';  border = '1px solid #fbbf24';   opacity = 1 }
          if (isNext)  { bg = 'rgba(255,255,255,0.1)';  border = '1px solid rgba(255,255,255,0.2)'; opacity = 0.85 }
          if (isDay7)  { bg = bg === 'rgba(255,255,255,0.06)' ? 'rgba(168,85,247,0.1)' : bg }

          return (
            <div key={i} style={{ ...styles.day, background: bg, border, opacity }}>
              <div style={styles.dayNum}>День {i + 1}</div>
              <div style={styles.dayIcon}>
                {isDone ? '✅' : isDay7 ? '💎' : isToday ? '⭐' : '🎁'}
              </div>
              <div style={{ ...styles.dayCoins, color: isDay7 ? '#a855f7' : isToday ? '#fbbf24' : '#fff' }}>
                {coins}💰
              </div>
            </div>
          )
        })}
      </div>

      {/* Кнопка / статус */}
      {claimed ? (
        <div style={styles.claimedMsg}>✅ Получено {rewardCoins} монет! Возвращайся завтра.</div>
      ) : canClaim ? (
        <button onClick={handle} disabled={loading} style={styles.btn}>
          {loading ? '...' : `Забрать ${rewardCoins} 💰`}
        </button>
      ) : (
        <div style={styles.nextHint}>
          Следующая награда — <b style={{ color: '#FFD700' }}>{rewardCoins} монет</b>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '14px 14px',
    marginBottom: 12,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  title: { fontWeight: 700, fontSize: 15 },
  timer: { color: '#fbbf24', fontSize: 13, fontWeight: 700 },
  calendar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 5,
    marginBottom: 12,
  },
  day: {
    borderRadius: 10,
    padding: '7px 2px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
  },
  dayNum: { fontSize: 9, opacity: 0.6, fontWeight: 600 },
  dayIcon: { fontSize: 16 },
  dayCoins: { fontSize: 10, fontWeight: 700 },
  btn: {
    width: '100%',
    background: '#d97706',
    border: 'none',
    borderRadius: 10,
    padding: '11px 0',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 15,
  },
  claimedMsg: {
    textAlign: 'center' as const,
    color: '#4ade80',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 0',
  },
  nextHint: {
    textAlign: 'center' as const,
    fontSize: 13,
    opacity: 0.7,
    padding: '6px 0',
  },
}
