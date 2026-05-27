import { useState, useCallback, useEffect } from 'react'
import { doRaid, doPveRaid, doRandomRaid } from '../api/client'
import { RaidResult, PveRaidResult } from '../types'
import { BattleAnimation } from './BattleAnimation'
import { BattleJournal } from './BattleJournal'
import { useGameStore, OngoingBattle } from '../store/gameStore'
import { sfxWin, sfxLose } from '../utils/sounds'

interface Props {
  energy: number
  onRaidDone: () => void
  attackerEmojis?: string[]   // эмодзи юнитов игрока для анимации
}

type Screen = 'menu' | 'animating' | 'result' | 'journal'
type Mode = 'pve' | 'random' | 'pvp'

function calcDuration(ap: number, dp: number): number {
  const diff = Math.abs(ap - dp)
  const maxPower = Math.max(ap, dp, 1)
  const ratio = diff / maxPower
  const base = 40_000
  const bonus = (1 - ratio) * 20_000
  const jitter = (Math.random() - 0.5) * 8_000
  return Math.round(Math.max(30_000, Math.min(60_000, base + bonus + jitter)))
}

export function RaidPanel({ energy, onRaidDone, attackerEmojis }: Props) {
  const { ongoingBattle, setOngoingBattle } = useGameStore()

  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('pve')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)

  const [animData, setAnimData] = useState({ ap: 1, dp: 1, isPve: true })
  const [result, setResult] = useState<RaidResult | PveRaidResult | null>(null)
  // Для восстановления анимации после смены вкладки
  const [battleMeta, setBattleMeta] = useState<{ startedAt: number; duration: number } | null>(null)

  const hasEnergy = energy >= 5

  // ── Восстановление боя после смены вкладки ──────────────────────────────────
  useEffect(() => {
    if (!ongoingBattle) return
    const elapsed = Date.now() - ongoingBattle.startedAt
    if (elapsed >= ongoingBattle.duration) {
      // Анимация уже должна была закончиться — показываем результат сразу
      setResult(ongoingBattle.result)
      setAnimData(ongoingBattle.animData)
      setScreen('result')
      setOngoingBattle(null)
      onRaidDone()
    } else {
      // Продолжаем анимацию с нужного момента
      setResult(ongoingBattle.result)
      setAnimData(ongoingBattle.animData)
      setBattleMeta({ startedAt: ongoingBattle.startedAt, duration: ongoingBattle.duration })
      setScreen('animating')
    }
  // Только при монтировании
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFight = async () => {
    setLoading(true)
    try {
      let res: RaidResult | PveRaidResult
      let ap = 0, dp = 0, isPve = true

      if (mode === 'pve') {
        res = await doPveRaid()
        const r = res as PveRaidResult
        ap = r.attacker_power; dp = r.bot_power; isPve = true
      } else if (mode === 'random') {
        res = await doRandomRaid()
        const r = res as RaidResult
        ap = r.attacker_power; dp = r.defender_power; isPve = false
      } else {
        const id = parseInt(targetId)
        if (!id) { alert('Введи корректный ID'); setLoading(false); return }
        res = await doRaid(id)
        const r = res as RaidResult
        ap = r.attacker_power; dp = r.defender_power; isPve = false
      }

      const duration = calcDuration(ap, dp)
      const startedAt = Date.now()
      const aData = { ap, dp, isPve }

      // Сохраняем в store — бой переживёт смену вкладки
      const battle: OngoingBattle = { result: res, animData: aData, startedAt, duration }
      setOngoingBattle(battle)

      setResult(res)
      setAnimData(aData)
      setBattleMeta({ startedAt, duration })
      setScreen('animating')
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка боя')
    } finally {
      setLoading(false)
    }
  }

  const handleAnimEnd = useCallback(() => {
    setOngoingBattle(null)
    setBattleMeta(null)
    setScreen('result')
    onRaidDone()
    // Звук по результату (result уже записан в state через setResult)
  }, [onRaidDone, setOngoingBattle])

  // Звук при переходе на экран результата
  useEffect(() => {
    if (screen === 'result' && result) {
      if (result.success) sfxWin()
      else sfxLose()
    }
  }, [screen, result])

  // Месть — запускаем PvP рейд на конкретного игрока
  const handleRevenge = async (opponentId: number) => {
    setLoading(true)
    try {
      const res = await doRaid(opponentId)
      const r = res as RaidResult
      const duration = calcDuration(r.attacker_power, r.defender_power)
      const startedAt = Date.now()
      const aData = { ap: r.attacker_power, dp: r.defender_power, isPve: false }

      const battle: OngoingBattle = { result: res, animData: aData, startedAt, duration }
      setOngoingBattle(battle)

      setResult(res)
      setAnimData(aData)
      setBattleMeta({ startedAt, duration })
      setScreen('animating')
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка мести')
    } finally {
      setLoading(false)
    }
  }

  const isPveResult = (r: RaidResult | PveRaidResult): r is PveRaidResult => 'bot_power' in r

  // ── Анимация ──────────────────────────────────────────────────────────────
  if (screen === 'animating') {
    return (
      <BattleAnimation
        attackerPower={animData.ap}
        defenderPower={animData.dp}
        isPve={animData.isPve}
        onComplete={handleAnimEnd}
        startedAt={battleMeta?.startedAt}
        forcedDuration={battleMeta?.duration}
        attackerEmojis={attackerEmojis}
      />
    )
  }

  // ── Результат ─────────────────────────────────────────────────────────────
  if (screen === 'result' && result) {
    const win = result.success
    return (
      <div style={styles.card}>
        <div style={{ ...styles.resultBox, background: win ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>
          <div style={styles.resultIcon}>{win ? '🏆' : '💀'}</div>
          <div style={{ ...styles.resultMsg, color: win ? '#4ade80' : '#f87171' }}>
            {result.message}
          </div>
          {isPveResult(result) ? (
            <div style={styles.sub}>Твоя сила: {result.attacker_power} / Бот: {result.bot_power}</div>
          ) : (
            <>
              {(result as RaidResult).opponent_name && (
                <div style={{ ...styles.sub, fontWeight: 600, marginBottom: 2 }}>
                  vs {(result as RaidResult).opponent_name}
                </div>
              )}
              <div style={styles.sub}>Твоя сила: {(result as RaidResult).attacker_power} / Враг: {(result as RaidResult).defender_power}</div>
            </>
          )}
          <div style={styles.energy}>⚡ Энергия: {result.energy_left}/50</div>
        </div>
        <button onClick={() => setScreen('menu')} style={styles.backBtn}>← Назад к бою</button>
      </div>
    )
  }

  // ── Журнал ────────────────────────────────────────────────────────────────
  if (screen === 'journal') {
    return (
      <div style={styles.card}>
        <button onClick={() => setScreen('menu')} style={styles.backBtn}>← Назад к бою</button>
        <div style={{ marginTop: 12 }}>
          <BattleJournal onRevenge={(id) => { setScreen('menu'); handleRevenge(id) }} />
        </div>
      </div>
    )
  }

  // ── Меню ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.title}>⚔️ Бой</div>
      </div>

      <div style={styles.modeTabs}>
        {([
          { key: 'pve',    label: '🤖 Бот' },
          { key: 'random', label: '🎲 Случайный' },
          { key: 'pvp',    label: '👤 По ID' },
        ] as { key: Mode; label: string }[]).map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{ ...styles.modeTab, ...(mode === m.key ? styles.modeActive : {}) }}>
            {m.label}
          </button>
        ))}
      </div>

      {!hasEnergy && (
        <div style={styles.warn}>⚡ Нет энергии (нужно 5). Восстанавливается +1 каждые 6 минут.</div>
      )}

      {hasEnergy && (
        <>
          {mode === 'pvp' && (
            <input
              type="number"
              placeholder="Telegram ID противника"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              style={styles.input}
            />
          )}
          {mode === 'pve' && (
            <div style={styles.hint}>Стоит 5 ⚡. Противник ±30% от твоей силы. Анимация 30-60 сек.</div>
          )}
          {mode === 'random' && (
            <div style={styles.hint}>
              🎲 Стоит 5 ⚡. Матчмейкинг: ищем соперника с похожей силой (±30%) и уровнем замка (±3).
            </div>
          )}
          <button onClick={handleFight} disabled={loading} style={styles.fightBtn}>
            {loading
              ? (mode === 'random' ? '🔍 Ищем соперника...' : 'Запускаю...')
              : mode === 'pve' ? '⚔️ В бой!'
              : mode === 'random' ? '🎲 Найти и атаковать!'
              : '🗡 Атаковать'}
          </button>
        </>
      )}

      <button onClick={() => setScreen('journal')} style={styles.journalBtn}>
        📋 История боёв и месть
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontWeight: 700, fontSize: 16 },
  journalBtn: {
    width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, padding: '10px 0', color: '#fff', cursor: 'pointer', fontSize: 14,
    marginTop: 10, fontWeight: 600,
  },
  modeTabs: { display: 'flex', gap: 6, marginBottom: 12 },
  modeTab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '8px 0', color: '#fff', cursor: 'pointer', fontSize: 12,
  },
  modeActive: { background: '#5865F2' },
  warn: { color: '#fbbf24', fontSize: 13, marginBottom: 8 },
  hint: { fontSize: 12, opacity: 0.6, marginBottom: 10 },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
    padding: '9px 12px', color: '#fff', fontSize: 14, marginBottom: 8,
    boxSizing: 'border-box' as const
  },
  fightBtn: {
    width: '100%', background: '#dc2626', border: 'none', borderRadius: 12,
    padding: 13, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 15
  },
  resultBox: { borderRadius: 14, padding: '20px 16px', textAlign: 'center' as const, marginBottom: 12 },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultMsg: { fontSize: 18, fontWeight: 800, marginBottom: 6 },
  sub: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  energy: { fontSize: 12, opacity: 0.5 },
  backBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
    padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 13
  }
}
