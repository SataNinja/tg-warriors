export interface Unit {
  id: string
  owner_id: number
  name: string
  unit_type: string       // тип юнита (warrior, archer, knight и т.д.)
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
  crystals: number
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
  daily_reward_coins: number   // следующая награда (по стрику)
  daily_next_at: string | null
  daily_streak: number
  raid_cooldown_remaining: number
  shield_active: boolean
  energy: number
  max_energy: number
  energy_regen_seconds: number
  energy_regen_minutes: number
  passive_income_ready: boolean
  passive_income_amount: number
  passive_income_next_in: number
}

export interface RaidResult {
  success: boolean
  coins_stolen: number
  attacker_power: number
  defender_power: number
  message: string
  energy_left: number
  opponent_name: string
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
  is_revenged: boolean
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
  win_streak: number
}

export interface ClanOut {
  id: number
  name: string
  description: string | null
  emblem: string
  leader_id: number
  total_power: number
  wins: number
  losses: number
  members_count: number
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
  effective_power_bonus: number
  gold_bonus: number
  energy: number
  max_energy: number
  energy_regen_seconds: number
  energy_next_in: number
  last_battle_at: string | null
  can_battle: boolean
  battle_cooldown_seconds: number
  hunger: number
  hunger_status: string
  hunger_deple_seconds: number
  wins: number
  losses: number
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

export interface EggOut {
  id: number
  egg_type: string
  pet_type: string
  pet_name: string
  pet_emoji: string
  rarity: string
  hatches_at: string
  hatch_seconds_left: number
  is_ready: boolean
  created_at: string
}

export interface HatchEggResult {
  pet_name: string
  pet_type: string
  rarity: string
  power_bonus: number
  gold_bonus: number
  message: string
}

export interface BuyEggResult {
  egg_id: number
  egg_name: string
  pet_type: string
  rarity: string
  hatches_at: string
  hatch_seconds: number
  coins_spent: number
  new_balance: number
  message: string
}

export interface FoodItem {
  food_type: string
  name: string
  emoji: string
  description: string
  cost: number
  hunger_restore: number
}

export interface FeedPetResult {
  pet_name: string
  food_name: string
  hunger_before: number
  hunger_after: number
  coins_spent: number
  new_balance: number
  message: string
}
