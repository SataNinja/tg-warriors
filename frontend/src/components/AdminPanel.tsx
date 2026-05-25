import { useState, useCallback, CSSProperties } from 'react'
import {
  adminSearchPlayers,
  adminGetPlayer,
  adminSetCoins,
  adminSetIron,
  adminSetCrystals,
  adminSetCastle,
  adminSetShield,
  adminResetCooldowns,
  adminGivePet,
  adminRemovePet,
  AdminPlayerListItem,
  AdminPlayerInfo,
} from '../api/client'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

const PET_EMOJI: Record<string, string> = {
  wolf: '🐺',
  raven: '🦅',
  bear: '🐻',
  phoenix: '🦅',
}

function shieldLabel(until: string | null): string {
  if (!until) return '❌ нет'
  const d = new Date(until)
  const now = new Date()
  if (d <= now) return '❌ истёк'
  const diffH = ((d.getTime() - now.getTime()) / 3600000).toFixed(1)
  return `🛡 ${diffH}ч`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: inline editable field
// ─────────────────────────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  type = 'number',
  min,
  max,
}: {
  label: string
  value: number | string
  onSave: (v: number) => Promise<void>
  type?: string
  min?: number
  max?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(Number(draft))
      setFlash('ok')
      setEditing(false)
    } catch {
      setFlash('err')
    } finally {
      setSaving(false)
      setTimeout(() => setFlash(null), 1500)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ color: '#9ca3af', minWidth: 90, fontSize: 13 }}>{label}</span>
      {editing ? (
        <>
          <input
            type={type}
            value={draft}
            min={min}
            max={max}
            onChange={e => setDraft(e.target.value)}
            style={{
              width: 80,
              background: '#1e2030',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              color: '#f1f5f9',
              padding: '3px 6px',
              fontSize: 13,
            }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: '#3b82f6', border: 'none', borderRadius: 5, color: '#fff', padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            {saving ? '…' : '✓'}
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 5, color: '#9ca3af', padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span style={{
            fontWeight: 600,
            color: flash === 'ok' ? '#4ade80' : flash === 'err' ? '#f87171' : '#f1f5f9',
            fontSize: 14,
            transition: 'color 0.3s',
          }}>
            {value}
          </span>
          <button
            onClick={() => { setDraft(String(value)); setEditing(true) }}
            style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 4, color: '#6b7280', padding: '2px 7px', fontSize: 11, cursor: 'pointer' }}
          >
            ✎
          </button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shield control
// ─────────────────────────────────────────────────────────────────────────────

function ShieldControl({ targetId, shieldUntil, onRefresh }: { targetId: number; shieldUntil: string | null; onRefresh: () => void }) {
  const [hours, setHours] = useState('8')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const apply = async (h: number) => {
    setLoading(true)
    try {
      await adminSetShield(targetId, h)
      setMsg(h <= 0 ? 'Снято' : `+${h}ч`)
      onRefresh()
    } catch { setMsg('Ошибка') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 1500) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ color: '#9ca3af', minWidth: 90, fontSize: 13 }}>Щит</span>
      <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{shieldLabel(shieldUntil)}</span>
      <input
        type="number"
        value={hours}
        min={0}
        max={168}
        onChange={e => setHours(e.target.value)}
        style={{ width: 52, background: '#1e2030', border: '1px solid #374151', borderRadius: 6, color: '#f1f5f9', padding: '3px 6px', fontSize: 12 }}
      />
      <span style={{ fontSize: 11, color: '#6b7280' }}>ч</span>
      <button onClick={() => apply(Number(hours))} disabled={loading}
        style={{ background: '#3b82f6', border: 'none', borderRadius: 5, color: '#fff', padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>
        {loading ? '…' : '🛡'}
      </button>
      <button onClick={() => apply(0)} disabled={loading}
        style={{ background: '#374151', border: 'none', borderRadius: 5, color: '#f87171', padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>
        ✕
      </button>
      {msg && <span style={{ fontSize: 12, color: '#4ade80' }}>{msg}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Give pet control
// ─────────────────────────────────────────────────────────────────────────────

function GivePetControl({ targetId, onRefresh }: { targetId: number; onRefresh: () => void }) {
  const [petType, setPetType] = useState('wolf')
  const [rarity, setRarity] = useState('common')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handle = async () => {
    setLoading(true)
    try {
      await adminGivePet(targetId, petType, rarity)
      setMsg('Выдан!')
      onRefresh()
    } catch { setMsg('Ошибка') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 1500) }
  }

  const selectStyle = {
    background: '#1e2030',
    border: '1px solid #374151',
    borderRadius: 6,
    color: '#f1f5f9',
    padding: '3px 6px',
    fontSize: 12,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: '#9ca3af', fontSize: 13 }}>+Питомец:</span>
      <select value={petType} onChange={e => setPetType(e.target.value)} style={selectStyle}>
        <option value="wolf">🐺 Волк</option>
        <option value="raven">🦅 Ворон</option>
        <option value="bear">🐻 Медведь</option>
        <option value="phoenix">🦅 Феникс</option>
      </select>
      <select value={rarity} onChange={e => setRarity(e.target.value)} style={selectStyle}>
        <option value="common">Common</option>
        <option value="rare">Rare</option>
        <option value="epic">Epic</option>
        <option value="legendary">Legendary</option>
      </select>
      <button onClick={handle} disabled={loading}
        style={{ background: '#059669', border: 'none', borderRadius: 5, color: '#fff', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
        {loading ? '…' : 'Выдать'}
      </button>
      {msg && <span style={{ fontSize: 12, color: '#4ade80' }}>{msg}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPanel
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AdminPlayerListItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [player, setPlayer] = useState<AdminPlayerInfo | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerError, setPlayerError] = useState('')

  const [resetMsg, setResetMsg] = useState('')

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await adminSearchPlayers(searchQuery.trim())
      setSearchResults(res)
    } catch { /* ignore */ }
    finally { setSearchLoading(false) }
  }, [searchQuery])

  const loadPlayer = useCallback(async (id: number) => {
    setSelectedId(id)
    setPlayerLoading(true)
    setPlayerError('')
    setPlayer(null)
    try {
      const info = await adminGetPlayer(id)
      setPlayer(info)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Ошибка загрузки'
      setPlayerError(msg)
    }
    finally { setPlayerLoading(false) }
  }, [])

  const refreshPlayer = useCallback(() => {
    if (selectedId != null) loadPlayer(selectedId)
  }, [selectedId, loadPlayer])

  const handleResetCd = async () => {
    if (!selectedId) return
    try {
      await adminResetCooldowns(selectedId)
      setResetMsg('Сброшено!')
      refreshPlayer()
    } catch { setResetMsg('Ошибка') }
    finally { setTimeout(() => setResetMsg(''), 1500) }
  }

  const handleRemovePet = async (petId: number) => {
    try {
      await adminRemovePet(petId)
      refreshPlayer()
    } catch { /* ignore */ }
  }

  // ── Styles ──
  const card: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(15,15,25,0.95) 0%, rgba(20,20,40,0.95) 100%)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 12,
  }

  return (
    <div style={{ padding: '12px 4px', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 32 }}>🛡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', letterSpacing: 1 }}>ADMIN PANEL</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>TG Warriors — управление игроками</div>
      </div>

      {/* Search */}
      <div style={card}>
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>🔍 Поиск игрока</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="ID или имя"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            style={{
              flex: 1,
              background: '#1e2030',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#f1f5f9',
              padding: '7px 12px',
              fontSize: 14,
            }}
          />
          <button
            onClick={doSearch}
            disabled={searchLoading}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: '7px 16px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {searchLoading ? '…' : 'Найти'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => loadPlayer(p.id)}
                style={{
                  background: selectedId === p.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedId === p.id ? 'rgba(239,68,68,0.4)' : '#374151'}`,
                  borderRadius: 8,
                  color: '#f1f5f9',
                  padding: '7px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span><b>{p.name}</b> <span style={{ color: '#6b7280', fontSize: 11 }}>#{p.id}</span></span>
                <span style={{ color: '#fbbf24' }}>🏰{p.castle_level} · 🪙{p.coins}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Player Profile */}
      {playerLoading && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>Загрузка…</div>
      )}
      {playerError && (
        <div style={{ ...card, borderColor: 'rgba(239,68,68,0.5)', color: '#f87171', textAlign: 'center' }}>
          {playerError}
        </div>
      )}

      {player && !playerLoading && (
        <>
          {/* Header card */}
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{player.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>ID: {player.id}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
                <div>Побед: <b style={{ color: '#4ade80' }}>{player.win_streak}</b></div>
                <div>Юнитов: <b style={{ color: '#60a5fa' }}>{player.units_count}</b></div>
              </div>
            </div>

            {/* Editable fields */}
            <EditableField label="🪙 Монеты" value={player.coins} onSave={v => adminSetCoins(player.id, v).then(refreshPlayer)} min={0} />
            <EditableField label="⚙️ Железо" value={player.iron} onSave={v => adminSetIron(player.id, v).then(refreshPlayer)} min={0} />
            <EditableField label="💎 Кристаллы" value={player.crystals} onSave={v => adminSetCrystals(player.id, v).then(refreshPlayer)} min={0} />
            <EditableField label="🏰 Замок" value={player.castle_level} onSave={v => adminSetCastle(player.id, v).then(refreshPlayer)} min={1} max={20} />
            <EditableField label="⚡ Энергия" value={player.energy} onSave={v => adminSetCoins(player.id, v).then(refreshPlayer)} min={0} max={50} />

            {/* Shield */}
            <ShieldControl targetId={player.id} shieldUntil={player.shield_until} onRefresh={refreshPlayer} />

            {/* Reset cooldowns */}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={handleResetCd}
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 8,
                  color: '#fbbf24',
                  padding: '6px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                🔄 Сбросить кулдауны
              </button>
              {resetMsg && <span style={{ marginLeft: 8, fontSize: 12, color: '#4ade80' }}>{resetMsg}</span>}
            </div>
          </div>

          {/* Pets */}
          <div style={card}>
            <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600, marginBottom: 10 }}>
              🐾 Питомцы ({player.pets.length})
            </div>

            {player.pets.length === 0 && (
              <div style={{ color: '#4b5563', fontSize: 13, marginBottom: 10 }}>Нет питомцев</div>
            )}

            {player.pets.map(pet => (
              <div
                key={pet.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  marginBottom: 5,
                  background: `${RARITY_COLOR[pet.rarity]}15`,
                  border: `1px solid ${RARITY_COLOR[pet.rarity]}30`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{PET_EMOJI[pet.pet_type] ?? '🐾'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{pet.name}</div>
                    <div style={{ fontSize: 11, color: RARITY_COLOR[pet.rarity] }}>
                      {pet.rarity} · Lv{pet.level} · +{pet.power_bonus}⚔️ +{pet.gold_bonus}%💰
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePet(pet.id)}
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 6,
                    color: '#ef4444',
                    padding: '3px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  🗑
                </button>
              </div>
            ))}

            {/* Give pet */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1f2937' }}>
              <GivePetControl targetId={player.id} onRefresh={refreshPlayer} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
