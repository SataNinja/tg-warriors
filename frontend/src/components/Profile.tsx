import { User } from '../types'

interface Props {
  user: User
  shieldActive: boolean
}

export function Profile({ user, shieldActive }: Props) {
  const shieldText = shieldActive && user.shield_until
    ? `🛡 Щит активен до ${new Date(user.shield_until).toLocaleTimeString()}`
    : '🔓 Без защиты'

  return (
    <div style={styles.card}>
      <div style={styles.name}>
        {user.first_name} {user.last_name ?? ''}
        {user.username ? <span style={styles.username}> @{user.username}</span> : null}
      </div>
      <div style={styles.coins}>💰 {user.coins.toLocaleString()} монет</div>
      <div style={styles.shield}>{shieldText}</div>
      <div style={styles.units}>⚔️ Юнитов: {user.units.length}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 12
  },
  name: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  username: { fontSize: 14, opacity: 0.6 },
  coins: { fontSize: 22, fontWeight: 800, color: '#FFD700', marginBottom: 6 },
  shield: { fontSize: 13, opacity: 0.8, marginBottom: 4 },
  units: { fontSize: 13, opacity: 0.7 }
}
