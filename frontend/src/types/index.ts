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
  iron: number
  energy: number
  castle_level: number
  win_streak: number
  shield_until: string | null
  last_daily_reward: string | null
  units: Unit[]
  created_at: string
}

export interface GameState {
  user: User
  can_claim_daily: boolean
  daily_reward_coins: number
  daily_next_at: string | null
  raid_cooldown_remaining: number
  shield_active: boolean
  energy: number
  max_energy: number
  energy_regen_seconds: number
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

export interface BattleEntry {
  id: string
  is_attack: boolean
  opponent_id: number
  opponent_name: string
  success: boolean
  coins_delta: number
  my_power: number
  opponent_power: number
  can_revenge: boolean
  created_at: string
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

// ── Магазин ──────────────────────────────────────────────────────────────────
export interface CastleInfo {
  level: number
  name: string
  max_units: number
  income_bonus: number
  next_level_cost: number | null
  next_level_name: string | null
  next_level_bonus: string | null
}

export interface WeaponInfo {
  id: number | null
  name: string | null
  rarity: string | null
  level: number
  attack_bonus: number
  upgrade_cost: number | null
  buy_cost: number | null
}

// ── Питомцы ───────────────────────────────────────────────────────────────────
export interface PetOut {
  id: number
  name: string
  pet_type: string
  rarity: string
  level: number
  power_bonus: number
  gold_bonus: number
  energy: number
  max_energy: number
  energy_regen_seconds: number
  last_battle_at: string | null
  can_battle: boolean
  battle_cooldown_seconds: number
}

export interface PetBattleResult {
  success: boolean
  pet_name: string
  pet_power: number
  bot_power: number
  energy_gained: number
  pet_energy_spent: number
  pet_energy_left: number
  player_energy_left: number
  message: string
}
