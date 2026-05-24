import { Unit } from '../types'
import { upgradeUnit, sellUnit } from '../api/client'
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
function SingleUnitCard({ unit, onUpgraded, onSold }: { unit: Unit; onUpgraded: () => void; onSold: () => void }) {
  const [upgrading, setUpgrading] = useState(false)
  const [selling, setSelling] = useState(false)
  const upgradeCost = UNIT_UPGRADE_COST_BASE * unit.level
  const emoji = UNIT_EMOJIS[unit.unit_type ?? 'warrior'] ?? '⚔️'

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      await upgradeUnit(unit.id)
      onUpgraded()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка прокачки')
    } finally {
      setUpgrading(false)
    }
  }

  const handleSell = async () => {
    if (!confirm(`Продать ${unit.name} Lv.${unit.level}? Получишь ~50% стоимости.`)) return
    setSelling(true)
    try {
      const res = await sellUnit(unit.id)
      alert(res.message)
      onSold()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setSelling(false)
    }
  }

  return (
    <div style={styles.singleRow}>
      <span style={styles.smallIcon}>{emoji}</span>
      <div style={styles.info}>
        <span style={styles.level}>Lv.{unit.level}</span>
        <span style={styles.miniStats}> · 💥{unit.power} 🛡{unit.defense}</span>
      </div>
      <button onClick={handleUpgrade} disabled={upgrading || selling} style={styles.upgradeBtn}>
        {upgrading ? '...' : `⬆️ ${upgradeCost}💰`}
      </button>
      <button onClick={handleSell} disabled={upgrading || selling} style={styles.sellBtn} title="Продать юнита">
        {selling ? '...' : '💸'}
      </button>
    </div>
  )
}

// ── Стак юнитов одного типа ───────────────────────────────────────────────────
interface StackProps {
  units: Unit[]
  onUpgraded: () => void
  onSold: () => void
}

export function UnitCard({ units, onUpgraded, onSold }: StackProps) {
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
            <SingleUnitCard key={u.id} unit={u} onUpgraded={onUpgraded} onSold={onSold} />
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
  sellBtn: {
    background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 7, padding: '5px 7px', color: '#f87171', cursor: 'pointer',
    fontSize: 13, flexShrink: 0,
  },
}
