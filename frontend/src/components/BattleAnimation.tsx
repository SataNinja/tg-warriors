import { useEffect, useState, useRef } from 'react'

interface Props {
  attackerPower: number
  defenderPower: number
  isPve: boolean
  attackerCastleLevel?: number
  defenderCastleLevel?: number
  onComplete: () => void
  /** Если бой восстанавливается после смены вкладки — передаём время старта и длину */
  startedAt?: number
  forcedDuration?: number
  /** Эмодзи юнитов атакующего (из реальной армии игрока) */
  attackerEmojis?: string[]
}

const CASTLE_EMOJIS: Record<number, string> = {
  1: '🏘', 2: '🏰', 3: '🏯', 4: '🗼', 5: '⚔️',
  6: '🐉', 7: '🛡️', 8: '👑', 9: '🌟', 10: '💎',
  11: '⚡', 12: '🌙', 13: '🔮', 14: '🌊', 15: '🦅',
  16: '☄️', 17: '🌌', 18: '🪐', 19: '☀️', 20: '🌈',
}

const ATTACKER_UNITS = ['🧑‍⚔️', '⚔️', '🏹', '🗡️', '💪']
const DEFENDER_UNITS = ['👹', '🤺', '🗡️', '🏹', '😤']
const BOT_UNITS      = ['🤖', '⚙️', '🔩', '💻', '🤖']
const CLASH_EMOJIS   = ['💥', '✨', '🔥', '⚡', '💢', '🌪️']

function calcDuration(ap: number, dp: number): number {
  const diff = Math.abs(ap - dp)
  const maxPower = Math.max(ap, dp, 1)
  const ratio = diff / maxPower
  const base = 40_000
  const bonus = (1 - ratio) * 20_000
  const jitter = (Math.random() - 0.5) * 8_000
  return Math.round(Math.max(30_000, Math.min(60_000, base + bonus + jitter)))
}

interface Soldier {
  id: number
  emoji: string
  side: 'attacker' | 'defender'
  x: number
  y: number
}

interface Clash {
  id: number
  emoji: string
  x: number
  y: number
}

const PHASES = [
  'Армии выдвигаются...',
  'Первая волна атаки!',
  'Битва в разгаре!',
  'Решающий штурм!',
]

export function BattleAnimation({
  attackerPower, defenderPower, isPve,
  attackerCastleLevel = 1, defenderCastleLevel = 1,
  onComplete,
  startedAt,
  forcedDuration,
  attackerEmojis,
}: Props) {
  // Если восстанавливаем бой — считаем начальный прогресс
  const dur = useRef(forcedDuration ?? calcDuration(attackerPower, defenderPower))
  const initProgress = startedAt
    ? Math.min(99, ((Date.now() - startedAt) / dur.current) * 100)
    : 0
  const [progress, setProgress] = useState(initProgress)
  const [phase, setPhase] = useState(Math.min(3, Math.floor(initProgress / 25)))
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [clashes, setClashes] = useState<Clash[]>([])
  const soldierIdRef = useRef(0)
  const clashIdRef = useRef(0)

  const atkCastle = CASTLE_EMOJIS[attackerCastleLevel] ?? '🏘'
  const defCastle = isPve ? '🤖' : (CASTLE_EMOJIS[defenderCastleLevel] ?? '🏘')
  const defPool = isPve ? BOT_UNITS : DEFENDER_UNITS
  // Если переданы реальные эмодзи армии — используем их, иначе дефолтный пул
  const atkPool = (attackerEmojis && attackerEmojis.length > 0) ? attackerEmojis : ATTACKER_UNITS

  // Прогресс-бар (учитывает восстановление — стартует от реального времени)
  useEffect(() => {
    const origin = startedAt ?? Date.now()
    const id = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - origin) / dur.current) * 100)
      setProgress(pct)
      setPhase(Math.min(3, Math.floor(pct / 25)))
      if (pct >= 100) { clearInterval(id); onComplete() }
    }, 100)
    return () => clearInterval(id)
  }, [onComplete, startedAt])

  // Спавн солдат
  useEffect(() => {
    const id = setInterval(() => {
      const isAtk = Math.random() > 0.45
      const pool = isAtk ? atkPool : defPool
      setSoldiers(prev => [
        ...prev.slice(-14),
        {
          id: soldierIdRef.current++,
          emoji: pool[Math.floor(Math.random() * pool.length)],
          side: isAtk ? 'attacker' : 'defender',
          x: isAtk ? 2 + Math.random() * 20 : 78 + Math.random() * 20,
          y: 10 + Math.random() * 60,
        }
      ])
    }, 1200)
    return () => clearInterval(id)
  }, [defPool])

  // Движение + столкновения
  useEffect(() => {
    const id = setInterval(() => {
      setSoldiers(prev => {
        const moved = prev.map(s => ({
          ...s,
          x: s.side === 'attacker'
            ? Math.min(s.x + 3, 50)
            : Math.max(s.x - 3, 50),
        }))

        const atkrs = moved.filter(s => s.side === 'attacker' && s.x >= 46)
        const defrs = moved.filter(s => s.side === 'defender' && s.x <= 54)

        if (atkrs.length && defrs.length) {
          const clash: Clash = {
            id: clashIdRef.current++,
            emoji: CLASH_EMOJIS[Math.floor(Math.random() * CLASH_EMOJIS.length)],
            x: 42 + Math.random() * 16,
            y: 10 + Math.random() * 70,
          }
          setClashes(c => [...c.slice(-6), clash])
          const rmAtk = atkrs[0].id
          const rmDef = defrs[0].id
          return moved.filter(s => s.id !== rmAtk && s.id !== rmDef)
        }
        return moved
      })
    }, 280)
    return () => clearInterval(id)
  }, [])

  // Убираем вспышки
  useEffect(() => {
    if (!clashes.length) return
    const id = setTimeout(() => setClashes([]), 500)
    return () => clearTimeout(id)
  }, [clashes])

  const secLeft = Math.max(0, Math.ceil(((100 - progress) / 100) * dur.current / 1000))

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>{isPve ? '🤖 PvE Бой' : '⚔️ PvP Рейд'}</div>

      {/* Замки */}
      <div style={styles.castleRow}>
        <div style={styles.castle}>
          <div style={styles.castleEmoji}>{defCastle}</div>
          <div style={styles.castleLabel}>{isPve ? 'Бот' : 'Противник'}</div>
          <div style={styles.powerVal}>⚔️ {defenderPower}</div>
        </div>
        <div style={styles.vs}>VS</div>
        <div style={styles.castle}>
          <div style={styles.castleEmoji}>{atkCastle}</div>
          <div style={styles.castleLabel}>Ты</div>
          <div style={styles.powerVal}>⚔️ {attackerPower}</div>
        </div>
      </div>

      {/* Поле боя */}
      <div style={styles.field}>
        {/* Линия фронта */}
        <div style={styles.frontLine} />

        {soldiers.map(s => (
          <span
            key={s.id}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              fontSize: 20,
              transform: s.side === 'defender' ? 'scaleX(-1)' : 'none',
              transition: 'left 0.28s linear',
              lineHeight: 1,
            }}
          >
            {s.emoji}
          </span>
        ))}

        {clashes.map(c => (
          <span
            key={c.id}
            style={{
              position: 'absolute',
              left: `${c.x}%`,
              top: `${c.y}%`,
              fontSize: 26,
              zIndex: 2,
              animation: 'none',
            }}
          >
            {c.emoji}
          </span>
        ))}
      </div>

      <div style={styles.phase}>{PHASES[phase]}</div>

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
    padding: '16px 14px',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: 800, textAlign: 'center', marginBottom: 10 },
  castleRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '0 12px', marginBottom: 8,
  },
  castle: { textAlign: 'center', minWidth: 70 },
  castleEmoji: { fontSize: 44 },
  castleLabel: { fontSize: 11, opacity: 0.5 },
  powerVal: { fontSize: 12, color: '#FFD700', fontWeight: 700, marginTop: 2 },
  vs: { fontSize: 20, fontWeight: 900, color: '#f87171' },
  field: {
    height: 100,
    background: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  frontLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.08)',
    transform: 'translateX(-50%)',
  },
  phase: { textAlign: 'center', fontSize: 13, opacity: 0.8, minHeight: 18, marginBottom: 10 },
  track: {
    height: 8, background: 'rgba(255,255,255,0.1)',
    borderRadius: 4, overflow: 'hidden', marginBottom: 5,
  },
  fill: {
    height: '100%',
    background: 'linear-gradient(90deg, #dc2626, #f59e0b)',
    borderRadius: 4,
    transition: 'width 0.1s',
  },
  timer: { fontSize: 12, opacity: 0.5, textAlign: 'center' },
}
