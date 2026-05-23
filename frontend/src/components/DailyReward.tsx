import { useState, useEffect } from 'react'
import { claimDaily } from '../api/client'

interface Props {
  canClaim: boolean
  rewardCoins: number
  dailyNextAt: string | null   // ISO timestamp — когда можно забрать следующий раз
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

export function DailyReward({ canClaim, rewardCoins, dailyNextAt, onClaimed }: Props) {
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const countdown = useCountdown(!canClaim ? dailyNextAt : null)

  const handle = async () => {
    setLoading(true)
    try {
      const res = await claimDaily()
      setClaimed(true)
      onClaimed(res.coins_earned)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (claimed) {
    return (
      <div style={{ ...styles.card, borderColor: '#4ade80' }}>
        ✅ Получено {rewardCoins} монет! Возвращайся завтра.
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <span>🎁 Ежедневная награда: <b style={{ color: '#FFD700' }}>{rewardCoins} монет</b></span>
      {canClaim ? (
        <button onClick={handle} disabled={loading} style={styles.btn}>
          {loading ? '...' : 'Забрать'}
        </button>
      ) : (
        <span style={styles.timer}>
          ⏰ {countdown > 0 ? fmtTime(countdown) : '✅ Скоро'}
        </span>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  btn: {
    background: '#059669',
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0
  },
  timer: { color: '#fbbf24', fontSize: 13, fontWeight: 700, flexShrink: 0 }
}
