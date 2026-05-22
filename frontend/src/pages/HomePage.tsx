import { useState } from 'react'
import { GameState } from '../types'
import { Profile } from '../components/Profile'
import { DailyReward } from '../components/DailyReward'
import { UnitCard } from '../components/UnitCard'
import { RaidPanel } from '../components/RaidPanel'
import { Leaderboard } from '../components/Leaderboard'
import { buyUnit, buyShield, claimReferral } from '../api/client'

type Tab = 'main' | 'units' | 'raid' | 'leaderboard'

interface Props {
  gameState: GameState
  onRefresh: () => void
}

export function HomePage({ gameState, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('main')
  const [buyLoading, setBuyLoading] = useState(false)
  const [shieldLoading, setShieldLoading] = useState(false)

  const { user, can_claim_daily, daily_reward_coins, raid_cooldown_remaining, shield_active } = gameState

  const handleBuyUnit = async () => {
    setBuyLoading(true)
    try {
      await buyUnit()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка покупки')
    } finally {
      setBuyLoading(false)
    }
  }

  const handleBuyShield = async () => {
    setShieldLoading(true)
    try {
      await buyShield()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setShieldLoading(false)
    }
  }

  const handleClaimReferral = async () => {
    try {
      const res = await claimReferral()
      alert(`🎉 Получено ${res.coins_earned} монет за ${res.claimed_count} рефералов!`)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Нет рефералов')
    }
  }

  return (
    <div style={styles.page}>
      {/* Шапка с балансом всегда видна */}
      <Profile user={user} shieldActive={shield_active} />

      {/* Вкладки */}
      <div style={styles.tabs}>
        {(['main', 'units', 'raid', 'leaderboard'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {{ main: '🏠', units: '⚔️', raid: '🗡', leaderboard: '🏆' }[t]}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* ── Главная ── */}
        {tab === 'main' && (
          <>
            <DailyReward
              canClaim={can_claim_daily}
              rewardCoins={daily_reward_coins}
              onClaimed={onRefresh}
            />

            <div style={styles.actions}>
              <button onClick={handleBuyUnit} disabled={buyLoading} style={styles.actionBtn}>
                {buyLoading ? '...' : `🧑‍⚔️ Нанять Warrior (50 💰)`}
              </button>

              {!shield_active && (
                <button onClick={handleBuyShield} disabled={shieldLoading} style={{ ...styles.actionBtn, background: '#1d4ed8' }}>
                  {shieldLoading ? '...' : '🛡 Купить щит (20 💰, 8ч)'}
                </button>
              )}

              <button onClick={handleClaimReferral} style={{ ...styles.actionBtn, background: '#7c3aed' }}>
                👥 Забрать реф. награды
              </button>
            </div>

            <div style={styles.refBlock}>
              <div style={styles.refTitle}>🔗 Твоя реферальная ссылка:</div>
              <div style={styles.refLink}>
                https://t.me/YOUR_BOT?start=ref_{user.id}
              </div>
            </div>
          </>
        )}

        {/* ── Юниты ── */}
        {tab === 'units' && (
          <div>
            {user.units.length === 0 ? (
              <div style={styles.empty}>У тебя нет юнитов. Найми Warrior на главной!</div>
            ) : (
              user.units.map((u) => (
                <UnitCard key={u.id} unit={u} onUpgraded={onRefresh} />
              ))
            )}
          </div>
        )}

        {/* ── Рейд ── */}
        {tab === 'raid' && (
          <RaidPanel cooldownRemaining={raid_cooldown_remaining} onRaidDone={onRefresh} />
        )}

        {/* ── Лидерборд ── */}
        {tab === 'leaderboard' && <Leaderboard />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 12px', maxWidth: 480, margin: '0 auto' },
  tabs: { display: 'flex', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: 10,
    padding: '10px 0',
    fontSize: 20,
    cursor: 'pointer',
    color: '#fff'
  },
  tabActive: { background: '#5865F2' },
  content: {},
  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 },
  actionBtn: {
    background: '#059669',
    border: 'none',
    borderRadius: 12,
    padding: '13px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    textAlign: 'center'
  },
  refBlock: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '12px 14px'
  },
  refTitle: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  refLink: { fontSize: 12, wordBreak: 'break-all', color: '#93c5fd' },
  empty: { opacity: 0.6, fontSize: 14, textAlign: 'center', marginTop: 24 }
}
