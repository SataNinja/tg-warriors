import { useEffect, useState } from 'react'
import { fetchLeaderboard } from '../api/client'
import { LeaderboardEntry } from '../types'

export function Leaderboard() {
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
      .then(setBoard)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={styles.loading}>Загрузка лидеров...</div>

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>🏆 Таблица лидеров</div>
      {board.map((entry) => (
        <div key={entry.user_id} style={styles.row}>
          <span style={styles.rank}>#{entry.rank}</span>
          <span style={styles.name}>
            {entry.first_name}
            {entry.username ? <span style={styles.uname}> @{entry.username}</span> : null}
          </span>
          <span style={styles.coins}>💰 {entry.coins.toLocaleString()}</span>
          <span style={styles.power}>⚔️ {entry.total_power}</span>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 12 },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 10 },
  loading: { opacity: 0.6, fontSize: 13, marginBottom: 12 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 6,
    fontSize: 13
  },
  rank: { width: 28, fontWeight: 700, color: '#FFD700' },
  name: { flex: 1 },
  uname: { opacity: 0.5, fontSize: 11 },
  coins: { color: '#FFD700', fontWeight: 600 },
  power: { color: '#a78bfa', fontWeight: 600 }
}
