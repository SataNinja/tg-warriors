export interface Unit {
  id: string
  owner_id: number
  name: string
  level: number
  power: number
  defense: number
  is_for_sale: boolean
  sale_price: number | null
  created_at: string
}

export interface User {
  id: number
  username: string | null
  first_name: string
  last_name: string | null
  coins: number
  shield_until: string | null
  last_daily_reward: string | null
  units: Unit[]
  created_at: string
}

export interface GameState {
  user: User
  can_claim_daily: boolean
  daily_reward_coins: number
  raid_cooldown_remaining: number
  shield_active: boolean
}

export interface RaidResult {
  success: boolean
  coins_stolen: number
  attacker_power: number
  defender_power: number
  message: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string | null
  first_name: string
  coins: number
  total_power: number
}
