import { useState, useEffect } from 'react'
import { fetchUnitTypes, buyUnit, UnitTypeInfo } from '../api/client'

const CATEGORY_LABEL: Record<string, string> = {
  infantry: '🗡 Пехота',
  ranged:   '🏹 Дальний',
  cavalry:  '🐴 Кавалерия',
  magic:    '🔮 Магия',
  siege:    '💥 Осада',
  divine:   '✝️ Божественный',
  special:  '🥷 Особый',
}

const CATEGORY_COLOR: Record<string, string> = {
  infantry: '#6b7280',
  ranged:   '#16a34a',
  cavalry:  '#b45309',
  magic:    '#7c3aed',
  siege:    '#dc2626',
  divine:   '#d97706',
  special:  '#0891b2',
}

interface Props {
  unitCount: number   // текущее кол-во юнитов (для расчёта цены)
  userCoins: number
  onBought: () => void
}

export function UnitShop({ unitCount, userCoins, onBought }: Props) {
  const [types, setTypes] = useState<UnitTypeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Цена покупки следующего юнита (растёт 1.12^count, base=50)
  const nextPrice = Math.round(50 * (1.12 ** unitCount))

  useEffect(() => {
    fetchUnitTypes()
      .then(data => {
        setTypes(data)
        if (data.length > 0) setSelected(data[data.length - 1].unit_type) // авто-выбор последнего (сильнейшего)
      })
      .catch(() => setTypes([]))
      .finally(() => setLoading(false))
  }, [])

  const handleBuy = async (unitType: string) => {
    setBuying(unitType)
    try {
      await buyUnit(unitType)
      onBought()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка покупки')
    } finally {
      setBuying(null)
    }
  }

  if (loading) return <div style={styles.loading}>Загрузка типов юнитов...</div>
  if (types.length === 0) return <div style={styles.loading}>Нет доступных юнитов</div>

  const selectedType = types.find(t => t.unit_type === selected)

  return (
    <div>
      <div style={styles.priceRow}>
        <span style={styles.priceLabel}>Цена найма:</span>
        <span style={styles.price}>{nextPrice} 💰</span>
        {userCoins < nextPrice && (
          <span style={styles.noCoins}>Недостаточно монет</span>
        )}
      </div>

      {/* Горизонтальный скролл с карточками */}
      <div style={styles.scrollRow}>
        {types.map(t => (
          <button
            key={t.unit_type}
            onClick={() => setSelected(t.unit_type)}
            style={{
              ...styles.typeBtn,
              ...(selected === t.unit_type ? styles.typeBtnActive : {}),
            }}
          >
            <span style={styles.typeEmoji}>{t.emoji}</span>
            <span style={styles.typeName}>{t.name}</span>
          </button>
        ))}
      </div>

      {/* Детали выбранного */}
      {selectedType && (
        <div style={styles.detail}>
          <div style={styles.detailHeader}>
            <span style={styles.detailEmoji}>{selectedType.emoji}</span>
            <div>
              <div style={styles.detailName}>{selectedType.name}</div>
              <span style={{
                ...styles.categoryBadge,
                background: CATEGORY_COLOR[selectedType.category] ?? '#374151',
              }}>
                {CATEGORY_LABEL[selectedType.category] ?? selectedType.category}
              </span>
            </div>
          </div>

          <div style={styles.statRow}>
            <span style={styles.stat}>💥 {selectedType.base_power} сила</span>
            <span style={styles.stat}>🛡 {selectedType.base_defense} защита</span>
            <span style={styles.stat}>🏰 замок {selectedType.castle_req}+</span>
          </div>

          <div style={styles.desc}>{selectedType.desc}</div>

          <button
            onClick={() => handleBuy(selectedType.unit_type)}
            disabled={buying !== null || userCoins < nextPrice}
            style={{
              ...styles.buyBtn,
              ...(userCoins < nextPrice ? styles.buyBtnDisabled : {}),
            }}
          >
            {buying === selectedType.unit_type
              ? '...'
              : `Нанять ${selectedType.name} (${nextPrice} 💰)`}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loading: { textAlign: 'center', opacity: 0.5, fontSize: 14, padding: 16 },
  priceRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 10, padding: '8px 2px',
  },
  priceLabel: { fontSize: 13, opacity: 0.6 },
  price: { fontWeight: 700, fontSize: 15, color: '#FFD700' },
  noCoins: { fontSize: 12, color: '#f87171', marginLeft: 'auto' },

  scrollRow: {
    display: 'flex', gap: 8, overflowX: 'auto',
    paddingBottom: 8, marginBottom: 10,
    scrollbarWidth: 'none',
  },
  typeBtn: {
    flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '8px 10px',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, cursor: 'pointer', color: '#fff', minWidth: 58,
  },
  typeBtnActive: {
    background: '#5865F2', borderColor: '#818cf8',
  },
  typeEmoji: { fontSize: 22 },
  typeName: { fontSize: 10, opacity: 0.85, textAlign: 'center', lineHeight: 1.2 },

  detail: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: '14px 14px 12px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  detailEmoji: { fontSize: 38 },
  detailName: { fontWeight: 700, fontSize: 16, marginBottom: 4 },
  categoryBadge: {
    fontSize: 11, fontWeight: 700, padding: '2px 8px',
    borderRadius: 6, color: '#fff',
  },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  stat: {
    fontSize: 13, background: 'rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '3px 8px',
  },
  desc: { fontSize: 12, opacity: 0.6, lineHeight: 1.5, marginBottom: 12 },
  buyBtn: {
    width: '100%', background: '#059669', border: 'none',
    borderRadius: 12, padding: 13, color: '#fff',
    cursor: 'pointer', fontWeight: 700, fontSize: 14,
  },
  buyBtnDisabled: {
    background: '#374151', cursor: 'not-allowed', opacity: 0.7,
  },
}
