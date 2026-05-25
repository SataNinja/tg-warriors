import { useState, useEffect, useCallback } from 'react'
import {
  fetchClanList, fetchMyClan, createClan, joinClan, leaveClan,
  contributeToTreasury, buyWarItem, fetchWarItems,
  ClanInfo, ClanListItem, WarItemInfo,
} from '../api/client'

// ── Константы ─────────────────────────────────────────────────────────────────

const RARITY_ROLE: Record<string, string> = {
  leader:  '👑 Лидер',
  officer: '⚔️ Офицер',
  member:  '🛡 Участник',
}

const WAR_ITEM_EMOJI: Record<string, string> = {
  attack:    '⚔️',
  defense:   '🛡',
  artifact:  '🔮',
  provisions:'🍖',
}

// ── ClanPanel ─────────────────────────────────────────────────────────────────

interface Props {
  userId: number
  userCoins: number
  onRefresh?: () => void
}

type View = 'home' | 'list' | 'create' | 'mine' | 'detail'

export function ClanPanel({ userId, userCoins, onRefresh }: Props) {
  const [view, setView] = useState<View>('home')
  const [myClan, setMyClan] = useState<ClanInfo | null | undefined>(undefined)
  const [clanList, setClanList] = useState<ClanListItem[]>([])
  const [warItems, setWarItems] = useState<WarItemInfo[]>([])
  const [selectedClan, setSelectedClan] = useState<ClanInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // create form
  const [cName, setCName] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cEmblem, setCEmblem] = useState('⚔️')

  // contribute
  const [contributeAmt, setContributeAmt] = useState(100)

  const loadMyClan = useCallback(async () => {
    try {
      const clan = await fetchMyClan()
      setMyClan(clan)
      if (clan) {
        const items = await fetchWarItems()
        setWarItems(items)
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

  useEffect(() => { loadMyClan() }, [loadMyClan])

  const notify = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 3500) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleLoadList = async () => {
    setBusy(true)
    try {
      const list = await fetchClanList()
      setClanList(list)
      setView('list')
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка загрузки', true)
    } finally { setBusy(false) }
  }

  const handleCreate = async () => {
    if (!cName.trim() || cName.length < 2) { notify('Имя клана минимум 2 символа', true); return }
    setBusy(true)
    try {
      await createClan(cName.trim(), cDesc.trim(), cEmblem || '⚔️')
      notify('Клан создан!')
      onRefresh?.()
      await loadMyClan()
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка', true)
    } finally { setBusy(false) }
  }

  const handleJoin = async (clanId: number, clanName: string) => {
    setBusy(true)
    try {
      await joinClan(clanId)
      notify(`Добро пожаловать в «${clanName}»!`)
      onRefresh?.()
      await loadMyClan()
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка', true)
    } finally { setBusy(false) }
  }

  const handleLeave = async () => {
    if (!confirm('Покинуть клан?')) return
    setBusy(true)
    try {
      await leaveClan()
      notify('Ты покинул клан')
      setMyClan(null)
      onRefresh?.()
      setView('home')
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка', true)
    } finally { setBusy(false) }
  }

  const handleContribute = async () => {
    if (contributeAmt < 10) { notify('Минимум 10 монет', true); return }
    if (contributeAmt > userCoins) { notify('Недостаточно монет', true); return }
    setBusy(true)
    try {
      const res = await contributeToTreasury(contributeAmt)
      notify(`+${res.donated} в казну! Итого: ${res.treasury} 💰`)
      onRefresh?.()
      await loadMyClan()
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка', true)
    } finally { setBusy(false) }
  }

  const handleBuyWarItem = async (itemType: string, itemName: string) => {
    if (!confirm(`Купить «${itemName}» из казны?`)) return
    setBusy(true)
    try {
      const res = await buyWarItem(itemType)
      notify(res.message)
      onRefresh?.()
      await loadMyClan()
    } catch (e: any) {
      notify(e?.response?.data?.detail ?? 'Ошибка', true)
    } finally { setBusy(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Загрузка...</div>
  )

  return (
    <div>
      {/* Уведомления */}
      {error && (
        <div style={s.toast('#ef4444')}>{error}</div>
      )}
      {success && (
        <div style={s.toast('#22c55e')}>{success}</div>
      )}

      {/* ── Нет клана: выбор ── */}
      {view === 'home' && !myClan && (
        <div>
          <div style={s.header}>⚔️ Кланы</div>
          <div style={s.hint}>Кланы позволяют объединяться с другими игроками, совместно развиваться и сражаться в клановых войнах.</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button onClick={handleLoadList} disabled={busy} style={{ ...s.btn('#3b82f6'), flex: 1 }}>
              🔍 Найти клан
            </button>
            <button onClick={() => setView('create')} style={{ ...s.btn('#a855f7'), flex: 1 }}>
              ✨ Создать клан
            </button>
          </div>

          <div style={s.infoCard}>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>💡 Как работают кланы</div>
            <div style={s.infoRow}>⚔️ <span>Создание клана стоит <b style={{ color: '#fbbf24' }}>500 монет</b></span></div>
            <div style={s.infoRow}>💰 <span>Члены клана пополняют казну донатами</span></div>
            <div style={s.infoRow}>🛡 <span>Лидер покупает боевые усиления перед войной</span></div>
            <div style={s.infoRow}>🏆 <span>Побеждайте в клановых войнах для роста рейтинга</span></div>
          </div>
        </div>
      )}

      {/* ── Создание клана ── */}
      {view === 'create' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setView('home')} style={s.backBtn}>← Назад</button>
            <div style={s.header}>✨ Создать клан</div>
          </div>

          <div style={s.card}>
            <div style={s.formLabel}>Эмблема</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['⚔️','🛡','🔮','👑','🐉','🦅','🌟','💎','🔥','🌊','⚡','🌙'].map(em => (
                <button
                  key={em}
                  onClick={() => setCEmblem(em)}
                  style={{
                    fontSize: 22, background: cEmblem === em ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${cEmblem === em ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  }}
                >{em}</button>
              ))}
            </div>

            <div style={s.formLabel}>Название клана *</div>
            <input
              value={cName}
              onChange={e => setCName(e.target.value)}
              maxLength={32}
              placeholder="Минимум 2 символа"
              style={s.input}
            />

            <div style={s.formLabel}>Описание (необязательно)</div>
            <textarea
              value={cDesc}
              onChange={e => setCDesc(e.target.value)}
              maxLength={256}
              placeholder="Расскажи о клане..."
              style={{ ...s.input, height: 72, resize: 'none' }}
            />

            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
              Стоимость создания: <b style={{ color: '#fbbf24' }}>500 💰</b> (у тебя: {userCoins.toLocaleString()} 💰)
            </div>

            <button onClick={handleCreate} disabled={busy || !cName.trim()} style={s.btn('#a855f7')}>
              {busy ? '...' : `${cEmblem} Создать клан`}
            </button>
          </div>
        </div>
      )}

      {/* ── Список кланов ── */}
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setView('home')} style={s.backBtn}>← Назад</button>
            <div style={s.header}>🔍 Все кланы</div>
          </div>

          {clanList.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>Кланов пока нет</div>
          ) : (
            clanList.map(clan => (
              <div key={clan.id} style={s.clanRow}>
                <div style={{ fontSize: 26, marginRight: 12 }}>{clan.emblem}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{clan.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    👥 {clan.members_count} · 💥 {clan.total_power.toLocaleString()} · 🏆 {clan.wins} побед
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(clan.id, clan.name)}
                  disabled={busy}
                  style={s.btn('#3b82f6')}
                >
                  Вступить
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Мой клан ── */}
      {view === 'mine' && myClan && (
        <MyClanView
          clan={myClan}
          userId={userId}
          userCoins={userCoins}
          warItems={warItems}
          busy={busy}
          contributeAmt={contributeAmt}
          onContributeAmtChange={setContributeAmt}
          onContribute={handleContribute}
          onBuyWarItem={handleBuyWarItem}
          onLeave={handleLeave}
        />
      )}
    </div>
  )
}

// ── Вид «Мой клан» ────────────────────────────────────────────────────────────

interface MyClanProps {
  clan: ClanInfo
  userId: number
  userCoins: number
  warItems: WarItemInfo[]
  busy: boolean
  contributeAmt: number
  onContributeAmtChange: (v: number) => void
  onContribute: () => void
  onBuyWarItem: (type: string, name: string) => void
  onLeave: () => void
}

function MyClanView({
  clan, userId, userCoins, warItems, busy,
  contributeAmt, onContributeAmtChange, onContribute, onBuyWarItem, onLeave,
}: MyClanProps) {
  const isLeader = clan.leader_id === userId
  const [activeSection, setActiveSection] = useState<'members' | 'treasury' | 'war'>('members')

  const buffActive = (field: string) => {
    return (clan as any)[`war_buff_${field}`] as boolean
  }

  return (
    <div>
      {/* ── Шапка клана ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(88,28,135,0.3) 0%, rgba(30,27,75,0.3) 100%)',
        border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: 16, padding: '16px 16px 12px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 40 }}>{clan.emblem}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}>{clan.name}</div>
            {clan.description && (
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{clan.description}</div>
            )}
          </div>
        </div>

        {/* Статистика */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Участники', value: `${clan.members_count}/${clan.max_members}`, color: '#60a5fa' },
            { label: 'Победы', value: clan.wins, color: '#34d399' },
            { label: 'Поражения', value: clan.losses, color: '#f87171' },
            { label: 'Сила', value: clan.total_power.toLocaleString(), color: '#fbbf24' },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 10,
              padding: '8px 4px', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Переключатели секций ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: 'members', label: '👥 Участники' },
          { key: 'treasury', label: '💰 Казна' },
          { key: 'war', label: '⚔️ Война' },
        ].map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key as any)}
            style={{
              flex: 1, border: '1px solid',
              borderColor: activeSection === sec.key ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)',
              background: activeSection === sec.key ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: '8px 4px', color: '#fff',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >{sec.label}</button>
        ))}
      </div>

      {/* ── Участники ── */}
      {activeSection === 'members' && (
        <div style={s.card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            👥 Состав клана ({clan.members_count}/{clan.max_members})
          </div>
          {clan.members.map((m, i) => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0',
              borderBottom: i < clan.members.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: m.role === 'leader' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⚔️' : '🛡'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {m.name}
                  {m.user_id === userId && <span style={{ fontSize: 11, opacity: 0.5 }}> (ты)</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>
                  {RARITY_ROLE[m.role] ?? m.role}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>
                  {m.contribution.toLocaleString()} 💰
                </div>
                <div style={{ fontSize: 10, opacity: 0.5 }}>вклад</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Казна ── */}
      {activeSection === 'treasury' && (
        <div>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>💰 Клановая казна</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#fbbf24' }}>
                {clan.treasury.toLocaleString()} 💰
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
              Казна используется лидером для покупки усилений перед клановой войной. Сделай вклад для процветания клана!
            </div>

            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Пожертвовать монеты:</div>

            {/* Быстрые кнопки */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[50, 100, 250, 500, 1000].map(v => (
                <button
                  key={v}
                  onClick={() => onContributeAmtChange(v)}
                  style={{
                    fontSize: 12, padding: '5px 10px', borderRadius: 8,
                    border: '1px solid',
                    borderColor: contributeAmt === v ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.1)',
                    background: contributeAmt === v ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                    color: '#fff', cursor: 'pointer',
                  }}
                >{v} 💰</button>
              ))}
            </div>

            <input
              type="number"
              value={contributeAmt}
              onChange={e => onContributeAmtChange(Math.max(10, parseInt(e.target.value) || 10))}
              min={10}
              max={100000}
              style={{ ...s.input, marginBottom: 10 }}
            />

            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 10 }}>
              У тебя: {userCoins.toLocaleString()} 💰
            </div>

            <button
              onClick={onContribute}
              disabled={busy || contributeAmt > userCoins}
              style={s.btn('#fbbf24', '#78350f')}
            >
              {busy ? '...' : `💰 Пожертвовать ${contributeAmt.toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Война ── */}
      {activeSection === 'war' && (
        <div>
          <div style={s.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚔️ Подготовка к войне</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
              Лидер клана может купить усиления из казны. Усиления действуют в течение одной клановой войны.
              {!isLeader && <span style={{ color: '#f87171' }}><br/>Только лидер может покупать предметы.</span>}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Казна клана</div>
              <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: 16 }}>
                {clan.treasury.toLocaleString()} 💰
              </div>
            </div>

            {warItems.map(item => {
              const fieldKey = item.type
              const bought = buffActive(fieldKey)
              const canAfford = clan.treasury >= item.cost
              const emoji = WAR_ITEM_EMOJI[item.type] ?? '⚡'

              return (
                <div key={item.type} style={{
                  background: bought
                    ? 'rgba(34,197,94,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${bought ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{item.desc}</div>
                    <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 4 }}>
                      Стоимость: {item.cost} 💰
                    </div>
                  </div>
                  {bought ? (
                    <div style={{
                      fontSize: 20, color: '#22c55e',
                      flexShrink: 0,
                    }}>✅</div>
                  ) : isLeader ? (
                    <button
                      onClick={() => onBuyWarItem(item.type, item.name)}
                      disabled={busy || !canAfford}
                      style={{
                        ...s.btn(canAfford ? '#6366f1' : '#374151'),
                        fontSize: 12, padding: '7px 12px', flexShrink: 0,
                        opacity: canAfford ? 1 : 0.5,
                      }}
                    >
                      {busy ? '...' : 'Купить'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 11, opacity: 0.4, flexShrink: 0, textAlign: 'center' }}>
                      Только<br/>лидер
                    </div>
                  )}
                </div>
              )
            })}

            {warItems.length === 0 && (
              <div style={{ opacity: 0.4, textAlign: 'center', padding: 16 }}>
                Нет доступных предметов
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Покинуть клан ── */}
      <button
        onClick={onLeave}
        disabled={busy}
        style={{
          width: '100%', marginTop: 8,
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.08)',
          borderRadius: 12, padding: 12, color: '#f87171',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        🚪 Покинуть клан
      </button>
    </div>
  )
}

// ── Стили ─────────────────────────────────────────────────────────────────────

const s = {
  header: { fontWeight: 800, fontSize: 20, marginBottom: 8 } as React.CSSProperties,
  hint: { fontSize: 13, opacity: 0.65, marginBottom: 16, lineHeight: 1.5 } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 14px', marginBottom: 12,
  } as React.CSSProperties,
  clanRow: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '10px 12px', marginBottom: 8,
  } as React.CSSProperties,
  infoCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 14px',
  } as React.CSSProperties,
  infoRow: {
    display: 'flex', gap: 8, fontSize: 13, marginBottom: 6, opacity: 0.8, alignItems: 'flex-start',
  } as React.CSSProperties,
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff',
    cursor: 'pointer', fontSize: 13, flexShrink: 0,
  } as React.CSSProperties,
  formLabel: { fontSize: 12, opacity: 0.65, marginBottom: 6, fontWeight: 600 } as React.CSSProperties,
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '10px 12px',
    color: '#fff', fontSize: 14, outline: 'none',
    marginBottom: 12,
  } as React.CSSProperties,
  btn: (bg: string, textColor = '#fff') => ({
    display: 'block', width: '100%',
    background: `${bg}30`,
    border: `1px solid ${bg}80`,
    borderRadius: 10, padding: '10px 0',
    color: textColor === '#78350f' ? '#fbbf24' : '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 700,
    transition: 'opacity 0.15s',
  } as React.CSSProperties),
  toast: (color: string) => ({
    position: 'fixed' as const, bottom: 80, left: '50%',
    transform: 'translateX(-50%)',
    background: `${color}22`, border: `1px solid ${color}66`,
    borderRadius: 10, padding: '10px 18px',
    color: '#fff', fontSize: 13, zIndex: 999,
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties),
}
