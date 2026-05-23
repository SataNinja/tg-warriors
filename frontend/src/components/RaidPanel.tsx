import { useState, useCallback } from 'react'
import { doRaid, doPveRaid } from '../api/client'
import { RaidResult, PveRaidResult } from '../types'
import { BattleAnimation } from './BattleAnimation'
import { BattleJournal } from './BattleJournal'

interface Props {
  energy: number
  onRaidDone: () => void
}

type Screen = 'menu' | 'animating' | 'result' | 'journal'
type Mode = 'pve' | 'pvp'

export function RaidPanel({ energy, onRaidDone }: Props) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('pve')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)

  // Данные текущего боя
  const [animData, setAnimData] = useState({ ap: 1, dp: 1, isPve: true })
  const [result, setResult] = useState<RaidResult | PveRaidResult | null>(null)

  const hasEnergy = energy >= 5

  const handleFight = async () => {
    setLoading(true)
    try {
      let res: RaidResult | PveRaidResult
      let ap = 0, dp = 0

      if (mode === 'pve') {
        res = await doPveRaid()
        const r = res as PveRaidResult
        ap = r.attacker_power; dp = r.bot_power
        setAnimData({ ap, dp, isPve: true })
      } else {
        const id = parseInt(targetId)
        if (!id) { alert('Введи корректный ID'); setLoading(false); return }
        res = await doRaid(id)
        const r = res as RaidResult
        ap = r.attacker_power; dp = r.defender_power
        setAnimData({ ap, dp, isPve: false })
      }

      setResult(res)
      setScreen('animating')
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка боя')
    } finally {
      setLoading(false)
    }
  }

  const handleAnimEnd = useCallback(() => {
    setScreen('result')
    onRaidDone()
  }, [onRaidDone])

  // Месть — запускаем PvP рейд на конкретного игрока
  const handleRevenge = async (opponentId: number) => {
    setLoading(true)
    try {
      const res = await doRaid(opponentId)
      const r = res as RaidResult
      setAnimData({ ap: r.attacker_power, dp: r.defender_power, isPve: false })
      setResult(res)
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
            <div style={styles.sub}>Твоя сила: {(result as RaidResult).attacker_power} / Враг: {(result as RaidResult).defender_power}</div>
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
        <button onClick={() => setScreen('journal')} style={styles.journalBtn}>📋 Журнал</button>
      </div>

      <div style={styles.modeTabs}>
        {(['pve', 'pvp'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ ...styles.modeTab, ...(mode === m ? styles.modeActive : {}) }}>
            {m === 'pve' ? '🤖 Бой с ботом' : '👤 PvP по ID'}
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
          <button onClick={handleFight} disabled={loading} style={styles.fightBtn}>
            {loading ? 'Запускаю...' : mode === 'pve' ? '⚔️ В бой!' : '🗡 Атаковать'}
          </button>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontWeight: 700, fontSize: 16 },
  journalBtn: {
    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
    padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: 13
  },
  modeTabs: { display: 'flex', gap: 6, marginBottom: 12 },
  modeTab: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none',
    borderRadius: 10, padding: '8px 0', color: '#fff', cursor: 'pointer', fontSize: 13
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
  // Результат
  resultBox: { borderRadius: 14, padding: '20px 16px', textAlign: 'center', marginBottom: 12 },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultMsg: { fontSize: 18, fontWeight: 800, marginBottom: 6 },
  sub: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  energy: { fontSize: 12, opacity: 0.5 },
  backBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
    padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 13
  }
}
