import { useState, useEffect, useCallback } from 'react'
import {
  fetchClanList, fetchMyClan, createClan, joinClan, leaveClan,
  contributeToTreasury, buyWarItem, fetchWarItems, fetchWarStatus,
  prepareForWar, setWarParticipation, startClanWar, setMemberRole,
  ClanInfo, ClanListItem, WarItemInfo, WarStatus, WarBattle,
} from '../api/client'
import { GameLauncher } from './warGames/GameLauncher'

// ── Константы ─────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  leader: '👑 Лидер',
  officer: '⚔️ Офицер',
  member: '🛡 Участник',
}

const PRESET_RANKS = [
  'Новобранец', 'Воин', 'Ветеран', 'Рыцарь', 'Паладин',
  'Чемпион', 'Легенда', 'Хранитель', 'Берсеркер', 'Маршал',
]

const GAME_EMOJI: Record<string, string> = {
  reaction: '⚡',
  math: '🧮',
  memory: '🧠',
  aim: '🎯',
}

const WAR_ITEM_EMOJI: Record<string, string> = {
  attack: '⚔️',
  defense: '🛡',
  artifact: '🔮',
  provisions: '🍖',
}

// ── ClanPanel ─────────────────────────────────────────────────────────────────

interface Props {
  userId: number
  userCoins: number
  onRefresh?: () => void
}

type View = 'home' | 'list' | 'create' | 'mine'

export function ClanPanel({ userId, userCoins, onRefresh }: Props) {
  const [view, setView] = useState<View>('home')
  const [myClan, setMyClan] = useState<ClanInfo | null | undefined>(undefined)
  const [clanList, setClanList] = useState<ClanListItem[]>([])
  const [warItems, setWarItems] = useState<WarItemInfo[]>([])
  const [warStatus, setWarStatus] = useState<WarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // create form
  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cEmblem, setCEmblem] = useState('⚔️')
  const [contributeAmt, setContributeAmt] = useState(100)

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    try {
      const clan = await fetchMyClan()
      setMyClan(clan)
      if (clan) {
        const [items, status] = await Promise.all([fetchWarItems(), fetchWarStatus()])
        setWarItems(items)
        setWarStatus(status)
        setView('mine')
      } else {
        setView('home')
      }
    } catch {
      setMyClan(null)
      setView('home')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleLoadList = async () => {
    setBusy(true)
    try { const list = await fetchClanList(); setClanList(list); setView('list') }
    catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleCreate = async () => {
    if (cName.trim().length < 2) { notify('Имя клана минимум 2 символа', false); return }
    setBusy(true)
    try {
      await createClan(cName.trim(), cDesc.trim(), cEmblem || '⚔️')
      notify('✅ Клан создан!')
      onRefresh?.()
      await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleJoin = async (clanId: number, name: string) => {
    setBusy(true)
    try {
      await joinClan(clanId)
      notify(`✅ Добро пожаловать в «${name}»!`)
      onRefresh?.()
      await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleLeave = async () => {
    if (!confirm('Покинуть клан?')) return
    setBusy(true)
    try {
      await leaveClan()
      notify('Ты покинул клан')
      setMyClan(null); onRefresh?.(); setView('home')
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleContribute = async () => {
    if (contributeAmt > userCoins) { notify('Недостаточно монет', false); return }
    setBusy(true)
    try {
      const res = await contributeToTreasury(contributeAmt)
      notify(`+${res.donated} 💰 в казну`)
      onRefresh?.(); await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleBuyWarItem = async (type: string, name: string) => {
    if (!confirm(`Купить «${name}» из казны?`)) return
    setBusy(true)
    try {
      const res = await buyWarItem(type)
      notify(res.message)
      onRefresh?.(); await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handlePrepare = async () => {
    setBusy(true)
    try {
      const res = await prepareForWar()
      notify(res.message)
      await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleParticipate = async (participating: boolean) => {
    setBusy(true)
    try {
      const res = await setWarParticipation(participating)
      notify(res.message)
      await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  const handleStartWar = async () => {
    if (!confirm('Начать клановую войну? Система подберёт соперника и создаст пары.')) return
    setBusy(true)
    try {
      const res = await startClanWar()
      notify(res.message)
      await loadData()
    } catch (e: any) { notify(e?.response?.data?.detail ?? 'Ошибка', false) }
    finally { setBusy(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Загрузка...</div>

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
          borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13,
          zIndex: 999, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* Нет клана */}
      {view === 'home' && (
        <div>
          <div style={s.h1}>⚔️ Кланы</div>
          <div style={s.hint}>Объединяйся с другими игроками, укрепляй казну и сражайся в клановых войнах.</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button onClick={handleLoadList} disabled={busy} style={{ ...s.btn('#3b82f6'), flex: 1 }}>🔍 Найти клан</button>
            <button onClick={() => setView('create')} style={{ ...s.btn('#a855f7'), flex: 1 }}>✨ Создать</button>
          </div>
          <div style={s.card}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>💡 Как это работает</div>
            {[
              ['⚔️', 'Создание клана стоит 500 монет'],
              ['💰', 'Члены клана пополняют казну'],
              ['🛡', 'Лидер покупает усиления перед войной'],
              ['🏆', 'Побеждайте в войнах для роста рейтинга'],
            ].map(([e, t]) => (
              <div key={t} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 5, opacity: 0.8 }}>
                <span>{e}</span><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Создать клан */}
      {view === 'create' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setView('home')} style={s.back}>← Назад</button>
            <div style={s.h1}>✨ Создать клан</div>
          </div>
          <div style={s.card}>
            <div style={s.label}>Эмблема</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {['⚔️','🛡','🔮','👑','🐉','🦅','🌟','💎','🔥','🌊','⚡','🌙'].map(em => (
                <button key={em} onClick={() => setCEmblem(em)} style={{
                  fontSize: 22, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                  background: cEmblem === em ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${cEmblem === em ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
                }}>{em}</button>
              ))}
            </div>
            <div style={s.label}>Название *</div>
            <input value={cName} onChange={e => setCName(e.target.value)} maxLength={32}
              placeholder="Минимум 2 символа" style={s.input} />
            <div style={s.label}>Описание</div>
            <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} maxLength={256}
              placeholder="Расскажи о клане..." style={{ ...s.input, height: 72, resize: 'none' }} />
            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 12 }}>
              Стоимость: <b style={{ color: '#fbbf24' }}>500 💰</b> · Твой баланс: {userCoins.toLocaleString()} 💰
            </div>
            <button onClick={handleCreate} disabled={busy || cName.trim().length < 2} style={s.btn('#a855f7')}>
              {busy ? '...' : `${cEmblem} Создать клан`}
            </button>
          </div>
        </div>
      )}

      {/* Список кланов */}
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setView('home')} style={s.back}>← Назад</button>
            <div style={s.h1}>🔍 Кланы</div>
          </div>
          {clanList.length === 0
            ? <div style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>Кланов пока нет</div>
            : clanList.map(clan => (
              <div key={clan.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{clan.emblem}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {clan.name}
                    {clan.war_stage === 1 && <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 6, padding: '1px 6px', color: '#fbbf24' }}>Готов к войне</span>}
                    {clan.war_stage === 2 && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '1px 6px', color: '#f87171' }}>В войне</span>}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    👥 {clan.members_count} · 💥 {clan.total_power.toLocaleString()} · 🏆 {clan.wins}
                  </div>
                </div>
                <button onClick={() => handleJoin(clan.id, clan.name)} disabled={busy}
                  style={{ ...s.btnSmall('#3b82f6'), flexShrink: 0 }}>
                  Вступить
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* Мой клан */}
      {view === 'mine' && myClan && (
        <MyClanView
          clan={myClan}
          userId={userId}
          userCoins={userCoins}
          warItems={warItems}
          warStatus={warStatus}
          busy={busy}
          contributeAmt={contributeAmt}
          onContributeAmtChange={setContributeAmt}
          onContribute={handleContribute}
          onBuyWarItem={handleBuyWarItem}
          onLeave={handleLeave}
          onPrepare={handlePrepare}
          onParticipate={handleParticipate}
          onStartWar={handleStartWar}
          onWarDone={loadData}
          notify={notify}
        />
      )}
    </div>
  )
}

// ── Мой клан ─────────────────────────────────────────────────────────────────

interface MyClanProps {
  clan: ClanInfo
  userId: number
  userCoins: number
  warItems: WarItemInfo[]
  warStatus: WarStatus | null
  busy: boolean
  contributeAmt: number
  onContributeAmtChange: (v: number) => void
  onContribute: () => void
  onBuyWarItem: (type: string, name: string) => void
  onLeave: () => void
  onPrepare: () => void
  onParticipate: (v: boolean) => void
  onStartWar: () => void
  onWarDone: () => void
  notify: (msg: string, ok?: boolean) => void
}

type Section = 'members' | 'treasury' | 'war'

function MyClanView(p: MyClanProps) {
  const { clan, userId, warItems, warStatus, busy } = p
  const isLeader = clan.leader_id === userId
  const myRole = clan.members.find(m => m.user_id === userId)?.role ?? 'member'
  const canManage = myRole === 'leader' || myRole === 'officer'

  const [section, setSection] = useState<Section>('members')
  const [activeBattle, setActiveBattle] = useState<WarBattle | null>(null)
  const [rankTarget, setRankTarget] = useState<number | null>(null) // user_id редактируемого

  return (
    <div>
      {/* Шапка */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(88,28,135,0.3),rgba(30,27,75,0.3))',
        border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: 16, padding: '14px 14px 12px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 38 }}>{clan.emblem}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{clan.name}</div>
            {clan.description && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{clan.description}</div>}
          </div>
          {clan.war_stage === 1 && <span style={warBadge('#fbbf24')}>⚔️ Подготовка</span>}
          {clan.war_stage === 2 && <span style={warBadge('#f87171')}>⚔️ Война!</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { l: 'Участники', v: `${clan.members_count}/${clan.max_members}`, c: '#60a5fa' },
            { l: 'Победы',    v: clan.wins,                                    c: '#34d399' },
            { l: 'Поражения', v: clan.losses,                                  c: '#f87171' },
            { l: 'Сила',      v: clan.total_power.toLocaleString(),            c: '#fbbf24' },
          ].map(stat => (
            <div key={stat.l} style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '7px 4px', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: stat.c }}>{stat.v}</div>
              <div style={{ fontSize: 10, opacity: 0.55 }}>{stat.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['members', 'treasury', 'war'] as Section[]).map(sec => (
          <button key={sec} onClick={() => setSection(sec)} style={{
            flex: 1, borderRadius: 10, padding: '8px 4px', cursor: 'pointer',
            color: '#fff', fontSize: 12, fontWeight: 600,
            border: `1px solid ${section === sec ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
            background: section === sec ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
          }}>
            {sec === 'members' ? '👥 Состав' : sec === 'treasury' ? '💰 Казна' : '⚔️ Война'}
          </button>
        ))}
      </div>

      {/* ── Состав ── */}
      {section === 'members' && (
        <div style={s.card}>
          {clan.members.map((m, i) => (
            <div key={m.user_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                {/* Аватар-иконка */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'leader' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                }}>
                  {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⚔️' : '🛡'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {m.name}{m.user_id === userId && <span style={{ opacity: 0.45, fontSize: 11 }}> (ты)</span>}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>
                    {ROLE_LABEL[m.role]} · <span style={{ color: '#c4b5fd' }}>{m.rank}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>{m.contribution.toLocaleString()} 💰</div>
                  <div style={{ fontSize: 10, opacity: 0.45 }}>вклад</div>
                </div>
                {/* Кнопка редактирования ранга */}
                {canManage && m.user_id !== userId && m.role !== 'leader' && (
                  <button onClick={() => setRankTarget(rankTarget === m.user_id ? null : m.user_id)}
                    style={{
                      flexShrink: 0, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, padding: '4px 8px', color: '#fff',
                      cursor: 'pointer', fontSize: 12,
                    }}>
                    ✏️
                  </button>
                )}
              </div>

              {/* Панель редактирования ранга */}
              {rankTarget === m.user_id && (
                <RankEditor
                  member={m}
                  isLeader={isLeader}
                  onSave={async (role, rank) => {
                    try {
                      await setMemberRole(m.user_id, role, rank)
                      p.notify('✅ Ранг обновлён')
                      setRankTarget(null)
                      p.onWarDone()
                    } catch (e: any) {
                      p.notify(e?.response?.data?.detail ?? 'Ошибка', false)
                    }
                  }}
                  onCancel={() => setRankTarget(null)}
                />
              )}

              {i < clan.members.length - 1 && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Казна ── */}
      {section === 'treasury' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>💰 Клановая казна</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#fbbf24' }}>{clan.treasury.toLocaleString()} 💰</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            Казна используется лидером для покупки усилений перед войной.
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Пожертвовать:</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[50, 100, 250, 500, 1000].map(v => (
              <button key={v} onClick={() => p.onContributeAmtChange(v)} style={{
                fontSize: 12, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${p.contributeAmt === v ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background: p.contributeAmt === v ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
              }}>{v} 💰</button>
            ))}
          </div>
          <input type="number" value={p.contributeAmt}
            onChange={e => p.onContributeAmtChange(Math.max(10, parseInt(e.target.value) || 10))}
            min={10} max={100000} style={{ ...s.input, marginBottom: 8 }} />
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 10 }}>У тебя: {p.userCoins.toLocaleString()} 💰</div>
          <button onClick={p.onContribute} disabled={busy || p.contributeAmt > p.userCoins}
            style={s.btn('#fbbf24')}>
            {busy ? '...' : `💰 Пожертвовать ${p.contributeAmt.toLocaleString()}`}
          </button>
        </div>
      )}

      {/* ── Война ── */}
      {section === 'war' && (
        <WarSection
          clan={clan}
          warItems={warItems}
          warStatus={warStatus}
          userId={userId}
          isLeader={isLeader}
          busy={busy}
          onBuyWarItem={p.onBuyWarItem}
          onPrepare={p.onPrepare}
          onParticipate={p.onParticipate}
          onStartWar={p.onStartWar}
          onPlayBattle={setActiveBattle}
          onWarDone={p.onWarDone}
        />
      )}

      {/* Покинуть клан */}
      <button onClick={p.onLeave} disabled={busy} style={{
        width: '100%', marginTop: 10,
        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
        borderRadius: 12, padding: 12, color: '#f87171',
        cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}>🚪 Покинуть клан</button>

      {/* Оверлей мини-игры */}
      {activeBattle && (
        <GameLauncher
          battleId={activeBattle.id}
          gameType={activeBattle.game_type}
          opponentName={activeBattle.opponent_name}
          day={activeBattle.day}
          battleNum={activeBattle.battle_num}
          onClose={() => setActiveBattle(null)}
          onDone={() => { setActiveBattle(null); p.onWarDone() }}
        />
      )}
    </div>
  )
}

// ── Редактор ранга ────────────────────────────────────────────────────────────

function RankEditor({
  member, isLeader, onSave, onCancel,
}: {
  member: { user_id: number; role: string; rank: string }
  isLeader: boolean
  onSave: (role: string, rank: string) => void
  onCancel: () => void
}) {
  const [role, setRole] = useState(member.role)
  const [rank, setRank] = useState(member.rank)

  return (
    <div style={{
      background: 'rgba(88,28,135,0.2)', border: '1px solid rgba(168,85,247,0.3)',
      borderRadius: 12, padding: 14, marginBottom: 8,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>✏️ Изменить ранг и роль</div>

      {isLeader && (
        <>
          <div style={s.label}>Роль</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'officer', label: '⚔️ Офицер' },
              { key: 'member',  label: '🛡 Участник' },
            ].map(r => (
              <button key={r.key} onClick={() => setRole(r.key)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${role === r.key ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background: role === r.key ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: 13,
              }}>{r.label}</button>
            ))}
          </div>
        </>
      )}

      <div style={s.label}>Ранг</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESET_RANKS.map(r => (
          <button key={r} onClick={() => setRank(r)} style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${rank === r ? 'rgba(196,181,253,0.6)' : 'rgba(255,255,255,0.1)'}`,
            background: rank === r ? 'rgba(196,181,253,0.15)' : 'rgba(255,255,255,0.04)',
            color: rank === r ? '#c4b5fd' : '#fff',
          }}>{r}</button>
        ))}
      </div>
      <input value={rank} onChange={e => setRank(e.target.value)} maxLength={32}
        placeholder="Или введи свой..." style={{ ...s.input, marginBottom: 10 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(role, rank)} style={{ ...s.btnSmall('#a855f7'), flex: 1 }}>Сохранить</button>
        <button onClick={onCancel} style={{ ...s.btnSmall('#6b7280'), flex: 1 }}>Отмена</button>
      </div>
    </div>
  )
}

// ── Секция войны ──────────────────────────────────────────────────────────────

interface WarSectionProps {
  clan: ClanInfo
  warItems: WarItemInfo[]
  warStatus: WarStatus | null
  userId: number
  isLeader: boolean
  busy: boolean
  onBuyWarItem: (type: string, name: string) => void
  onPrepare: () => void
  onParticipate: (v: boolean) => void
  onStartWar: () => void
  onPlayBattle: (b: WarBattle) => void
  onWarDone: () => void
}

function WarSection(p: WarSectionProps) {
  const { clan, warItems, warStatus, userId, isLeader, busy } = p
  const ws = warStatus
  const myParticipation = ws?.my_participation

  // stage 0 — нет войны
  if (clan.war_stage === 0) return (
    <div>
      <div style={s.card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>⚔️ Клановая война</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 16, lineHeight: 1.5 }}>
          Война кланов идёт 2 дня. Игроки сражаются 1v1 в мини-играх — по 2 битвы в день (4 всего).
          Противник подбирается по силе клана.
        </div>
        {isLeader ? (
          <button onClick={p.onPrepare} disabled={busy} style={s.btn('#ef4444')}>
            {busy ? '...' : '⚔️ Подготовиться к войне'}
          </button>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', padding: 10 }}>
            Лидер клана может начать подготовку к войне
          </div>
        )}
      </div>

      {/* Предметы войны — всегда видны */}
      <WarItemsList
        warItems={warItems}
        clan={clan}
        isLeader={isLeader}
        busy={busy}
        onBuy={p.onBuyWarItem}
        treasury={clan.treasury}
      />
    </div>
  )

  // stage 1 — подготовка
  if (clan.war_stage === 1) return (
    <div>
      <div style={{
        ...s.card,
        border: '1px solid rgba(251,191,36,0.4)',
        background: 'rgba(251,191,36,0.08)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#fbbf24' }}>
          ⏳ Идёт подготовка к войне
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
          Подтверди участие. Лидер запустит войну, когда будет готов. <br />
          Участники без статуса не попадут в списки пар.
        </div>

        {/* Кнопки участия */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => p.onParticipate(true)} disabled={busy}
            style={{
              ...s.btnSmall('#22c55e'), flex: 1,
              border: myParticipation === true ? '2px solid #22c55e' : '1px solid rgba(34,197,94,0.5)',
              background: myParticipation === true ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.1)',
            }}>
            ✅ Участвую
          </button>
          <button onClick={() => p.onParticipate(false)} disabled={busy}
            style={{
              ...s.btnSmall('#ef4444'), flex: 1,
              border: myParticipation === false ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.5)',
              background: myParticipation === false ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)',
            }}>
            ❌ Не участвую
          </button>
        </div>

        {/* Список кто подтвердил */}
        {ws && ws.participants.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Ответили участники:</div>
            {ws.participants.map(pt => (
              <div key={pt.user_id} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, marginBottom: 4,
              }}>
                <span style={{ opacity: 0.8 }}>{pt.name}</span>
                <span style={{ color: pt.is_participating ? '#22c55e' : '#f87171' }}>
                  {pt.is_participating ? '✅ Участвует' : '❌ Не участвует'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Начать войну — только лидер */}
        {isLeader && (
          <button onClick={p.onStartWar} disabled={busy} style={{
            ...s.btn('#ef4444'),
            border: '2px solid rgba(239,68,68,0.7)',
          }}>
            {busy ? '...' : '🚀 Начать войну!'}
          </button>
        )}
      </div>

      {/* Предметы войны */}
      <WarItemsList
        warItems={warItems}
        clan={clan}
        isLeader={isLeader}
        busy={busy}
        onBuy={p.onBuyWarItem}
        treasury={clan.treasury}
      />
    </div>
  )

  // stage 2 — идёт война
  if (clan.war_stage === 2 && ws) return (
    <div>
      {/* Соперник и счёт */}
      {ws.opponent_clan && (
        <div style={{
          ...s.card,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Соперник</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {ws.opponent_clan.emblem} {ws.opponent_clan.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>💥 {ws.opponent_clan.total_power.toLocaleString()} силы</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#34d399' }}>{ws.my_clan_score}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{clan.name}</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.4 }}>:</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f87171' }}>{ws.opponent_clan_score}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{ws.opponent_clan.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Мои битвы */}
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>⚔️ Мои битвы</div>
      {ws.battles.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', opacity: 0.5 }}>
          Битвы ещё не назначены
        </div>
      ) : (
        [1, 2].map(day => (
          <div key={day}>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.6, marginBottom: 6 }}>День {day}</div>
            {ws.battles.filter(b => b.day === day).map(battle => (
              <BattleCard
                key={battle.id}
                battle={battle}
                onPlay={() => p.onPlayBattle(battle)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )

  return null
}

// ── Карточка битвы ────────────────────────────────────────────────────────────

function BattleCard({ battle, onPlay }: { battle: WarBattle; onPlay: () => void }) {
  const expired = new Date(battle.expires_at) < new Date()
  const emoji = GAME_EMOJI[battle.game_type] ?? '⚔️'
  const gameNames: Record<string, string> = { reaction: 'Реакция', math: 'Математика', memory: 'Память', aim: 'Меткость' }

  let statusEl: React.ReactNode
  if (battle.played_by_me && battle.opponent_score !== null) {
    // Оба сыграли
    const iWon = battle.winner_id === battle.opponent_id ? false : battle.winner_id !== null
    statusEl = <span style={{ color: iWon ? '#22c55e' : '#f87171', fontWeight: 700 }}>
      {iWon ? '🏆 Победа' : battle.winner_id === null ? '🤝 Ничья' : '💀 Поражение'}
    </span>
  } else if (battle.played_by_me) {
    statusEl = <span style={{ color: '#fbbf24' }}>⏳ Ждём соперника ({battle.my_score} очков)</span>
  } else if (expired) {
    statusEl = <span style={{ color: '#6b7280' }}>⌛ Время вышло</span>
  } else {
    statusEl = null
  }

  return (
    <div style={{
      ...s.card, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
      border: `1px solid ${battle.played_by_me ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <div style={{ fontSize: 26, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{gameNames[battle.game_type] ?? battle.game_type}</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>vs {battle.opponent_name} · Битва {battle.battle_num}</div>
        {statusEl && <div style={{ fontSize: 12, marginTop: 2 }}>{statusEl}</div>}
      </div>
      {!battle.played_by_me && !expired && (
        <button onClick={onPlay} style={{ ...s.btnSmall('#6366f1'), flexShrink: 0 }}>
          Играть
        </button>
      )}
    </div>
  )
}

// ── Предметы войны ────────────────────────────────────────────────────────────

function WarItemsList({ warItems, clan, isLeader, busy, onBuy, treasury }: {
  warItems: WarItemInfo[]
  clan: ClanInfo
  isLeader: boolean
  busy: boolean
  onBuy: (type: string, name: string) => void
  treasury: number
}) {
  const buffActive = (type: string) => (clan as any)[`war_buff_${type}`] as boolean

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>🛒 Усиления</div>
        <div style={{ fontSize: 13, color: '#fbbf24' }}>Казна: {treasury.toLocaleString()} 💰</div>
      </div>
      {!isLeader && (
        <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>
          Только лидер может покупать усиления.
        </div>
      )}
      {warItems.map(item => {
        const bought = buffActive(item.type)
        const canAfford = treasury >= item.cost
        return (
          <div key={item.type} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 26, flexShrink: 0 }}>{WAR_ITEM_EMOJI[item.type] ?? '⚡'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{item.desc}</div>
              <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>{item.cost} 💰</div>
            </div>
            {/* Кнопка/статус — фиксированная ширина, не растягивается */}
            <div style={{ flexShrink: 0, width: 72 }}>
              {bought ? (
                <div style={{ textAlign: 'center', color: '#22c55e', fontSize: 18 }}>✅</div>
              ) : isLeader ? (
                <button
                  onClick={() => onBuy(item.type, item.name)}
                  disabled={busy || !canAfford}
                  style={{
                    width: '100%',
                    background: canAfford ? 'rgba(99,102,241,0.3)' : 'rgba(107,114,128,0.2)',
                    border: `1px solid ${canAfford ? 'rgba(129,140,248,0.6)' : 'rgba(107,114,128,0.3)'}`,
                    borderRadius: 8, padding: '6px 0',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    opacity: canAfford ? 1 : 0.55,
                  }}
                >Купить</button>
              ) : (
                <div style={{ fontSize: 10, opacity: 0.35, textAlign: 'center' }}>Только<br/>лидер</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Стили ─────────────────────────────────────────────────────────────────────

function warBadge(color: string): React.CSSProperties {
  return {
    fontSize: 11, padding: '2px 8px', borderRadius: 8,
    background: `${color}22`, border: `1px solid ${color}55`,
    color, flexShrink: 0,
  }
}

const s = {
  h1:   { fontWeight: 800, fontSize: 19, marginBottom: 8 } as React.CSSProperties,
  hint: { fontSize: 13, opacity: 0.65, marginBottom: 14, lineHeight: 1.5 } as React.CSSProperties,
  label:{ fontSize: 12, opacity: 0.6, fontWeight: 600, marginBottom: 6 } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '12px 14px', marginBottom: 12,
  } as React.CSSProperties,
  back: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 13,
  } as React.CSSProperties,
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none',
    marginBottom: 12,
  } as React.CSSProperties,
  btn: (bg: string): React.CSSProperties => ({
    display: 'block', width: '100%',
    background: `${bg}30`, border: `1px solid ${bg}80`,
    borderRadius: 10, padding: '11px 0',
    color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  }),
  btnSmall: (bg: string): React.CSSProperties => ({
    background: `${bg}25`, border: `1px solid ${bg}60`,
    borderRadius: 8, padding: '7px 12px',
    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  }),
}
