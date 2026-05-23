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
import { buyShield } from '../api/client'

type Tab = 'main' | 'units' | 'raid' | 'shop' | 'pets' | 'leaderboard'

interface Props {
  gameState: GameState
  onRefresh: () => void
}

export function HomePage({ gameState, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('main')
  const [shieldLoading, setShieldLoading] = useState(false)

  const {
    user, can_claim_daily, daily_reward_coins, daily_next_at, daily_streak,
    shield_active, energy, max_energy, energy_regen_seconds,
  } = gameState

  const botUsername = import.meta.env.VITE_BOT_USERNAME ?? 'YOUR_BOT'
  const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`

  // Уникальные эмодзи юнитов игрока (дедупликация по типу)
  const attackerEmojis = [...new Set(user.units.map(u => UNIT_EMOJIS[u.unit_type] ?? '⚔️'))]

  const handleBuyShield = async () => {
    setShieldLoading(true)
    try { await buyShield(); onRefresh() }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка') }
    finally { setShieldLoading(false) }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'main',        label: '🏠' },
    { key: 'units',       label: '⚔️' },
    { key: 'raid',        label: '🗡' },
    { key: 'shop',        label: '🏪' },
    { key: 'pets',        label: '🐾' },
    { key: 'leaderboard', label: '🏆' },
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

      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
          >
            {t.label}
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

            <div style={styles.actions}>
              <button onClick={() => setTab('units')} style={styles.actionBtn}>
                ⚔️ Нанять юнита
              </button>
              {!shield_active && (
                <button onClick={handleBuyShield} disabled={shieldLoading}
                  style={{ ...styles.actionBtn, background: '#1d4ed8' }}>
                  {shieldLoading ? '...' : `🛡 Щит (20 💰, 8 ч)`}
                </button>
              )}
            </div>

            {/* Реферальная ссылка */}
            <div style={styles.refBlock}>
              <div style={styles.refTitle}>🔗 Реферальная ссылка</div>
              <div style={styles.refHint}>
                За каждого приглашённого — <b style={{ color: '#FFD700' }}>100 монет</b> сразу при регистрации
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
            {/* Магазин юнитов */}
            <div style={styles.sectionTitle}>🏪 Нанять юнита</div>
            <UnitShop
              unitCount={user.units.length}
              userCoins={user.coins}
              onBought={onRefresh}
            />

            {/* Список армии */}
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
  tabs: { display: 'flex', gap: 6, marginBottom: 14 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '9px 0', fontSize: 18, cursor: 'pointer', color: '#fff'
  },
  tabActive: { background: '#5865F2' },
  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  actionBtn: {
    background: '#059669', border: 'none', borderRadius: 12, padding: 13,
    color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, textAlign: 'center'
  },
  refBlock: { background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px' },
  refTitle: { fontWeight: 700, fontSize: 14, marginBottom: 4 },
  refHint: { fontSize: 12, opacity: 0.7, marginBottom: 8 },
  refLink: {
    fontSize: 12, wordBreak: 'break-all', color: '#93c5fd',
    cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: '8px 10px'
  },
  empty: { opacity: 0.6, fontSize: 14, textAlign: 'center', marginTop: 24 },
  sectionTitle: {
    fontWeight: 700, fontSize: 14, marginBottom: 10,
    paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
}
