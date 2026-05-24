import { useEffect, useState } from 'react'
import { CastleInfo, WeaponInfo } from '../types'
import {
  fetchCastleInfo, upgradeCastle,
  fetchWeaponInfo, buyWeapon, upgradeWeapon,
  buyEgg
} from '../api/client'

interface Props {
  onRefresh: () => void
  userCoins: number
  userIron: number
}

type ShopTab = 'castle' | 'weapon' | 'pets'

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Обычное',
  rare: 'Редкое',
  epic: 'Эпическое',
  legendary: 'Легендарное',
}

const CASTLE_EMOJIS: Record<number, string> = {
  1: '🏘', 2: '🏰', 3: '🏯', 4: '🗼', 5: '⚔️',
  6: '🐉', 7: '🛡', 8: '👑', 9: '🌟', 10: '💎',
  11: '⚡', 12: '🌙', 13: '🔮', 14: '🌊', 15: '🦅',
  16: '☄️', 17: '🌌', 18: '🪐', 19: '☀️', 20: '🌈',
}
const MAX_CASTLE_LEVEL = 20

export function Shop({ onRefresh, userCoins, userIron }: Props) {
  const [tab, setTab] = useState<ShopTab>('castle')

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>🏪 Магазин</div>
      <div style={styles.tabs}>
        {(['castle', 'weapon', 'pets'] as ShopTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}>
            {t === 'castle' ? '🏰 Замок' : t === 'weapon' ? '⚔️ Оружие' : '🐾 Питомцы'}
          </button>
        ))}
      </div>

      {tab === 'castle' && <CastleTab onRefresh={onRefresh} userCoins={userCoins} />}
      {tab === 'weapon' && <WeaponTab onRefresh={onRefresh} userCoins={userCoins} userIron={userIron} />}
      {tab === 'pets' && <PetsShopTab onRefresh={onRefresh} userCoins={userCoins} />}
    </div>
  )
}

// ── Вкладка Замок ──────────────────────────────────────────────────────────
function CastleTab({ onRefresh, userCoins }: { onRefresh: () => void; userCoins: number }) {
  const [info, setInfo] = useState<CastleInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCastleInfo().then(setInfo).catch(console.error)
  }, [])

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await upgradeCastle()
      alert(res.message)
      setInfo(null)
      fetchCastleInfo().then(setInfo)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (!info) return <div style={styles.loading}>Загрузка...</div>

  const emoji = CASTLE_EMOJIS[info.level] ?? '🏰'
  const levelPct = (info.level / MAX_CASTLE_LEVEL) * 100

  // Цвет темы замка по уровню
  const castleGlow = info.level >= 15 ? '#f59e0b' : info.level >= 10 ? '#a855f7' : info.level >= 5 ? '#3b82f6' : '#6b7280'

  return (
    <div>
      {/* Большой визуал замка */}
      <div style={{
        ...styles.castleCard,
        background: `linear-gradient(160deg, rgba(0,0,0,0.3) 0%, rgba(${info.level >= 10 ? '88,34,128' : '30,58,138'},0.25) 100%)`,
        border: `1px solid ${castleGlow}40`,
        boxShadow: `0 0 32px ${castleGlow}20`,
        padding: '20px 16px 16px',
      }}>
        {/* Прогресс-бар уровня */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.5, marginBottom: 4 }}>
            <span>Уровень {info.level}</span>
            <span>Макс {MAX_CASTLE_LEVEL}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${levelPct}%`, background: `linear-gradient(90deg, ${castleGlow}, ${castleGlow}bb)`, borderRadius: 2 }} />
          </div>
        </div>

        <div className="anim-float" style={{ fontSize: 72, marginBottom: 4, filter: `drop-shadow(0 0 12px ${castleGlow}60)` }}>{emoji}</div>
        <div style={{ ...styles.castleName, color: castleGlow, fontSize: 20 }}>{info.name}</div>
        <div style={styles.castleLevel}>Уровень {info.level} из {MAX_CASTLE_LEVEL}</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>👥</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Юнитов</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{info.max_units}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>💰</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Бонус</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#4ade80' }}>+{info.income_bonus}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>🐾</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Питомцев</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{Math.min(10, Math.ceil(info.level / 2))}</div>
          </div>
        </div>
      </div>

      {info.next_level_cost !== null ? (
        <div style={styles.upgradeCard}>
          <div style={styles.upgradeTitle}>⬆️ Следующий уровень: {info.next_level_name}</div>
          <div style={styles.upgradeBonus}>{info.next_level_bonus}</div>
          <div style={{ ...styles.upgradeCost, color: userCoins >= info.next_level_cost! ? '#4ade80' : '#f87171' }}>
            Стоимость: {info.next_level_cost!.toLocaleString()} 💰
          </div>
          <button
            onClick={handleUpgrade}
            disabled={loading || userCoins < info.next_level_cost!}
            style={{
              ...styles.upgradeBtn,
              opacity: userCoins < info.next_level_cost! ? 0.4 : 1,
            }}
          >
            {loading ? 'Улучшаю...' : '🏰 Улучшить замок'}
          </button>
        </div>
      ) : (
        <div style={styles.maxLevel}>💎 Замок на максимальном уровне!</div>
      )}
    </div>
  )
}

// ── Вкладка Оружие ─────────────────────────────────────────────────────────
function WeaponTab({ onRefresh, userCoins, userIron }: { onRefresh: () => void; userCoins: number; userIron: number }) {
  const [info, setInfo] = useState<WeaponInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = () => fetchWeaponInfo().then(setInfo).catch(console.error)
  useEffect(() => { reload() }, [])

  const handleBuy = async () => {
    setLoading(true)
    try {
      const res = await buyWeapon()
      alert(res.message)
      reload(); onRefresh()
    } catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка') }
    finally { setLoading(false) }
  }

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await upgradeWeapon()
      alert(res.message)
      reload(); onRefresh()
    } catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка') }
    finally { setLoading(false) }
  }

  if (!info) return <div style={styles.loading}>Загрузка...</div>

  const rarityColor = RARITY_COLORS[info.rarity ?? 'common']

  return (
    <div>
      {info.level === 0 ? (
        // Оружия нет
        <div style={styles.upgradeCard}>
          <div style={{ fontSize: 48, textAlign: 'center', margin: '8px 0' }}>⚔️</div>
          <div style={styles.upgradeTitle}>Железный меч</div>
          <div style={styles.upgradeBonus}>+5 к силе армии</div>
          <div style={{ ...styles.upgradeCost, color: userCoins >= 100 ? '#4ade80' : '#f87171' }}>
            Стоимость: 100 💰
          </div>
          <button onClick={handleBuy} disabled={loading || userCoins < 100} style={styles.upgradeBtn}>
            {loading ? '...' : '⚔️ Купить оружие'}
          </button>
        </div>
      ) : (
        // Оружие есть
        <div>
          <div style={{ ...styles.castleCard, borderColor: rarityColor }}>
            <div style={styles.castleEmoji}>⚔️</div>
            <div style={{ ...styles.castleName, color: rarityColor }}>{info.name}</div>
            <div style={{ fontSize: 12, color: rarityColor, marginBottom: 4 }}>
              {RARITY_LABELS[info.rarity ?? 'common']} · Уровень {info.level}/10
            </div>
            <div style={styles.statRow}>
              <span>💥 Бонус к силе: <b>+{info.attack_bonus}</b></span>
            </div>
          </div>

          {info.level < 10 && info.upgrade_cost !== null ? (
            <div style={styles.upgradeCard}>
              <div style={styles.upgradeTitle}>⬆️ Прокачать до уровня {info.level + 1}</div>
              <div style={styles.upgradeBonus}>+3 к силе</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                🔩 У тебя железа: {userIron}
              </div>
              <div style={{ ...styles.upgradeCost, color: userIron >= info.upgrade_cost ? '#4ade80' : '#f87171' }}>
                Стоимость: {info.upgrade_cost} 🔩 железа
              </div>
              <button
                onClick={handleUpgrade}
                disabled={loading || userIron < info.upgrade_cost}
                style={{ ...styles.upgradeBtn, background: '#7c3aed', opacity: userIron < info.upgrade_cost ? 0.4 : 1 }}
              >
                {loading ? '...' : '⚔️ Прокачать'}
              </button>
            </div>
          ) : (
            <div style={styles.maxLevel}>⚔️ Оружие на максимальном уровне!</div>
          )}
        </div>
      )}

      <div style={styles.ironHint}>
        🔩 Железо зарабатывается за победы в боях. У тебя: <b>{userIron}</b>
      </div>
    </div>
  )
}

// ── Вкладка Питомцы (магазин) ──────────────────────────────────────────────
const EGGS = [
  { type: 'common', name: 'Обычное яйцо',  emoji: '🥚', cost: 200,  hatch: '2 ч',  desc: '10 обычных питомцев' },
  { type: 'rare',   name: 'Редкое яйцо',   emoji: '🔮', cost: 500,  hatch: '6 ч',  desc: '10 редких питомцев' },
  { type: 'elite',  name: 'Элитное яйцо',  emoji: '💎', cost: 1200, hatch: '12 ч', desc: '10 эпических/легендарных' },
]

function PetsShopTab({ onRefresh, userCoins }: { onRefresh: () => void; userCoins: number }) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleBuy = async (eggType: string) => {
    setLoading(eggType)
    try {
      const res = await buyEgg(eggType)
      alert(res.message)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div style={styles.petsHint}>
        Питомцы дают бонус к силе и монетам.<br />
        Яйцо вылупляется через время — следи в 🐾 Питомцы → Яйца
      </div>
      {EGGS.map(egg => (
        <div key={egg.type} style={styles.eggCard}>
          <div style={styles.eggEmoji}>{egg.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={styles.eggName}>{egg.name}</div>
            <div style={styles.eggDesc}>{egg.desc}</div>
            <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>⏳ Инкубация: {egg.hatch}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...styles.upgradeCost, color: userCoins >= egg.cost ? '#4ade80' : '#f87171', marginBottom: 4 }}>
              {egg.cost} 💰
            </div>
            <button
              onClick={() => handleBuy(egg.type)}
              disabled={loading === egg.type || userCoins < egg.cost}
              style={{ ...styles.upgradeBtn, padding: '6px 14px', fontSize: 13,
                opacity: userCoins < egg.cost ? 0.4 : 1 }}
            >
              {loading === egg.type ? '...' : 'Купить'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 12 },
  header: { fontWeight: 800, fontSize: 16, marginBottom: 10 },
  tabs: { display: 'flex', gap: 6, marginBottom: 14 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '7px 0', color: '#fff', cursor: 'pointer', fontSize: 12
  },
  tabActive: { background: '#5865F2' },
  loading: { opacity: 0.6, fontSize: 13, textAlign: 'center', padding: 16 },
  castleCard: {
    background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px',
    textAlign: 'center', marginBottom: 12, border: '1px solid rgba(255,255,255,0.1)'
  },
  castleEmoji: { fontSize: 48, marginBottom: 4 },
  castleName: { fontWeight: 800, fontSize: 18, marginBottom: 2 },
  castleLevel: { fontSize: 12, opacity: 0.5, marginBottom: 8 },
  statRow: { display: 'flex', justifyContent: 'center', gap: 16, fontSize: 13 },
  upgradeCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginBottom: 10
  },
  upgradeTitle: { fontWeight: 700, fontSize: 14, marginBottom: 4 },
  upgradeBonus: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
  upgradeCost: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  upgradeBtn: {
    width: '100%', background: '#059669', border: 'none', borderRadius: 10,
    padding: '10px 0', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14
  },
  maxLevel: { textAlign: 'center', padding: 16, opacity: 0.7, fontSize: 14 },
  ironHint: { fontSize: 12, opacity: 0.6, textAlign: 'center', marginTop: 8 },
  petsHint: { fontSize: 12, opacity: 0.65, marginBottom: 12, textAlign: 'center' },
  eggCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8
  },
  eggEmoji: { fontSize: 36 },
  eggName: { fontWeight: 700, fontSize: 14, marginBottom: 2 },
  eggDesc: { fontSize: 12, opacity: 0.6 },
}
