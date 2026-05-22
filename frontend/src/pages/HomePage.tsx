import { useState } from 'react'
import { GameState } from '../types'
import { Profile } from '../components/Profile'
import { DailyReward } from '../components/DailyReward'
import { UnitCard } from '../components/UnitCard'
import { RaidPanel } from '../components/RaidPanel'
import { Leaderboard } from '../components/Leaderboard'
import { buyUnit, buyShield } from '../api/client'

type Tab = 'main' | 'units' | 'raid' | 'leaderboard'

interface Props {
  gameState: GameState
  onRefresh: () => void
}

export function HomePage({ gameState, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('main')
  const [buyLoading, setBuyLoading] = useState(false)
  const [shieldLoading, setShieldLoading] = useState(false)

  const { user, can_claim_daily, daily_reward_coins, raid_cooldown_remaining,
    shield_active, energy, max_energy, energy_regen_minutes } = gameState

  const botUsername = import.meta.env.VITE_BOT_USERNAME ?? 'YOUR_BOT'
  const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`

  const handleBuyUnit = async () => {
    setBuyLoading(true)
    try { await buyUnit(); onRefresh() }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка покупки') }
    finally { setBuyLoading(false) }
  }

  const handleBuyShield = async () => {
    setShieldLoading(true)
    try { await buyShield(); onRefresh() }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Ошибка') }
    finally { setShieldLoading(false) }
  }

  const tabIcons: Record<Tab, string> = { main: '🏠', units: '⚔️', raid: '🗡', leaderboard: '🏆' }

  return (
    <div style={styles.page}>
      <Profile
        user={user}
        shieldActive={shield_active}
        energy={energy}
        maxEnergy={max_energy}
        energyRegenMinutes={energy_regen_minutes}
        onRefresh={onRefresh}
      />

      <div style={styles.tabs}>
        {(Object.keys(tabIcons) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {tabIcons[t]}
          </button>
        ))}
      </div>

      <div>
        {/* ── Главная ── */}
        {tab === 'main' && (
          <>
            <DailyReward canClaim={can_claim_daily} rewardCoins={daily_reward_coins} onClaimed={onRefresh} />

            <div style={styles.actions}>
              <button onClick={handleBuyUnit} disabled={buyLoading} style={styles.actionBtn}>
                {buyLoading ? '...' : `🧑‍⚔️ Нанять Warrior (${50} 💰)`}
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
            {user.units.length === 0
              ? <div style={styles.empty}>Нет юнитов. Купи Warrior на главной!</div>
              : user.units.map(u => <UnitCard key={u.id} unit={u} onUpgraded={onRefresh} />)
            }
          </div>
        )}

        {/* ── Рейд ── */}
        {tab === 'raid' && (
          <RaidPanel
            cooldownRemaining={raid_cooldown_remaining}
            energy={energy}
            onRaidDone={onRefresh}
          />
        )}

        {/* ── Лидерборд ── */}
        {tab === 'leaderboard' && <Leaderboard />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '14px 12px', maxWidth: 480, margin: '0 auto' },
  tabs: { display: 'flex', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '10px 0', fontSize: 20, cursor: 'pointer', color: '#fff'
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
  empty: { opacity: 0.6, fontSize: 14, textAlign: 'center', marginTop: 24 }
}
