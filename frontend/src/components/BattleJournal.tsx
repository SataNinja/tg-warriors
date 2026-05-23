import { useEffect, useState } from 'react'
import { fetchBattles } from '../api/client'
import { BattleEntry } from '../types'

interface Props {
  onRevenge: (opponentId: number) => void
}

export function BattleJournal({ onRevenge }: Props) {
  const [battles, setBattles] = useState<BattleEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBattles()
      .then(setBattles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={styles.loading}>Загружаю журнал...</div>
  if (!battles.length) return <div style={styles.loading}>Боёв пока нет</div>

  return (
    <div>
      <div style={styles.title}>📋 Журнал боёв</div>
      {battles.map(b => <BattleRow key={b.id} battle={b} onRevenge={onRevenge} />)}
    </div>
  )
}

function BattleRow({ battle: b, onRevenge }: { battle: BattleEntry; onRevenge: (id: number) => void }) {
  const isWin = b.is_attack ? b.success : !b.success
  const date = new Date(b.created_at).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div style={{ ...styles.row, borderLeft: `3px solid ${isWin ? '#4ade80' : '#f87171'}` }}>
      <div style={styles.rowTop}>
        {/* Тип боя */}
        <span style={styles.badge}>
          {b.is_attack ? '⚔️ Атака' : '🛡 Оборона'}
        </span>

        {/* Результат */}
        <span style={{ ...styles.result, color: isWin ? '#4ade80' : '#f87171' }}>
          {isWin ? '✅ Победа' : '❌ Поражение'}
        </span>

        <span style={styles.date}>{date}</span>
      </div>

      <div style={styles.rowMid}>
        <span style={styles.opponent}>
          {b.is_attack ? `→ ${b.opponent_name}` : `← ${b.opponent_name}`}
        </span>
        <span style={styles.powers}>
          ⚡{b.my_power} vs {b.opponent_power}
        </span>
        {b.coins_delta !== 0 && (
          <span style={{ color: b.coins_delta > 0 ? '#FFD700' : '#f87171', fontWeight: 700, fontSize: 13 }}>
            {b.coins_delta > 0 ? '+' : ''}{b.coins_delta} 💰
          </span>
        )}
      </div>

      {/* Кнопка мести */}
      {b.can_revenge && (
        <button
          style={styles.revengeBtn}
          onClick={() => onRevenge(b.opponent_id)}
        >
          ⚔️ Месть!
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loading: { opacity: 0.6, fontSize: 13, textAlign: 'center', marginTop: 20 },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 10 },
  row: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 8,
    borderLeft: '3px solid transparent'
  },
  rowTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  badge: { fontSize: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 6px' },
  result: { fontSize: 12, fontWeight: 700 },
  date: { fontSize: 11, opacity: 0.4, marginLeft: 'auto' },
  rowMid: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  opponent: { fontSize: 13, fontWeight: 600, flex: 1 },
  powers: { fontSize: 12, opacity: 0.6 },
  revengeBtn: {
    marginTop: 8,
    background: '#dc2626',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13
  }
}
