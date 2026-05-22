import { useState } from 'react'
import { doRaid, doPveRaid } from '../api/client'
import { RaidResult, PveRaidResult } from '../types'

interface Props {
  cooldownRemaining: number
  energy: number
  onRaidDone: () => void
}

type Mode = 'pve' | 'pvp'

export function RaidPanel({ cooldownRemaining, energy, onRaidDone }: Props) {
  const [mode, setMode] = useState<Mode>('pve')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RaidResult | PveRaidResult | null>(null)

  const canFight = cooldownRemaining === 0
  const hasEnergy = energy >= 5

  const handleFight = async () => {
    setLoading(true)
    setResult(null)
    try {
      let res
      if (mode === 'pve') {
        res = await doPveRaid()
      } else {
        const id = parseInt(targetId)
        if (!id) { alert('Введи корректный ID игрока'); setLoading(false); return }
        res = await doRaid(id)
      }
      setResult(res)
      onRaidDone()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка боя')
    } finally {
      setLoading(false)
    }
  }

  const isPve = (r: RaidResult | PveRaidResult): r is PveRaidResult => 'bot_power' in r

  return (
    <div style={styles.card}>
      <div style={styles.title}>⚔️ Бой</div>

      {/* Переключатель режима */}
      <div style={styles.tabs}>
        <button
          onClick={() => { setMode('pve'); setResult(null) }}
          style={{ ...styles.tab, ...(mode === 'pve' ? styles.tabActive : {}) }}
        >
          🤖 Бой с ботом
        </button>
        <button
          onClick={() => { setMode('pvp'); setResult(null) }}
          style={{ ...styles.tab, ...(mode === 'pvp' ? styles.tabActive : {}) }}
        >
          👤 PvP по ID
        </button>
      </div>

      {/* Статус */}
      {!hasEnergy && (
        <div style={styles.warn}>⚡ Нет энергии (нужно 5). Ждёт восстановления...</div>
      )}
      {!canFight && hasEnergy && (
        <div style={styles.warn}>⏱ Кулдаун: {Math.ceil(cooldownRemaining / 60)} мин</div>
      )}

      {/* Форма */}
      {canFight && hasEnergy && (
        <div style={styles.form}>
          {mode === 'pvp' && (
            <input
              type="number"
              placeholder="Telegram ID противника"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              style={styles.input}
            />
          )}
          {mode === 'pve' && (
            <div style={styles.pveHint}>
              Противник-бот с силой ±30% от твоей. Стоит 5 ⚡
            </div>
          )}
          <button onClick={handleFight} disabled={loading} style={styles.btn}>
            {loading ? 'Бой...' : mode === 'pve' ? '⚔️ Атаковать бота' : '🗡 Атаковать'}
          </button>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div style={{ ...styles.result, color: result.success ? '#4ade80' : '#f87171' }}>
          {result.success ? '✅' : '❌'} {result.message}
          <div style={styles.powers}>
            {isPve(result)
              ? `Твоя сила: ${result.attacker_power} / Бот: ${result.bot_power}`
              : `Твоя сила: ${(result as RaidResult).attacker_power} / Защита врага: ${(result as RaidResult).defender_power}`
            }
          </div>
          <div style={styles.energyLeft}>⚡ Осталось энергии: {result.energy_left}/50</div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 10 },
  tabs: { display: 'flex', gap: 6, marginBottom: 10 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '8px 0', color: '#fff', cursor: 'pointer', fontSize: 13
  },
  tabActive: { background: '#5865F2' },
  warn: { color: '#fbbf24', fontSize: 13, marginBottom: 6 },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14
  },
  pveHint: { fontSize: 12, opacity: 0.6 },
  btn: {
    background: '#dc2626', border: 'none', borderRadius: 10, padding: '11px',
    color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14
  },
  result: { marginTop: 10, fontSize: 14, fontWeight: 600 },
  powers: { fontSize: 12, opacity: 0.7, marginTop: 3, fontWeight: 400 },
  energyLeft: { fontSize: 12, opacity: 0.6, marginTop: 2, fontWeight: 400 }
}
