import { useEffect, useState, useCallback, useRef } from 'react'
import { PetOut, PetBattleResult, EggOut, FoodItem } from '../types'
import { fetchPets, doPetBattle, releasePet, feedPet, fetchEggs, hatchEgg, fetchFoodList, upgradePet, buyCrystals } from '../api/client'

interface Props {
  onRefresh: () => void
  userCoins: number
  userCrystals: number
}

type PanelTab = 'pets' | 'eggs'

// ── Эмодзи по типу питомца ───────────────────────────────────────────────────
const PET_EMOJIS: Record<string, string> = {
  wolf: '🐺', raven: '🪶', cat: '🐱', rabbit: '🐰', fox: '🦊',
  owl: '🦉', dog: '🐕', rat: '🐀', snake: '🐍', turtle: '🐢',
  bear: '🐻', lion: '🦁', tiger: '🐯', eagle: '🦅', shark: '🦈',
  panther: '🐆', rhino: '🦏', mammoth: '🦣', wolf_pack: '🐺', crocodile: '🐊',
  phoenix: '🔥', dragon: '🐲', unicorn: '🦄', griffin: '🦅', hydra: '🐉',
  cerberus: '🔴', leviathan: '🌊', kraken: '🐙', thunderbird: '⚡', cosmic_wolf: '🌌',
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
}

const EGG_EMOJIS: Record<string, string> = { common: '🥚', rare: '🔮', elite: '💎' }

// ── Хук обратного отсчёта ────────────────────────────────────────────────────
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
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`
  return `0:${s.toString().padStart(2, '0')}`
}

// ── Мини-анимация боя питомцев ───────────────────────────────────────────────
const PET_FIGHT_DURATION_MS = 6000  // 6 секунд

function PetFightAnimation({ myEmoji, onDone }: { myEmoji: string; onDone: () => void }) {
  const CLASH = ['💥', '⚡', '✨', '🔥', '💢']
  // Прогресс 0..1, считается от реального времени — не зависит от активности вкладки
  const [progress, setProgress] = useState(0)
  const startedAt = useRef(Date.now())
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    startedAt.current = Date.now()

    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt.current
      const p = Math.min(1, elapsed / PET_FIGHT_DURATION_MS)
      setProgress(p)
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true
        clearInterval(id)
        onDone()
      }
    }, 100)  // опрашиваем каждые 100мс — точно, но не нагружает

    return () => clearInterval(id)
  }, [onDone])

  const t = progress
  const myX = Math.min(35, t * 38)
  const botX = Math.max(55, 100 - t * 40)
  const clash = t > 0.45 && t < 0.8
  // Используем время для выбора эффекта столкновения (не frame, чтобы не было прыжков)
  const clashIdx = Math.floor(Date.now() / 300) % CLASH.length

  return (
    <div style={fightStyles.wrap}>
      <div style={fightStyles.title}>🥊 Бой питомцев!</div>
      <div style={fightStyles.arena}>
        <span style={{ ...fightStyles.pet, left: `${myX}%`, transition: 'left 0.1s linear' }}>{myEmoji}</span>
        <span style={{ ...fightStyles.pet, left: `${botX}%`, transform: 'scaleX(-1)', transition: 'left 0.1s linear' }}>🤖</span>
        {clash && <span style={{ ...fightStyles.clash, left: '47%' }}>{CLASH[clashIdx]}</span>}
      </div>
      <div style={fightStyles.label}>
        {t < 0.4 ? 'Питомцы сходятся...' : t < 0.7 ? 'Схватка!' : 'Исход решается...'}
      </div>
      {/* Прогресс-бар */}
      <div style={fightStyles.track}>
        <div style={{ ...fightStyles.fill, width: `${t * 100}%` }} />
      </div>
    </div>
  )
}

const fightStyles: Record<string, React.CSSProperties> = {
  wrap: { background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12 },
  title: { textAlign: 'center', fontWeight: 800, fontSize: 16, marginBottom: 10 },
  arena: { height: 70, background: 'rgba(0,0,0,0.2)', borderRadius: 10, position: 'relative', overflow: 'hidden', marginBottom: 8 },
  pet: { position: 'absolute', top: '25%', fontSize: 32 },
  clash: { position: 'absolute', top: '15%', fontSize: 30, zIndex: 2 },
  label: { textAlign: 'center', fontSize: 12, opacity: 0.7, marginBottom: 8 },
  track: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', background: 'linear-gradient(90deg, #dc2626, #f59e0b)', borderRadius: 2, transition: 'width 0.1s' },
}

// ── Карточка яйца ─────────────────────────────────────────────────────────────
function EggCard({ egg, onHatch }: { egg: EggOut; onHatch: (id: number) => void }) {
  const secsLeft = useCountdown(egg.hatch_seconds_left)
  const rarityColor = RARITY_COLORS[egg.rarity] ?? '#9ca3af'

  return (
    <div style={{ ...styles.petCard, borderColor: rarityColor }}>
      <div style={styles.petTop}>
        <span style={{ fontSize: 40 }}>{EGG_EMOJIS[egg.egg_type] ?? '🥚'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.petName, color: rarityColor }}>
            {egg.pet_emoji} {egg.pet_name}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4, textTransform: 'uppercase' }}>
            {egg.rarity} · {egg.egg_type} яйцо
          </div>
          {secsLeft > 0 ? (
            <div style={{ fontSize: 13, color: '#fbbf24' }}>⏳ Вылупится через: {fmt(secsLeft)}</div>
          ) : (
            <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>✅ Готово к вылуплению!</div>
          )}
        </div>
      </div>
      {secsLeft === 0 && (
        <button onClick={() => onHatch(egg.id)} style={{ ...styles.battleBtn, background: '#7c3aed' }}>
          🥚 Вылупить!
        </button>
      )}
    </div>
  )
}

// ── Карточка питомца ─────────────────────────────────────────────────────────
function PetCard({
  pet,
  onBattle,
  onFeed,
  onRelease,
  onUpgrade,
  userCoins,
  userCrystals,
  foodList,
}: {
  pet: PetOut
  onBattle: (id: number) => void
  onFeed: (id: number, foodType: string) => void
  onRelease: (id: number, name: string) => void
  onUpgrade: (id: number) => void
  userCoins: number
  userCrystals: number
  foodList: FoodItem[]
}) {
  const cooldown = useCountdown(pet.battle_cooldown_seconds)
  const regenIn = useCountdown(pet.energy >= pet.max_energy ? 0 : pet.energy_next_in)
  const [showFood, setShowFood] = useState(false)

  const energyPct = (pet.energy / pet.max_energy) * 100
  const energyColor = energyPct > 50 ? '#4ade80' : energyPct > 25 ? '#fbbf24' : '#f87171'

  const hungerPct = pet.hunger
  const hungerColor = hungerPct >= 70 ? '#4ade80' : hungerPct >= 30 ? '#fbbf24' : '#f87171'

  const rarityColor = RARITY_COLORS[pet.rarity] ?? '#9ca3af'
  const emoji = PET_EMOJIS[pet.pet_type] ?? '🐾'
  const effPower = pet.effective_power_bonus
  const effPct = pet.power_bonus > 0 ? Math.round((effPower / pet.power_bonus) * 100) : 100

  return (
    <div style={{ ...styles.petCard, borderColor: rarityColor }}>
      <div style={styles.petTop}>
        <span style={styles.petEmoji}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.petName, color: rarityColor }}>{pet.name}</div>
          <div style={styles.petStats}>
            ⚔️ +{effPower} сила
            {pet.power_bonus !== effPower && (
              <span style={{ opacity: 0.5 }}> (макс +{pet.power_bonus}, {effPct}%)</span>
            )}
            {pet.gold_bonus > 0 && <span> · 💰 +{pet.gold_bonus}% монет</span>}
          </div>
        </div>
        <button
          onClick={() => onRelease(pet.id, pet.name)}
          style={styles.releaseBtn}
          title="Отпустить питомца"
        >
          🚪
        </button>
      </div>

      {/* Энергия */}
      <div style={styles.barRow}>
        <span style={styles.barLabel}>⚡ {pet.energy}/{pet.max_energy}</span>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${energyPct}%`, background: energyColor }} />
        </div>
        {pet.energy < pet.max_energy && regenIn > 0 && (
          <span style={styles.barHint}>+1 через {fmt(regenIn)}</span>
        )}
      </div>

      {/* Голод */}
      <div style={styles.barRow}>
        <span style={styles.barLabel}>
          🍖 {pet.hunger}%
          <span style={{ ...styles.hungerBadge, color: hungerColor }}> {pet.hunger_status}</span>
        </span>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${hungerPct}%`, background: hungerColor }} />
        </div>
      </div>

      {/* Кормёжка */}
      {showFood ? (
        <div style={styles.foodPanel}>
          {foodList.map(f => (
            <button
              key={f.food_type}
              onClick={() => { onFeed(pet.id, f.food_type); setShowFood(false) }}
              disabled={userCoins < f.cost}
              style={{
                ...styles.foodBtn,
                opacity: userCoins < f.cost ? 0.4 : 1,
              }}
            >
              {f.emoji} {f.name} · {f.cost}💰
              <span style={styles.foodDesc}> {f.description}</span>
            </button>
          ))}
          <button onClick={() => setShowFood(false)} style={styles.cancelFoodBtn}>✕ Закрыть</button>
        </div>
      ) : (
        <button onClick={() => setShowFood(true)} style={styles.feedBtn}>
          🍖 Покормить
        </button>
      )}

      {/* Прокачка за кристаллы */}
      <button
        onClick={() => onUpgrade(pet.id)}
        disabled={userCrystals < 5}
        style={{ ...styles.upgradeBtn, opacity: userCrystals < 5 ? 0.4 : 1 }}
        title={userCrystals < 5 ? `Нужно 5 💎, у тебя ${userCrystals}` : ''}
      >
        💎 Прокачать (5 💎) · Lv.{pet.level} → {pet.level + 1}
      </button>

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

// ── Основной компонент ────────────────────────────────────────────────────────
export function PetPanel({ onRefresh, userCoins, userCrystals }: Props) {
  const [tab, setTab] = useState<PanelTab>('pets')
  const [pets, setPets] = useState<PetOut[]>([])
  const [eggs, setEggs] = useState<EggOut[]>([])
  const [foodList, setFoodList] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [battleResult, setBattleResult] = useState<PetBattleResult | null>(null)
  const [fightingPet, setFightingPet] = useState<{ emoji: string; petId: number } | null>(null)
  const [battling, setBattling] = useState(false)
  const [releaseConfirm, setReleaseConfirm] = useState<{ id: number; name: string } | null>(null)
  const pendingResult = useRef<PetBattleResult | null>(null)

  const reload = useCallback(async () => {
    try {
      const [p, e, f] = await Promise.all([fetchPets(), fetchEggs(), fetchFoodList()])
      setPets(p)
      setEggs(e)
      setFoodList(f)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleBattle = async (petId: number) => {
    const pet = pets.find(p => p.id === petId)
    const emoji = PET_EMOJIS[pet?.pet_type ?? ''] ?? '🐾'
    setBattling(true)
    try {
      const res: PetBattleResult = await doPetBattle(petId)
      pendingResult.current = res
      setFightingPet({ emoji, petId })
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
      setBattling(false)
    }
  }

  const handleFightDone = () => {
    setFightingPet(null)
    setBattleResult(pendingResult.current)
    pendingResult.current = null
    setBattling(false)
    reload()
    onRefresh()
  }

  const handleFeed = async (petId: number, foodType: string) => {
    try {
      const res = await feedPet(petId, foodType)
      alert(res.message)
      reload()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    }
  }

  const handleRelease = async () => {
    if (!releaseConfirm) return
    try {
      const res = await releasePet(releaseConfirm.id)
      alert(res.message)
      setReleaseConfirm(null)
      reload()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
      setReleaseConfirm(null)
    }
  }

  const handleUpgrade = async (petId: number) => {
    try {
      const res = await upgradePet(petId)
      alert(`⬆️ ${res.name} прокачан до Lv.${res.level}! +3 сила, +1 к золоту.`)
      reload()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка прокачки')
    }
  }

  const handleBuyCrystals = async (amount: number) => {
    try {
      const res = await buyCrystals(amount)
      alert(res.message)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    }
  }

  const handleHatch = async (eggId: number) => {
    try {
      const res = await hatchEgg(eggId)
      alert(res.message)
      reload()
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка')
    }
  }

  // ── Анимация боя питомца ────────────────────────────────────────────────────
  if (fightingPet) {
    return <PetFightAnimation myEmoji={fightingPet.emoji} onDone={handleFightDone} />
  }

  if (loading) return <div style={styles.loading}>Загрузка питомцев...</div>

  return (
    <div style={styles.wrap}>
      {/* Подтверждение отпускания */}
      {releaseConfirm && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmBox}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💔</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Отпустить {releaseConfirm.name}?</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
              Питомец будет удалён навсегда. Это действие нельзя отменить.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleRelease} style={styles.confirmYes}>Отпустить</button>
              <button onClick={() => setReleaseConfirm(null)} style={styles.confirmNo}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.header}>
        🐾 Питомцы
        <span style={styles.crystalBadge}>💎 {userCrystals}</span>
      </div>

      {/* Вкладки */}
      <div style={styles.tabs}>
        <button
          onClick={() => setTab('pets')}
          style={{ ...styles.tab, ...(tab === 'pets' ? styles.tabActive : {}) }}
        >
          🐾 Мои питомцы {pets.length > 0 && `(${pets.length})`}
        </button>
        <button
          onClick={() => setTab('eggs')}
          style={{ ...styles.tab, ...(tab === 'eggs' ? styles.tabActive : {}) }}
        >
          🥚 Яйца {eggs.length > 0 && `(${eggs.length})`}
          {eggs.some(e => e.is_ready) && ' ✅'}
        </button>
      </div>

      {/* Результат боя */}
      {battleResult && tab === 'pets' && (
        <div style={{ ...styles.resultBox, background: battleResult.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>
          <div style={{ fontSize: 32, textAlign: 'center' }}>{battleResult.success ? '🏆' : '💀'}</div>
          <div style={{ textAlign: 'center', fontWeight: 700, color: battleResult.success ? '#4ade80' : '#f87171', marginBottom: 6 }}>
            {battleResult.message}
          </div>
          <div style={styles.resultStats}>
            <span>🐾 {battleResult.pet_power} VS 🤖 {battleResult.bot_power}</span>
            {battleResult.success && <span>⚡ +{battleResult.energy_gained} энергии!</span>}
            {(battleResult as any).crystal_earned > 0 && (
              <span style={{ color: '#a78bfa' }}>💎 +1 кристалл!</span>
            )}
          </div>
          <button onClick={() => setBattleResult(null)} style={styles.closeBtn}>Закрыть</button>
        </div>
      )}

      {/* Вкладка питомцев */}
      {tab === 'pets' && (
        <>
          {pets.length === 0 ? (
            <div style={styles.empty}>
              У тебя нет питомцев.<br />
              Купи яйцо в 🏪 Магазин → Питомцы и вылупи его!
            </div>
          ) : (
            pets.map(p => (
              <PetCard
                key={p.id}
                pet={p}
                userCoins={userCoins}
                userCrystals={userCrystals}
                foodList={foodList}
                onBattle={battling ? () => {} : handleBattle}
                onFeed={handleFeed}
                onRelease={(id, name) => setReleaseConfirm({ id, name })}
                onUpgrade={handleUpgrade}
              />
            ))
          )}
          <div style={styles.hint}>
            Победа в бою питомца = +1–20 ⚡ тебе · 10% шанс 💎 кристалл.<br />
            Голод 0% = питомец не даёт бонус к силе.
          </div>
          {/* Покупка кристаллов */}
          <div style={styles.crystalShop}>
            <div style={styles.crystalShopTitle}>💎 Кристаллы</div>
            <div style={styles.crystalShopHint}>500 💰 = 1 💎. Используй для прокачки питомцев.</div>
            <div style={styles.crystalBuyRow}>
              {[1, 3, 5].map(n => (
                <button
                  key={n}
                  onClick={() => handleBuyCrystals(n)}
                  disabled={userCoins < 500 * n}
                  style={{ ...styles.crystalBuyBtn, opacity: userCoins < 500 * n ? 0.4 : 1 }}
                >
                  +{n} 💎<br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{500 * n}💰</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Вкладка яиц */}
      {tab === 'eggs' && (
        <>
          {eggs.length === 0 ? (
            <div style={styles.empty}>
              Нет яиц. Купи в 🏪 Магазин → Питомцы!
            </div>
          ) : (
            eggs.map(egg => (
              <EggCard key={egg.id} egg={egg} onHatch={handleHatch} />
            ))
          )}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 12 },
  header: { fontWeight: 800, fontSize: 16, marginBottom: 10 },
  tabs: { display: 'flex', gap: 6, marginBottom: 12 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '7px 0', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  tabActive: { background: '#5865F2' },
  loading: { opacity: 0.6, fontSize: 13, textAlign: 'center', padding: 16 },
  empty: { opacity: 0.6, fontSize: 13, textAlign: 'center', padding: 20, lineHeight: 1.6 },
  petCard: {
    background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px',
    marginBottom: 10, border: '1px solid rgba(255,255,255,0.1)',
  },
  petTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  petEmoji: { fontSize: 32 },
  petName: { fontWeight: 700, fontSize: 15, marginBottom: 2 },
  petStats: { fontSize: 12, opacity: 0.7 },
  releaseBtn: {
    background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 8, padding: '4px 8px', color: '#f87171', cursor: 'pointer', fontSize: 14,
    alignSelf: 'flex-start',
  },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { fontSize: 12, minWidth: 90, whiteSpace: 'nowrap' as const },
  barTrack: { flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.3s' },
  barHint: { fontSize: 11, opacity: 0.55, whiteSpace: 'nowrap' as const },
  hungerBadge: { fontSize: 10, fontWeight: 700 },
  feedBtn: {
    width: '100%', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 8, padding: '6px 0', color: '#fbbf24', cursor: 'pointer', fontWeight: 600,
    fontSize: 13, marginBottom: 6,
  },
  foodPanel: { background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10, marginBottom: 6 },
  foodBtn: {
    display: 'block', width: '100%', background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 8, padding: '8px 10px', color: '#fff', cursor: 'pointer', fontSize: 13,
    textAlign: 'left' as const, marginBottom: 4,
  },
  foodDesc: { fontSize: 11, opacity: 0.6 },
  cancelFoodBtn: {
    display: 'block', width: '100%', background: 'none', border: 'none',
    color: '#9ca3af', cursor: 'pointer', fontSize: 12, marginTop: 4, padding: '4px 0',
  },
  battleBtn: {
    width: '100%', background: '#dc2626', border: 'none', borderRadius: 8,
    padding: '8px 0', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
  },
  cooldownText: { textAlign: 'center', fontSize: 12, opacity: 0.6, padding: '4px 0' },
  resultBox: { borderRadius: 12, padding: 14, marginBottom: 12 },
  resultStats: { display: 'flex', justifyContent: 'space-around', fontSize: 13, opacity: 0.8, marginBottom: 10 },
  closeBtn: {
    width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: 8, padding: '7px 0', color: '#fff', cursor: 'pointer', fontSize: 13,
  },
  hint: { fontSize: 11, opacity: 0.45, textAlign: 'center', lineHeight: 1.5, marginTop: 4 },
  crystalBadge: {
    float: 'right', background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
    borderRadius: 8, padding: '2px 8px', fontSize: 13, fontWeight: 700,
  },
  upgradeBtn: {
    width: '100%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 8, padding: '6px 0', color: '#a78bfa', cursor: 'pointer',
    fontWeight: 600, fontSize: 12, marginBottom: 6,
  },
  crystalShop: {
    background: 'rgba(167,139,250,0.08)', borderRadius: 12,
    padding: '12px 14px', marginTop: 12, border: '1px solid rgba(167,139,250,0.2)',
  },
  crystalShopTitle: { fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#a78bfa' },
  crystalShopHint: { fontSize: 11, opacity: 0.6, marginBottom: 10 },
  crystalBuyRow: { display: 'flex', gap: 8 },
  crystalBuyBtn: {
    flex: 1, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 10, padding: '8px 0', color: '#fff', cursor: 'pointer',
    fontWeight: 700, fontSize: 14, textAlign: 'center' as const, lineHeight: 1.6,
  },
  confirmOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  confirmBox: {
    background: '#1f2937', borderRadius: 16, padding: 24, maxWidth: 280,
    width: '90%', textAlign: 'center',
  },
  confirmYes: {
    flex: 1, background: '#dc2626', border: 'none', borderRadius: 10,
    padding: '9px 0', color: '#fff', cursor: 'pointer', fontWeight: 700,
  },
  confirmNo: {
    flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10,
    padding: '9px 0', color: '#fff', cursor: 'pointer',
  },
}
