import { useEffect, useState } from 'react'
import { fetchLeaderboard, fetchClans } from '../api/client'
import { LeaderboardEntry, ClanOut } from '../types'

type SortMode = 'coins' | 'power' | 'wins' | 'clans'

const MEDALS = ['🥇', '🥈', '🥉']

function CopyIdButton({ userId }: { userId: number }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(String(userId)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={handleCopy} style={styles.idBtn} title="Скопировать ID для атаки">
      {copied ? '✅' : `ID: ${userId}`}
    </button>
  )
}

// ── Строка игрока ──────────────────────────────────────────────────────────────
function PlayerRow({ entry, sort }: { entry: LeaderboardEntry; sort: SortMode }) {
  const displayName = entry.nickname || entry.first_name
  const medal = MEDALS[entry.rank - 1] ?? null
  return (
    <div style={{
      ...styles.row,
      background: entry.rank <= 3
        ? `rgba(255,215,0,${0.12 - (entry.rank - 1) * 0.03})`
        : 'rgba(255,255,255,0.05)'
    }}>
      <span style={styles.rank}>{medal ?? `#${entry.rank}`}</span>
      <div style={styles.nameBlock}>
        <span style={styles.name}>{displayName}</span>
        {entry.nickname && entry.username && (
          <span style={styles.uname}>@{entry.username}</span>
        )}
        <CopyIdButton userId={entry.user_id} />
      </div>
      <div style={styles.statsBlock}>
        {sort === 'wins'
          ? <span style={styles.wins}>🔥 {entry.win_streak}</span>
          : <span style={styles.power}>⚔️ {entry.total_power}</span>
        }
        <span style={styles.coins}>💰 {entry.coins.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ── Строка клана ───────────────────────────────────────────────────────────────
function ClanRow({ clan, rank }: { clan: ClanOut; rank: number }) {
  const medal = MEDALS[rank - 1] ?? null
  return (
    <div style={{
      ...styles.row,
      background: rank <= 3
        ? `rgba(255,215,0,${0.12 - (rank - 1) * 0.03})`
        : 'rgba(255,255,255,0.05)'
    }}>
      <span style={styles.rank}>{medal ?? `#${rank}`}</span>
      <div style={styles.nameBlock}>
        <span style={styles.name}>{clan.emblem} {clan.name}</span>
        <span style={styles.uname}>{clan.members_count} участников</span>
      </div>
      <div style={styles.statsBlock}>
        <span style={styles.power}>⚔️ {clan.total_power}</span>
        <span style={{ ...styles.coins, fontSize: 11 }}>
          {clan.wins}W / {clan.losses}L
        </span>
      </div>
    </div>
  )
}

// ── Главный компонент ──────────────────────────────────────────────────────────
export function Leaderboard() {
  const [sort, setSort] = useState<SortMode>('coins')
  const [players, setPlayers] = useState<LeaderboardEntry[]>([])
  const [clans, setClans] = useState<ClanOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    if (sort === 'clans') {
      fetchClans()
        .then(setClans)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      fetchLeaderboard(sort)
        .then(setPlayers)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [sort])

  const SORT_TABS: { key: SortMode; label: string }[] = [
    { key: 'coins', label: '💰 Монеты' },
    { key: 'power', label: '⚔️ Сила'  },
    { key: 'wins',  label: '🔥 Серия' },
    { key: 'clans', label: '🏰 Кланы' },
  ]

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>🏆 Таблица лидеров</div>

      {/* Вкладки сортировки */}
      <div style={styles.sortTabs}>
        {SORT_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSort(t.key)}
            style={{ ...styles.sortBtn, ...(sort === t.key ? styles.sortActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sort !== 'clans' && (
        <div style={styles.hint}>Нажми на ID чтобы скопировать и атаковать игрока ⚔️</div>
      )}

      {loading && <div style={styles.loading}>Загрузка...</div>}

      {!loading && sort === 'clans' && (
        clans.length === 0
          ? <div style={styles.loading}>Кланов пока нет</div>
          : clans.map((c, i) => <ClanRow key={c.id} clan={c} rank={i + 1} />)
      )}

      {!loading && sort !== 'clans' && (
        players.length === 0
          ? <div style={styles.loading}>Пока нет игроков</div>
          : players.map(e => <PlayerRow key={e.user_id} entry={e} sort={sort} />)
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 12 },
  title: { fontWeight: 700, fontSize: 16, marginBottom: 8 },
  sortTabs: { display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' },
  sortBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: 9,
    padding: '7px 4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    minWidth: 60,
  },
  sortActive: { background: '#5865F2' },
  hint: { fontSize: 11, opacity: 0.45, marginBottom: 8 },
  loading: { opacity: 0.6, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 6,
    fontSize: 13,
  },
  rank: { width: 32, fontWeight: 800, fontSize: 15, textAlign: 'center' as const },
  nameBlock: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  statsBlock: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2 },
  name: { fontWeight: 600 },
  uname: { opacity: 0.4, fontSize: 10 },
  power: { color: '#a78bfa', fontWeight: 600, fontSize: 12 },
  wins:  { color: '#f59e0b', fontWeight: 600, fontSize: 12 },
  coins: { color: '#FFD700', fontWeight: 700 },
  idBtn: {
    background: 'rgba(88,101,242,0.25)',
    border: '1px solid rgba(88,101,242,0.4)',
    borderRadius: 5,
    padding: '2px 6px',
    color: '#a5b4fc',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    width: 'fit-content',
  },
}
