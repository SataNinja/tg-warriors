import { useState } from 'react'
import { GameState, User } from '../types'
import { Profile } from '../components/Profile'
import { DailyReward } from '../components/DailyReward'
import { UnitCard, UNIT_EMOJIS } from '../components/UnitCard'
import { UnitShop } from '../components/UnitShop'
import { RaidPanel } from '../components/RaidPanel'
import { Leaderboard } from '../components/Leaderboard'
import { Shop } from '../components/Shop'
import { PetPanel } from '../components/PetPanel'
import AdminPanel from '../components/AdminPanel'
import { ClanPanel } from '../components/ClanPanel'
import { buyShield, claimPassiveIncome } from '../api/client'

const ADMIN_ID = 6320200740

// ── Данные замков (дублируем из бэкенда) ────────────────────────────────────
const CASTLE_NAMES: Record<number, string> = {
  1: 'Деревня', 2: 'Городок', 3: 'Форпост', 4: 'Замок', 5: 'Бастион',
  6: 'Крепость Дракона', 7: 'Твердыня', 8: 'Легендарный Замок',
  9: 'Небесная Цитадель', 10: 'Вечная Твердыня', 11: 'Алмазная Крепость',
  12: 'Эбонитовый Замок', 13: 'Арсенал Драконов', 14: 'Обитель Гигантов',
  15: 'Замок Богов', 16: 'Звёздная Твердыня', 17: 'Крепость Вечности',
  18: 'Вселенский Бастион', 19: 'Замок Создателя', 20: 'Ультимативная Твердыня',
}
const CASTLE_BONUS: Record<number, number> = {
  1: 0, 2: 0, 3: 5, 4: 5, 5: 10, 6: 10, 7: 15, 8: 15, 9: 20, 10: 25,
  11: 30, 12: 30, 13: 35, 14: 35, 15: 40, 16: 40, 17: 45, 18: 45, 19: 50, 20: 50,
}
const CASTLE_MAX_UNITS: Record<number, number> = {
  1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 12, 10: 15,
  11: 16, 12: 17, 13: 18, 14: 19, 15: 20, 16: 21, 17: 22, 18: 23, 19: 24, 20: 25,
}
const CASTLE_EMOJIS_MAIN: Record<number, string> = {
  1: '🏘', 2: '🏰', 3: '🏯', 4: '🗼', 5: '⚔️',
  6: '🐉', 7: '🛡', 8: '👑', 9: '🌟', 10: '💎',
  11: '⚡', 12: '🌙', 13: '🔮', 14: '🌊', 15: '🦅',
  16: '☄️', 17: '🌌', 18: '🪐', 19: '☀️', 20: '🌈',
}
const MAX_CASTLE_LVL = 20

// ── Карточка замка на главном экране ────────────────────────────────────────
function MainCastleCard({ user, onGoShop }: { user: User; onGoShop: () => void }) {
  const lvl = user.castle_level
  const emoji = CASTLE_EMOJIS_MAIN[lvl] ?? '🏰'
  const name = CASTLE_NAMES[lvl] ?? `Замок ${lvl}`
  const bonus = CASTLE_BONUS[lvl] ?? 0
  const maxUnits = CASTLE_MAX_UNITS[lvl] ?? lvl * 2
  const maxPets = Math.min(10, Math.ceil(lvl / 2))
  const levelPct = (lvl / MAX_CASTLE_LVL) * 100
  const castleGlow = lvl >= 15 ? '#f59e0b' : lvl >= 10 ? '#a855f7' : lvl >= 5 ? '#3b82f6' : '#6b7280'

  return (
    <div style={{
      background: `linear-gradient(160deg, rgba(0,0,0,0.3) 0%, rgba(${lvl >= 10 ? '88,34,128' : '30,58,138'},0.25) 100%)`,
      border: `1px solid ${castleGlow}40`,
      boxShadow: `0 0 24px ${castleGlow}18`,
      borderRadius: 16, padding: '16px 16px 14px', marginBottom: 12,
    }}>
      {/* Прогресс уровня */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.5, marginBottom: 4 }}>
          <span>Уровень {lvl}</span>
          <span>Макс {MAX_CASTLE_LVL}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${levelPct}%`, background: `linear-gradient(90deg, ${castleGlow}, ${castleGlow}bb)`, borderRadius: 2 }} />
        </div>
      </div>

      {/* Большое эмодзи */}
      <div style={{ textAlign: 'center' }}>
        <div className="anim-float" style={{ fontSize: 64, marginBottom: 4, filter: `drop-shadow(0 0 10px ${castleGlow}50)` }}>
          {emoji}
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: castleGlow, marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 12 }}>Уровень {lvl} из {MAX_CASTLE_LVL}</div>
      </div>

      {/* Статы */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20 }}>👥</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Юнитов</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{user.units.length}/{maxUnits}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20 }}>💰</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Бонус</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#4ade80' }}>{bonus > 0 ? `+${bonus}%` : '—'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20 }}>🐾</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Питомцев</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{maxPets}</div>
        </div>
      </div>

      {/* Ссылка на улучшение */}
      <button onClick={onGoShop} style={{
        display: 'block', width: '100%', marginTop: 12,
        background: `rgba(${lvl >= 10 ? '168,85,247' : '59,130,246'},0.15)`,
        border: `1px solid ${castleGlow}30`,
        borderRadius: 10, padding: '7px 0', color: castleGlow,
        cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}>
        🏪 Улучшить в Лавке
      </button>
    </div>
  )
}

type Tab = 'main' | 'units' | 'raid' | 'shop' | 'pets' | 'leaderboard' | 'clan' | 'admin'

interface Props {
  gameState: GameState
  onRefresh: () => void
}

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export function HomePage({ gameState, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('main')
  const [shieldLoading, setShieldLoading] = useState(false)
  const [passiveLoading, setPassiveLoading] = useState(false)

  const {
    user, can_claim_daily, daily_reward_coins, daily_next_at, daily_streak,
    shield_active, energy, max_energy, energy_regen_seconds,
    passive_income_ready, passive_income_amount, passive_income_next_in,
  } = gameState

  const botUsername = import.meta.env.VITE_BOT_USERNAME ?? 'YOUR_BOT'
  const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`

  // Уникальные эмодзи юнитов игрока
  const attackerEmojis = [...new Set(user.units.map(u => UNIT_EMOJIS[u.unit_type] ?? '⚔️'))]

  const handleBuyShield = async () => {
    setShieldLoading(true)
    try { await buyShield(); onRefresh() }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка') }
    finally { setShieldLoading(false) }
  }

  const handleClaimPassive = async () => {
    setPassiveLoading(true)
    try {
      const res = await claimPassiveIncome()
      alert(res.message)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ещё не готово')
    } finally {
      setPassiveLoading(false)
    }
  }

  const isAdmin = user.id === ADMIN_ID

  const TABS: { key: Tab; emoji: string; label: string }[] = [
    { key: 'main',        emoji: '🏠', label: 'Замок' },
    { key: 'units',       emoji: '⚔️', label: 'Войска' },
    { key: 'raid',        emoji: '🗡',  label: 'Бой' },
    { key: 'clan',        emoji: '⚔️', label: 'Кланы' },
    { key: 'shop',        emoji: '🏪', label: 'Лавка' },
    { key: 'pets',        emoji: '🐾', label: 'Питомник' },
    { key: 'leaderboard', emoji: '🏆', label: 'ТОП' },
    ...(isAdmin ? [{ key: 'admin' as Tab, emoji: '🛡', label: 'Админ' }] : []),
  ]

  return (
    <div style={styles.page}>
      <Profile
        user={user}
        shieldActive={shield_active}
        energy={energy}
        maxEnergy={max_energy}
        energyRegenSeconds={energy_regen_seconds}
        onRefresh={onRefresh}
      />

      {/* ── Вкладки с подписями ── */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
          >
            <span style={styles.tabEmoji}>{t.emoji}</span>
            <span style={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      <div>
        {/* ── Главная ── */}
        {tab === 'main' && (
          <>
            <MainCastleCard user={user} onGoShop={() => setTab('shop')} />

            {/* Щит — сразу под замком */}
            {!shield_active && (
              <div style={styles.actions}>
                <button onClick={handleBuyShield} disabled={shieldLoading}
                  style={{ ...styles.actionBtn, background: 'rgba(29,78,216,0.4)', borderColor: 'rgba(99,102,241,0.4)' }}>
                  {shieldLoading ? '...' : `🛡 Купить щит (20 💰 · 8 ч)`}
                </button>
              </div>
            )}

            {/* Пассивный доход */}
            <div style={{
              ...styles.passiveCard,
              borderColor: passive_income_ready ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)',
            }}>
              <div style={styles.passiveLeft}>
                <div style={styles.passiveTitle}>💰 Доход замка</div>
                <div style={styles.passiveHint}>
                  {passive_income_ready
                    ? `Готово к сбору: +${passive_income_amount} монет!`
                    : `Следующий доход через ${fmtTime(passive_income_next_in)}`}
                </div>
              </div>
              <button
                onClick={handleClaimPassive}
                disabled={!passive_income_ready || passiveLoading}
                style={{
                  ...styles.passiveBtn,
                  background: passive_income_ready ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.05)',
                  color: passive_income_ready ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  cursor: passive_income_ready ? 'pointer' : 'default',
                }}
              >
                {passiveLoading ? '...' : passive_income_ready ? `+${passive_income_amount} 💰` : '⏳'}
              </button>
            </div>

            {/* Ежедневная награда — под доходом замка */}
            <DailyReward
              canClaim={can_claim_daily}
              rewardCoins={daily_reward_coins}
              dailyNextAt={daily_next_at}
              streak={daily_streak}
              onClaimed={onRefresh}
            />

            {/* Реферальная ссылка */}
            <div style={styles.refBlock}>
              <div style={styles.refTitle}>🔗 Реферальная ссылка</div>
              <div style={styles.refHint}>
                За каждого приглашённого — <b style={{ color: '#FFD700' }}>1 000 монет</b> сразу при регистрации
              </div>
              <div
                style={styles.refLink}
                onClick={() => {
                  navigator.clipboard?.writeText(refLink)
                  alert('Ссылка скопирована!')
                }}
              >
                {refLink}
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 3 }}>нажми чтобы скопировать</div>
              </div>
            </div>
          </>
        )}

        {/* ── Юниты ── */}
        {tab === 'units' && (
          <div>
            <div style={styles.sectionTitle}>🏪 Нанять юнита</div>
            <UnitShop
              unitCount={user.units.length}
              userCoins={user.coins}
              onBought={onRefresh}
            />

            {user.units.length > 0 && (
              <>
                <div style={{ ...styles.sectionTitle, marginTop: 18 }}>
                  ⚔️ Армия &nbsp;
                  <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>
                    {user.units.length} юн. · 💥{user.units.reduce((s, u) => s + u.power, 0)} сила
                  </span>
                </div>
                {Object.values(
                  user.units.reduce((acc, u) => {
                    const key = u.unit_type ?? u.name
                    if (!acc[key]) acc[key] = []
                    acc[key].push(u)
                    return acc
                  }, {} as Record<string, typeof user.units>)
                ).map(group => (
                  <UnitCard
                    key={group[0].unit_type ?? group[0].name}
                    units={group}
                    onUpgraded={onRefresh}
                    onSold={onRefresh}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Рейд ── */}
        {tab === 'raid' && (
          <RaidPanel
            energy={energy}
            onRaidDone={onRefresh}
            attackerEmojis={attackerEmojis}
          />
        )}

        {/* ── Лавка ── */}
        {tab === 'shop' && (
          <Shop
            onRefresh={onRefresh}
            userCoins={user.coins}
            userIron={user.iron}
          />
        )}

        {/* ── Питомцы ── */}
        {tab === 'pets' && (
          <PetPanel onRefresh={onRefresh} userCoins={user.coins} userCrystals={user.crystals ?? 0} />
        )}

        {/* ── Лидерборд ── */}
        {tab === 'leaderboard' && <Leaderboard />}

        {/* ── Кланы ── */}
        {tab === 'clan' && (
          <ClanPanel
            userId={user.id}
            userCoins={user.coins}
            onRefresh={onRefresh}
          />
        )}

        {/* ── Админ ── */}
        {tab === 'admin' && isAdmin && <AdminPanel />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '14px 12px', maxWidth: 480, margin: '0 auto' },

  tabs: { display: 'flex', gap: 4, marginBottom: 14 },
  tab: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '7px 0 6px',
    cursor: 'pointer', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    transition: 'background 0.15s, border-color 0.15s',
  },
  tabActive: {
    background: 'rgba(88,101,242,0.35)',
    borderColor: 'rgba(129,140,248,0.5)',
  },
  tabEmoji: { fontSize: 18, lineHeight: 1 },
  tabLabel: { fontSize: 9, opacity: 0.8, fontWeight: 600, letterSpacing: 0.3 },

  passiveCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.05)', border: '1px solid',
    borderRadius: 14, padding: '12px 14px', marginBottom: 10,
    transition: 'border-color 0.3s',
  },
  passiveLeft: { flex: 1 },
  passiveTitle: { fontWeight: 700, fontSize: 14, marginBottom: 2 },
  passiveHint: { fontSize: 12, opacity: 0.6 },
  passiveBtn: {
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 10, padding: '8px 14px',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
    transition: 'all 0.2s',
  },

  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  actionBtn: {
    border: '1px solid', borderRadius: 12, padding: 13,
    color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, textAlign: 'center',
    backdropFilter: 'blur(4px)',
  },

  refBlock: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '12px 14px',
  },
  refTitle: { fontWeight: 700, fontSize: 14, marginBottom: 4 },
  refHint: { fontSize: 12, opacity: 0.7, marginBottom: 8 },
  refLink: {
    fontSize: 12, wordBreak: 'break-all', color: '#93c5fd',
    cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: '8px 10px',
    border: '1px solid rgba(147,197,253,0.15)',
  },

  sectionTitle: {
    fontWeight: 700, fontSize: 14, marginBottom: 10,
    paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
}
