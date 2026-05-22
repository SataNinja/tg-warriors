import { Unit } from '../types'
import { upgradeUnit } from '../api/client'
import { useState } from 'react'

interface Props {
  unit: Unit
  onUpgraded: () => void
}

export function UnitCard({ unit, onUpgraded }: Props) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      await upgradeUnit(unit.id)
      onUpgraded()
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Ошибка прокачки'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <span style={styles.icon}>⚔️</span>
        <div style={styles.info}>
          <div style={styles.title}>{unit.name} <span style={styles.level}>Lv.{unit.level}</span></div>
          <div style={styles.stats}>💥 {unit.power} атака &nbsp; 🛡 {unit.defense} защита</div>
        </div>
        <button onClick={handleUpgrade} disabled={loading} style={styles.btn}>
          {loading ? '...' : '⬆️'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '10px 14px',
    marginBottom: 8
  },
  row: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { fontSize: 28 },
  info: { flex: 1 },
  title: { fontWeight: 600, fontSize: 15 },
  level: { color: '#FFD700', fontSize: 13 },
  stats: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  btn: {
    background: '#5865F2',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16
  }
}
