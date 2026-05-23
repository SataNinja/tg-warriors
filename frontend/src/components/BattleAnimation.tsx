import { useEffect, useState } from 'react'

interface Props {
  attackerPower: number
  defenderPower: number
  isPve: boolean
  onComplete: () => void
}

// Чем ближе силы — тем дольше бой
function calcDuration(ap: number, dp: number): number {
  const diff = Math.abs(ap - dp)
  const maxPower = Math.max(ap, dp, 1)
  const ratio = diff / maxPower  // 0 (равные) → 1 (огромная разница)
  const base = 35_000
  const bonus = (1 - ratio) * 20_000  // равные силы +20с
  const jitter = (Math.random() - 0.5) * 10_000
  return Math.round(Math.max(30_000, Math.min(60_000, base + bonus + jitter)))
}

const PHASES = [
  { label: 'Бойцы занимают позиции...', emojis: ['⚔️', '🛡️', '💪', '😤'] },
  { label: 'Бой начался!', emojis: ['💥', '⚔️', '🗡️', '💢', '🔥'] },
  { label: 'Натиск усиливается...', emojis: ['💥', '⚡', '🔥', '💢', '❗'] },
  { label: 'Решающий удар!', emojis: ['💥', '💥', '⚔️', '✨', '🌪️'] },
]

export function BattleAnimation({ attackerPower, defenderPower, isPve, onComplete }: Props) {
  const [phase, setPhase] = useState(0)
  const [emojiBurst, setEmojiBurst] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [duration] = useState(() => calcDuration(attackerPower, defenderPower))

  // Прогресс-бар
  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / duration) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(interval)
        onComplete()
      }
    }, 100)
    return () => clearInterval(interval)
  }, [duration, onComplete])

  // Смена фаз
  useEffect(() => {
    const phaseInterval = duration / PHASES.length
    const timers = PHASES.map((_, i) =>
      setTimeout(() => setPhase(i), i * phaseInterval)
    )
    return () => timers.forEach(clearTimeout)
  }, [duration])

  // Случайные эмодзи каждые 800мс
  useEffect(() => {
    const interval = setInterval(() => {
      const pool = PHASES[phase]?.emojis ?? PHASES[1].emojis
      const burst = Array.from({ length: 3 + Math.floor(Math.random() * 3) },
        () => pool[Math.floor(Math.random() * pool.length)])
      setEmojiBurst(burst)
    }, 800)
    return () => clearInterval(interval)
  }, [phase])

  const secLeft = Math.ceil(((100 - progress) / 100) * duration / 1000)

  return (
    <div style={styles.wrap}>
      {/* Заголовок */}
      <div style={styles.title}>
        {isPve ? '🤖 PvE Бой' : '⚔️ PvP Рейд'}
      </div>

      {/* Силы */}
      <div style={styles.powers}>
        <div style={styles.side}>
          <div style={styles.emojiChar}>🧑‍⚔️</div>
          <div style={styles.powerVal}>{attackerPower}</div>
          <div style={styles.powerLabel}>Ты</div>
        </div>
        <div style={styles.vs}>VS</div>
        <div style={styles.side}>
          <div style={styles.emojiChar}>{isPve ? '🤖' : '👹'}</div>
          <div style={styles.powerVal}>{defenderPower}</div>
          <div style={styles.powerLabel}>{isPve ? 'Бот' : 'Враг'}</div>
        </div>
      </div>

      {/* Взрыв эмодзи */}
      <div style={styles.burst}>
        {emojiBurst.map((e, i) => (
          <span key={i} style={{ fontSize: 28 + i * 4, margin: '0 4px' }}>{e}</span>
        ))}
      </div>

      {/* Фаза */}
      <div style={styles.phaseText}>{PHASES[phase]?.label}</div>

      {/* Прогресс-бар */}
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${progress}%` }} />
      </div>
      <div style={styles.timer}>⏳ {secLeft} сек...</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: '20px 16px',
    textAlign: 'center',
    marginBottom: 12
  },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 16 },
  powers: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
  side: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  emojiChar: { fontSize: 36 },
  powerVal: { fontSize: 22, fontWeight: 800, color: '#FFD700' },
  powerLabel: { fontSize: 12, opacity: 0.6 },
  vs: { fontSize: 20, fontWeight: 900, color: '#f87171', padding: '0 8px' },
  burst: { minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  phaseText: { fontSize: 14, opacity: 0.8, marginBottom: 14, minHeight: 20 },
  track: { height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  fill: { height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: 4, transition: 'width 0.1s' },
  timer: { fontSize: 12, opacity: 0.5 }
}
