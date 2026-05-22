import { useState } from 'react'
import { doRaid } from '../api/client'
import { RaidResult } from '../types'

interface Props {
  cooldownRemaining: number
  onRaidDone: () => void
}

export function RaidPanel({ cooldownRemaining, onRaidDone }: Props) {
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RaidResult | null>(null)

  const canRaid = cooldownRemaining === 0

  const handleRaid = async () => {
    const id = parseInt(targetId)
    if (!id) return alert('Введите корректный ID игрока')
    setLoading(true)
    setResult(null)
    try {
      const res = await doRaid(id)
      setResult(res)
      onRaidDone()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка рейда')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.title}>⚔️ Рейд</div>

      {!canRaid && (
        <div style={styles.cooldown}>
          ⏱ Следующий рейд через {Math.ceil(cooldownRemaining / 60)} мин
        </div>
      )}

      {canRaid && (
        <div style={styles.form}>
          <input
            type="number"
            placeholder="ID цели (Telegram user_id)"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleRaid} disabled={loading} style={styles.btn}>
            {loading ? 'Атака...' : '🗡 Атаковать'}
          </button>
        </div>
      )}

      {result && (
        <div style={{ ...styles.result, color: result.success ? '#4ade80' : '#f87171' }}>
          {result.success ? '✅' : '❌'} {result.message}
          <div style={styles.powers}>
            Твоя сила: {result.attacker_power} / Защита врага: {result.defender_power}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '16px',
    marginBottom: 12
  },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 10 },
  cooldown: { color: '#fbbf24', fontSize: 13 },
  form: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#fff',
    fontSize: 14
  },
  btn: {
    background: '#dc2626',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  result: { marginTop: 10, fontSize: 14, fontWeight: 600 },
  powers: { fontSize: 12, opacity: 0.7, marginTop: 4, fontWeight: 400 }
}
