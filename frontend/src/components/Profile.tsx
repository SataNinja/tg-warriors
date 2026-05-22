import { useState } from 'react'
import { User } from '../types'
import { setNickname } from '../api/client'

interface Props {
  user: User
  shieldActive: boolean
  energy: number
  maxEnergy: number
  energyRegenMinutes: number
  onRefresh: () => void
}

export function Profile({ user, shieldActive, energy, maxEnergy, energyRegenMinutes, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)
  const [newNick, setNewNick] = useState(user.nickname ?? '')
  const [loading, setLoading] = useState(false)

  const displayName = user.nickname || user.first_name
  const energyPct = (energy / maxEnergy) * 100
  const energyColor = energyPct > 50 ? '#4ade80' : energyPct > 20 ? '#fbbf24' : '#f87171'

  const handleSaveNick = async () => {
    setLoading(true)
    try {
      await setNickname(newNick)
      setEditing(false)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка смены никнейма')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      {/* Имя + ID */}
      <div style={styles.row}>
        <div>
          {editing ? (
            <div style={styles.editRow}>
              <input
                value={newNick}
                onChange={e => setNewNick(e.target.value)}
                maxLength={20}
                style={styles.input}
                placeholder="Новый никнейм (3-20 симв.)"
              />
              <button onClick={handleSaveNick} disabled={loading} style={styles.saveBtn}>
                {loading ? '...' : '✓'}
              </button>
              <button onClick={() => setEditing(false)} style={styles.cancelBtn}>✕</button>
            </div>
          ) : (
            <div style={styles.nameRow}>
              <span style={styles.name}>{displayName}</span>
              <button onClick={() => setEditing(true)} style={styles.editBtn} title="Сменить никнейм">✏️</button>
            </div>
          )}
          <div style={styles.userId}>ID: {user.id}</div>
        </div>
        <div style={styles.coins}>💰 {user.coins.toLocaleString()}</div>
      </div>

      {/* Энергия */}
      <div style={styles.energySection}>
        <div style={styles.energyLabel}>
          ⚡ Энергия: {energy}/{maxEnergy}
          {energy < maxEnergy && (
            <span style={styles.regenHint}> (+1 через {energyRegenMinutes} мин)</span>
          )}
        </div>
        <div style={styles.energyTrack}>
          <div style={{ ...styles.energyFill, width: `${energyPct}%`, background: energyColor }} />
        </div>
      </div>

      {/* Щит */}
      <div style={styles.shield}>
        {shieldActive && user.shield_until
          ? `🛡 Щит активен до ${new Date(user.shield_until).toLocaleTimeString()}`
          : '🔓 Без защиты'}
        &nbsp;·&nbsp; ⚔️ Юнитов: {user.units.length}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, fontWeight: 700 },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  userId: { fontSize: 11, opacity: 0.4, marginTop: 2 },
  coins: { fontSize: 20, fontWeight: 800, color: '#FFD700' },
  editRow: { display: 'flex', gap: 4, alignItems: 'center' },
  input: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 8,
    padding: '4px 8px',
    color: '#fff',
    fontSize: 13,
    width: 160
  },
  saveBtn: { background: '#059669', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer' },
  cancelBtn: { background: '#374151', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer' },
  energySection: { marginBottom: 8 },
  energyLabel: { fontSize: 12, marginBottom: 4 },
  regenHint: { opacity: 0.5, fontSize: 11 },
  energyTrack: { height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  energyFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  shield: { fontSize: 12, opacity: 0.65 }
}
