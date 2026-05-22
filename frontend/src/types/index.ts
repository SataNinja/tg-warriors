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
  nickname: string | null
  coins: number
  energy: number
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
  energy: number
  max_energy: number
  energy_regen_minutes: number
}

export interface RaidResult {
  success: boolean
  coins_stolen: number
  attacker_power: number
  defender_power: number
  message: string
  energy_left: number
}

export interface PveRaidResult {
  success: boolean
  coins_earned: number
  coins_lost: number
  attacker_power: number
  bot_power: number
  message: string
  energy_left: number
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string | null
  first_name: string
  nickname: string | null
  coins: number
  total_power: number
}
