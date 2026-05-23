import { Unit } from '../types'
import { upgradeUnit } from '../api/client'
import { useState } from 'react'

// Эмодзи по типу юнита — расширится в Задаче 7
export const UNIT_EMOJIS: Record<string, string> = {
  warrior:      '⚔️',
  archer:       '🏹',
  knight:       '🐴',
  mage:         '🔮',
  spearman:     '🗡️',
  crossbow:     '🎯',
  paladin:      '✝️',
  catapult:     '💥',
  assassin:     '🥷',
  berserker:    '💢',
  dragon_rider: '🐲',
  warlock:      '🌑',
  death_knight: '💀',
  titan:        '🗿',
  demon_lord:   '😈',
  phoenix_guard:'🔥',
  golem:        '🤖',
  angel:        '👼',
  void_walker:  '🌌',
  god_warrior:  '☀️',
}

const UNIT_UPGRADE_COST_BASE = 30

// ── Карточка одного юнита (используется внутри стака) ─────────────────────────
function SingleUnitCard({ unit, onUpgraded }: { unit: Unit; onUpgraded: () => void }) {
  const [loading, setLoading] = useState(false)
  const upgradeCost = UNIT_UPGRADE_COST_BASE * unit.level
  const emoji = UNIT_EMOJIS[unit.unit_type ?? 'warrior'] ?? '⚔️'

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      await upgradeUnit(unit.id)
      onUpgraded()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка прокачки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.singleRow}>
      <span style={styles.smallIcon}>{emoji}</span>
      <div style={styles.info}>
        <span style={styles.level}>Lv.{unit.level}</span>
        <span style={styles.miniStats}> · 💥{unit.power} 🛡{unit.defense}</span>
      </div>
      <button onClick={handleUpgrade} disabled={loading} style={styles.upgradeBtn}>
        {loading ? '...' : `⬆️ ${upgradeCost}💰`}
      </button>
    </div>
  )
}

// ── Стак юнитов одного типа ───────────────────────────────────────────────────
interface StackProps {
  units: Unit[]
  onUpgraded: () => void
}

export function UnitCard({ units, onUpgraded }: StackProps) {
  const [expanded, setExpanded] = useState(false)

  const first = units[0]
  const emoji = UNIT_EMOJIS[first.unit_type ?? 'warrior'] ?? '⚔️'
  const totalPower   = units.reduce((s, u) => s + u.power, 0)
  const totalDefense = units.reduce((s, u) => s + u.defense, 0)
  const maxLevel     = Math.max(...units.map(u => u.level))

  return (
    <div style={styles.card}>
      {/* ── Шапка стака ── */}
      <div style={styles.header} onClick={() => setExpanded(e => !e)}>
        <span style={styles.icon}>{emoji}</span>
        <div style={styles.mainInfo}>
          <div style={styles.title}>
            {first.name}
            {units.length > 1 && (
              <span style={styles.badge}>×{units.length}</span>
            )}
            <span style={styles.level}> Lv.max {maxLevel}</span>
          </div>
          <div style={styles.stats}>
            💥 {totalPower} атака &nbsp; 🛡 {totalDefense} защита
          </div>
        </div>
        <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Развёрнутый список ── */}
      {expanded && (
        <div style={styles.list}>
          <div style={styles.listHint}>Нажми ⬆️ чтобы прокачать отдельного юнита:</div>
          {units.map(u => (
            <SingleUnitCard key={u.id} unit={u} onUpgraded={onUpgraded} />
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', cursor: 'pointer',
  },
  icon: { fontSize: 30, flexShrink: 0 },
  mainInfo: { flex: 1 },
  title: { fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const },
  badge: {
    background: '#5865F2', color: '#fff', borderRadius: 8,
    padding: '1px 7px', fontSize: 12, fontWeight: 800,
  },
  level: { color: '#FFD700', fontSize: 12, fontWeight: 600 },
  stats: { fontSize: 12, opacity: 0.65, marginTop: 3 },
  chevron: { fontSize: 12, opacity: 0.4, flexShrink: 0 },
  list: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '8px 14px 10px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  listHint: { fontSize: 11, opacity: 0.4, marginBottom: 4 },
  singleRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px',
  },
  smallIcon: { fontSize: 18, flexShrink: 0 },
  info: { flex: 1, fontSize: 13 },
  miniStats: { opacity: 0.6, fontSize: 12 },
  upgradeBtn: {
    background: '#5865F2', border: 'none', borderRadius: 7,
    padding: '5px 9px', color: '#fff', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' as const,
  },
}
