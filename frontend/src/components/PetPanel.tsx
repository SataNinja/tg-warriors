import { useEffect, useState, useCallback } from 'react'
import { PetOut, PetBattleResult } from '../types'
import { fetchPets, doPetBattle } from '../api/client'

interface Props {
  onRefresh: () => void
}

const PET_EMOJIS: Record<string, string> = {
  wolf: '🐺', raven: '🦅', bear: '🐻', phoenix: '🔥',
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
}

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    if (seconds <= 0) return
    const interval = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [seconds])
  return left
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PetCard({ pet, onBattle }: { pet: PetOut; onBattle: (id: number) => void }) {
  const cooldown = useCountdown(pet.battle_cooldown_seconds)
  const energyPct = (pet.energy / pet.max_energy) * 100
  const energyColor = energyPct > 50 ? '#4ade80' : energyPct > 25 ? '#fbbf24' : '#f87171'
  const rarityColor = RARITY_COLORS[pet.rarity]
  const emoji = PET_EMOJIS[pet.pet_type] ?? '🐾'

  return (
    <div style={{ ...styles.petCard, borderColor: rarityColor }}>
      <div style={styles.petTop}>
        <span style={styles.petEmoji}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.petName, color: rarityColor }}>{pet.name}</div>
          <div style={styles.petStats}>
            ⚔️ +{pet.power_bonus} сила
            {pet.gold_bonus > 0 && <span> · 💰 +{pet.gold_bonus}% монет</span>}
          </div>
        </div>
      </div>

      {/* Энергия питомца */}
      <div style={styles.energyRow}>
        <span style={{ fontSize: 12 }}>⚡ {pet.energy}/{pet.max_energy}</span>
        <div style={styles.energyTrack}>
          <div style={{ ...styles.energyFill, width: `${energyPct}%`, background: energyColor }} />
        </div>
      </div>

      {/* Кнопка боя */}
      {cooldown > 0 ? (
        <div style={styles.cooldownText}>⏳ Кулдаун: {fmt(cooldown)}</div>
      ) : pet.energy < 5 ? (
        <div style={styles.cooldownText}>😴 Нет энергии. Восстановление...</div>
      ) : (
        <button onClick={() => onBattle(pet.id)} style={styles.battleBtn}>
          🥊 В бой!
        </button>
      )}
    </div>
  )
}

export function PetPanel({ onRefresh }: Props) {
  const [pets, setPets] = useState<PetOut[]>([])
  const [loading, setLoading] = useState(true)
  const [battleResult, setBattleResult] = useState<PetBattleResult | null>(null)
  const [battling, setBattling] = useState(false)

  const reload = useCallback(() => {
    fetchPets().then(setPets).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleBattle = async (petId: number) => {
    setBattling(true)
    try {
      const res: PetBattleResult = await doPetBattle(petId)
      setBattleResult(res)
      reload()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    } finally {
      setBattling(false)
    }
  }

  if (loading) return <div style={styles.loading}>Загрузка питомцев...</div>

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>🐾 Питомцы</div>

      {battleResult && (
        <div style={{ ...styles.resultBox, background: battleResult.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>
          <div style={{ fontSize: 32, textAlign: 'center' }}>{battleResult.success ? '🏆' : '💀'}</div>
          <div style={{ textAlign: 'center', fontWeight: 700, color: battleResult.success ? '#4ade80' : '#f87171', marginBottom: 6 }}>
            {battleResult.message}
          </div>
          <div style={styles.resultStats}>
            <span>🐾 {battleResult.pet_power} VS 🤖 {battleResult.bot_power}</span>
            {battleResult.success && <span>⚡ +{battleResult.energy_gained} энергии!</span>}
          </div>
          <button onClick={() => setBattleResult(null)} style={styles.closeBtn}>Закрыть</button>
        </div>
      )}

      {pets.length === 0 ? (
        <div style={styles.empty}>
          У тебя нет питомцев. Купи яйцо в 🏪 Магазин → Питомцы!
        </div>
      ) : (
        pets.map(p => (
          <PetCard key={p.id} pet={p} onBattle={battling ? () => {} : handleBattle} />
        ))
      )}

      <div style={styles.hint}>
        Победа в бою питомца = +1–20 ⚡ энергии для тебя.<br />
        Поражение = питомец теряет -10 энергии. Кулдаун 10 мин.
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 12 },
  header: { fontWeight: 800, fontSize: 16, marginBottom: 12 },
  loading: { opacity: 0.6, fontSize: 13, textAlign: 'center', padding: 16 },
  empty: { opacity: 0.6, fontSize: 13, textAlign: 'center', padding: 20 },
  petCard: {
    background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px',
    marginBottom: 10, border: '1px solid rgba(255,255,255,0.1)'
  },
  petTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  petEmoji: { fontSize: 32 },
  petName: { fontWeight: 700, fontSize: 15, marginBottom: 2 },
  petStats: { fontSize: 12, opacity: 0.7 },
  energyRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  energyTrack: { flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  energyFill: { height: '100%', borderRadius: 3, transition: 'width 0.3s' },
  battleBtn: {
    width: '100%', background: '#dc2626', border: 'none', borderRadius: 8,
    padding: '8px 0', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14
  },
  cooldownText: { textAlign: 'center', fontSize: 12, opacity: 0.6, padding: '4px 0' },
  resultBox: { borderRadius: 12, padding: 14, marginBottom: 12 },
  resultStats: { display: 'flex', justifyContent: 'space-around', fontSize: 13, opacity: 0.8, marginBottom: 10 },
  closeBtn: {
    width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: 8, padding: '7px 0', color: '#fff', cursor: 'pointer', fontSize: 13
  },
  hint: { fontSize: 11, opacity: 0.45, textAlign: 'center', lineHeight: 1.5, marginTop: 4 },
}
