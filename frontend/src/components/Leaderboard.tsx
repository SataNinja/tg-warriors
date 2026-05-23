import { useEffect, useState } from 'react'
import { fetchLeaderboard } from '../api/client'
import { LeaderboardEntry } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']

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
  if (!board.length) return <div style={styles.loading}>Пока нет игроков</div>

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>🏆 Таблица лидеров</div>
      {board.map((entry) => {
        const displayName = entry.nickname || entry.first_name
        const medal = MEDALS[entry.rank - 1] ?? null
        return (
          <div key={entry.user_id} style={{
            ...styles.row,
            background: entry.rank <= 3
              ? `rgba(255,215,0,${0.12 - (entry.rank - 1) * 0.03})`
              : 'rgba(255,255,255,0.05)'
          }}>
            <span style={styles.rank}>
              {medal ?? `#${entry.rank}`}
            </span>
            <div style={styles.nameBlock}>
              <span style={styles.name}>{displayName}</span>
              {entry.nickname && entry.username && (
                <span style={styles.uname}>@{entry.username}</span>
              )}
            </div>
            <span style={styles.power}>⚔️ {entry.total_power}</span>
            <span style={styles.coins}>💰 {entry.coins.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 12 },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 10 },
  loading: { opacity: 0.6, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 6,
    fontSize: 13
  },
  rank: { width: 32, fontWeight: 800, fontSize: 15, textAlign: 'center' },
  nameBlock: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1 },
  name: { fontWeight: 600 },
  uname: { opacity: 0.4, fontSize: 10 },
  power: { color: '#a78bfa', fontWeight: 600, fontSize: 12 },
  coins: { color: '#FFD700', fontWeight: 700 }
}
