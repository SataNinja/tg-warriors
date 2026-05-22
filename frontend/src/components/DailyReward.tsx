import { useState } from 'react'
import { claimDaily } from '../api/client'

interface Props {
  canClaim: boolean
  rewardCoins: number
  onClaimed: (coins: number) => void
}

export function DailyReward({ canClaim, rewardCoins, onClaimed }: Props) {
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

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
        <span style={styles.done}>✅ Уже получено</span>
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
    fontSize: 13
  },
  done: { color: '#4ade80', fontSize: 13 }
}
