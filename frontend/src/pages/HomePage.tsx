import { useState } from 'react'
import { GameState } from '../types'
import { Profile } from '../components/Profile'
import { DailyReward } from '../components/DailyReward'
import { UnitCard, UNIT_EMOJIS } from '../components/UnitCard'
import { UnitShop } from '../components/UnitShop'
import { RaidPanel } from '../components/RaidPanel'
import { Leaderboard } from '../components/Leaderboard'
import { Shop } from '../components/Shop'
import { PetPanel } from '../components/PetPanel'
import { buyShield, claimPassiveIncome } from '../api/client'

type Tab = 'main' | 'units' | 'raid' | 'shop' | 'pets' | 'leaderboard'

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

  const TABS: { key: Tab; emoji: string; label: string }[] = [
    { key: 'main',        emoji: '🏠', label: 'Замок' },
    { key: 'units',       emoji: '⚔️', label: 'Войска' },
    { key: 'raid',        emoji: '🗡',  label: 'Бой' },
    { key: 'shop',        emoji: '🏪', label: 'Лавка' },
    { key: 'pets',        emoji: '🐾', label: 'Питомник' },
    { key: 'leaderboard', emoji: '🏆', label: 'ТОП' },
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
            <DailyReward
              canClaim={can_claim_daily}
              rewardCoins={daily_reward_coins}
              dailyNextAt={daily_next_at}
              streak={daily_streak}
              onClaimed={onRefresh}
            />

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

            <div style={styles.actions}>
              {!shield_active && (
                <button onClick={handleBuyShield} disabled={shieldLoading}
                  style={{ ...styles.actionBtn, background: 'rgba(29,78,216,0.4)', borderColor: 'rgba(99,102,241,0.4)' }}>
                  {shieldLoading ? '...' : `🛡 Щит (20 💰 · 8 ч)`}
                </button>
              )}
            </div>

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

        {/* ── Магазин ── */}
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
