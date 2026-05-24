import { useState, useEffect, useRef } from 'react'
import { User, PetOut } from '../types'
import { setNickname, fetchPets } from '../api/client'

interface Props {
  user: User
  shieldActive: boolean
  energy: number
  maxEnergy: number
  energyRegenSeconds: number
  onRefresh: () => void
}

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    if (seconds <= 0) return
    const id = setInterval(() => setLeft(prev => (prev <= 1 ? 0 : prev - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  return left
}

function fmtSecs(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const CASTLE_EMOJIS: Record<number, string> = {
  1: '🏘', 2: '🏰', 3: '🏯', 4: '🗼', 5: '⚔️',
  6: '🐉', 7: '🛡', 8: '👑', 9: '🌟', 10: '💎',
  11: '⚡', 12: '🌙', 13: '🔮', 14: '🌊', 15: '🦅',
  16: '☄️', 17: '🌌', 18: '🪐', 19: '☀️', 20: '🌈',
}

// ── Тултип-инфо ─────────────────────────────────────────────────────────────
const TOOLTIP_W = 220
const TOOLTIP_PAD = 10

function InfoTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  // Координаты для position:fixed (вычисляются при открытии)
  const [coords, setCoords] = useState({ top: 0, left: 0, arrowLeft: '50%' })
  const ref = useRef<HTMLSpanElement>(null)

  // Закрывать при клике/тапе снаружи
  useEffect(() => {
    if (!show) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [show])

  const handleClick = () => {
    if (show) { setShow(false); return }

    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      const screenW = window.innerWidth
      const centerX = r.left + r.width / 2

      // Левый край тултипа если центрировать по элементу
      let left = centerX - TOOLTIP_W / 2

      // Не выходить за границы экрана
      if (left < TOOLTIP_PAD) left = TOOLTIP_PAD
      if (left + TOOLTIP_W > screenW - TOOLTIP_PAD) left = screenW - TOOLTIP_PAD - TOOLTIP_W

      // Стрелка указывает на исходный элемент
      const arrowPx = Math.max(12, Math.min(TOOLTIP_W - 12, centerX - left))
      const arrowLeft = `${arrowPx}px`

      // Тултип появляется над элементом (8px зазор)
      const top = r.top - 8

      setCoords({ top, left, arrowLeft })
    }
    setShow(true)
  }

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span onClick={handleClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {children}
      </span>
      {show && (
        <span style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          transform: 'translateY(-100%)',
          width: TOOLTIP_W,
          background: 'rgba(15,15,25,0.97)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 12,
          color: '#e2e8f0',
          whiteSpace: 'pre-line',
          lineHeight: 1.6,
          zIndex: 9999,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          pointerEvents: 'none',
        }}>
          {text}
          {/* Стрелка вниз — над элементом */}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: coords.arrowLeft,
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(255,255,255,0.15)',
          }} />
        </span>
      )}
    </span>
  )
}

export function Profile({ user, shieldActive, energy, maxEnergy, energyRegenSeconds, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)
  const [newNick, setNewNick] = useState(user.nickname ?? '')
  const [loading, setLoading] = useState(false)
  const [bestPet, setBestPet] = useState<PetOut | null>(null)
  const regenLeft = useCountdown(energyRegenSeconds)

  useEffect(() => {
    fetchPets()
      .then((pets: PetOut[]) => {
        if (!pets.length) return
        const best = pets.reduce((a, b) =>
          (a.effective_power_bonus + a.gold_bonus) >= (b.effective_power_bonus + b.gold_bonus) ? a : b
        )
        setBestPet(best)
      })
      .catch(() => {/* тихо */})
  }, [])

  const displayName = user.nickname || user.first_name
  const energyPct = (energy / maxEnergy) * 100
  const energyColor = energyPct > 50 ? '#4ade80' : energyPct > 20 ? '#fbbf24' : '#f87171'

  const handleSaveNick = async () => {
    setLoading(true)
    try {
      await setNickname(newNick)
      setEditing(false)
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка смены никнейма')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      {/* Имя + ID */}
      <div style={styles.row}>
        <div>
          {editing ? (
            <div style={styles.editRow}>
              <input
                value={newNick}
                onChange={e => setNewNick(e.target.value)}
                maxLength={20}
                style={styles.input}
                placeholder="Никнейм (3-20 симв.)"
              />
              <button onClick={handleSaveNick} disabled={loading} style={styles.saveBtn}
                title={user.nickname ? 'Стоит 100 💰' : 'Бесплатно'}>
                {loading ? '...' : user.nickname ? '✓ 100💰' : '✓ Free'}
              </button>
              <button onClick={() => setEditing(false)} style={styles.cancelBtn}>✕</button>
            </div>
          ) : (
            <div style={styles.nameRow}>
              <span style={styles.name}>{displayName}</span>
              <button onClick={() => setEditing(true)} style={styles.editBtn}
                title={user.nickname ? 'Сменить никнейм (100 💰)' : 'Установить никнейм (бесплатно)'}>
                ✏️
              </button>
            </div>
          )}
          <div style={styles.userId}>ID: {user.id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <InfoTooltip text={"💰 Монеты\nОсновная валюта. Нанимай юнитов, покупай оружие и щит. Зарабатывай в боях и ежедневно."}>
            <div style={styles.coins}>💰 {user.coins.toLocaleString()}</div>
          </InfoTooltip>
          <div style={styles.iron}>
            <InfoTooltip text={"🔩 Железо\nРесурс для прокачки оружия. Добывается за победы в боях."}>
              <span>🔩 {user.iron}</span>
            </InfoTooltip>
            {user.crystals >= 0 && (
              <InfoTooltip text={"💎 Кристаллы\nПремиум-валюта. Прокачивай питомцев! Зарабатываются за серии побед, 7-й день daily и бой питомцев."}>
                <span> · 💎 {user.crystals}</span>
              </InfoTooltip>
            )}
          </div>
        </div>
      </div>

      {/* Замок + серия побед */}
      <div style={styles.statsRow}>
        <InfoTooltip text={`🏰 Замок уровня ${user.castle_level}\nОпределяет лимит юнитов и питомцев, бонус к доходу от боёв. Улучшай в 🏪 Лавка.`}>
          <span style={styles.stat}>
            {CASTLE_EMOJIS[user.castle_level] ?? '🏰'} Замок {user.castle_level}
          </span>
        </InfoTooltip>
        {user.win_streak >= 3 && (
          <InfoTooltip text={`🔥 Серия побед: ${user.win_streak}\nКаждые 3 победы — +50 монет\nКаждые 10 побед — +1 кристалл 💎`}>
            <span style={{ ...styles.stat, color: '#f59e0b' }}>
              🔥 Серия: {user.win_streak}
            </span>
          </InfoTooltip>
        )}
        <InfoTooltip text={`⚔️ ${user.units.length} юнит(ов)\nЮниты — твоя армия. Сила определяет исход боёв.\nПокупай в ⚔️ Войска.`}>
          <span style={styles.stat}>⚔️ Юнитов: {user.units.length}</span>
        </InfoTooltip>
        {bestPet && (
          <InfoTooltip text={`🐾 Лучший питомец: ${bestPet.name}\nСила: +${bestPet.effective_power_bonus}\nЗолото: +${bestPet.gold_bonus}%\nУправляй в 🐾 Питомник.`}>
            <span style={{ ...styles.stat, color: '#c084fc' }}>
              {bestPet.name} ⭐
            </span>
          </InfoTooltip>
        )}
      </div>

      {/* Энергия с таймером */}
      <div style={styles.energySection}>
        <div style={styles.energyLabel}>
          ⚡ Энергия: {energy}/{maxEnergy}
          {energy < maxEnergy && regenLeft > 0 && (
            <span style={styles.regenHint}> (+1 через {fmtSecs(regenLeft)})</span>
          )}
          {energy >= maxEnergy && <span style={{ color: '#4ade80', fontSize: 11 }}> Полная!</span>}
        </div>
        <div style={styles.energyTrack}>
          <div style={{ ...styles.energyFill, width: `${energyPct}%`, background: energyColor }} />
        </div>
      </div>

      {/* Щит */}
      <div style={styles.shield}>
        {shieldActive && user.shield_until
          ? `🛡 Щит активен до ${new Date(user.shield_until).toLocaleTimeString('ru')}`
          : '🔓 Без защиты'}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, fontWeight: 700 },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  userId: { fontSize: 11, opacity: 0.4, marginTop: 2 },
  coins: { fontSize: 18, fontWeight: 800, color: '#FFD700' },
  iron: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  editRow: { display: 'flex', gap: 4, alignItems: 'center' },
  input: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 8,
    padding: '4px 8px',
    color: '#fff',
    fontSize: 13,
    width: 150
  },
  saveBtn: { background: '#059669', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer' },
  cancelBtn: { background: '#374151', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer' },
  statsRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  stat: { fontSize: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 8px' },
  energySection: { marginBottom: 6 },
  energyLabel: { fontSize: 12, marginBottom: 4 },
  regenHint: { opacity: 0.5, fontSize: 11 },
  energyTrack: { height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  energyFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  shield: { fontSize: 12, opacity: 0.65, marginTop: 4 },
}
