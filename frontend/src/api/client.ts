import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function authTelegram(initData: string, referrerId?: number) {
  const { data } = await api.post('/auth/telegram', { init_data: initData, referrer_id: referrerId ?? null })
  return data as { access_token: string; user_id: number }
}

export async function fetchGameState() {
  const { data } = await api.get('/state')
  return data
}

export async function fetchMe() {
  const { data } = await api.get('/me')
  return data
}

export async function setNickname(nickname: string) {
  const { data } = await api.post('/me/nickname', { nickname })
  return data
}

export async function buyUnit(unitType: string = 'warrior') {
  const { data } = await api.post('/unit/buy', { unit_type: unitType })
  return data
}

export async function fetchUnitTypes() {
  const { data } = await api.get('/unit/types')
  return data as UnitTypeInfo[]
}

export interface UnitTypeInfo {
  unit_type: string
  name: string
  emoji: string
  castle_req: number
  base_power: number
  base_defense: number
  category: string
  desc: string
}

export async function upgradeUnit(unitId: string) {
  const { data } = await api.post('/unit/upgrade', { unit_id: unitId })
  return data
}

export async function doRaid(targetUserId: number) {
  const { data } = await api.post('/raid', { target_user_id: targetUserId })
  return data
}

export async function doPveRaid() {
  const { data } = await api.post('/raid/pve')
  return data
}

export async function doRandomRaid() {
  const { data } = await api.post('/raid/random')
  return data
}

export async function buyShield() {
  const { data } = await api.post('/shield')
  return data
}

export async function claimDaily() {
  const { data } = await api.post('/daily/claim')
  return data
}

export async function claimReferral() {
  const { data } = await api.post('/referral/claim')
  return data
}

export async function fetchLeaderboard(sort: 'coins' | 'power' | 'wins' = 'coins') {
  const { data } = await api.get('/leaderboard', { params: { sort } })
  return data
}

export async function fetchClans() {
  const { data } = await api.get('/clans')
  return data
}

export async function fetchBattles() {
  const { data } = await api.get('/raid/journal')
  return data
}

// ── Магазин ──────────────────────────────────────────────────────────────────
export async function fetchCastleInfo() {
  const { data } = await api.get('/shop/castle')
  return data
}

export async function upgradeCastle() {
  const { data } = await api.post('/shop/castle/upgrade')
  return data
}

export async function fetchWeaponInfo() {
  const { data } = await api.get('/shop/weapon')
  return data
}

export async function buyWeapon() {
  const { data } = await api.post('/shop/weapon/buy')
  return data
}

export async function upgradeWeapon() {
  const { data } = await api.post('/shop/weapon/upgrade')
  return data
}

export async function buyEgg(eggType: string) {
  const { data } = await api.post('/shop/egg/buy', { egg_type: eggType })
  return data
}

// ── Питомцы ──────────────────────────────────────────────────────────────────
export async function fetchPets() {
  const { data } = await api.get('/pets')
  return data
}

export async function doPetBattle(petId: number) {
  const { data } = await api.post('/pets/battle', { pet_id: petId })
  return data
}

export async function releasePet(petId: number) {
  const { data } = await api.post(`/pets/${petId}/release`)
  return data
}

export async function upgradePet(petId: number) {
  const { data } = await api.post(`/pets/${petId}/upgrade`)
  return data
}

export async function buyCrystals(amount: number = 1) {
  const { data } = await api.post('/shop/crystals/buy', { amount })
  return data
}

export async function feedPet(petId: number, foodType: string) {
  const { data } = await api.post(`/pets/${petId}/feed`, { pet_id: petId, food_type: foodType })
  return data
}

export async function fetchEggs() {
  const { data } = await api.get('/pets/eggs')
  return data
}

export async function hatchEgg(eggId: number) {
  const { data } = await api.post(`/pets/eggs/${eggId}/hatch`)
  return data
}

export async function fetchFoodList() {
  const { data } = await api.get('/shop/food')
  return data
}

// ── Админ ─────────────────────────────────────────────────────────────────────
export interface AdminPlayerListItem {
  id: number
  name: string
  coins: number
  castle_level: number
}

export interface AdminPetItem {
  id: number
  name: string
  pet_type: string
  rarity: string
  level: number
  power_bonus: number
  gold_bonus: number
}

export interface AdminPlayerInfo {
  id: number
  name: string
  coins: number
  iron: number
  crystals: number
  castle_level: number
  win_streak: number
  energy: number
  units_count: number
  shield_until: string | null
  pets: AdminPetItem[]
}

export async function adminSearchPlayers(search: string, limit = 20): Promise<AdminPlayerListItem[]> {
  const { data } = await api.get('/admin/players', { params: { search, limit } })
  return data
}

export async function adminGetPlayer(targetId: number): Promise<AdminPlayerInfo> {
  const { data } = await api.get(`/admin/player/${targetId}`)
  return data
}

export async function adminSetCoins(targetId: number, coins: number) {
  const { data } = await api.post('/admin/set-coins', { target_id: targetId, coins })
  return data
}

export async function adminSetIron(targetId: number, iron: number) {
  const { data } = await api.post('/admin/set-iron', { target_id: targetId, iron })
  return data
}

export async function adminSetCrystals(targetId: number, crystals: number) {
  const { data } = await api.post('/admin/set-crystals', { target_id: targetId, crystals })
  return data
}

export async function adminSetCastle(targetId: number, castleLevel: number) {
  const { data } = await api.post('/admin/set-castle', { target_id: targetId, castle_level: castleLevel })
  return data
}

export async function adminSetShield(targetId: number, hours: number) {
  const { data } = await api.post('/admin/set-shield', { target_id: targetId, hours })
  return data
}

export async function adminResetCooldowns(targetId: number) {
  const { data } = await api.post(`/admin/reset-cooldowns/${targetId}`)
  return data
}

export async function adminGivePet(targetId: number, petType: string, rarity: string) {
  const { data } = await api.post('/admin/give-pet', { target_id: targetId, pet_type: petType, rarity })
  return data
}

export async function adminRemovePet(petId: number) {
  const { data } = await api.delete(`/admin/pet/${petId}`)
  return data
}

// ── Кланы ────────────────────────────────────────────────────────────────────

export interface ClanListItem {
  id: number
  name: string
  emblem: string
  members_count: number
  total_power: number
  wins: number
  war_stage: number
}

export interface ClanMemberInfo {
  user_id: number
  name: string
  role: string
  rank: string
  contribution: number
}

export interface ClanInfo {
  id: number
  name: string
  description: string | null
  emblem: string
  leader_id: number
  total_power: number
  wins: number
  losses: number
  treasury: number
  members_count: number
  max_members: number
  members: ClanMemberInfo[]
  war_buff_attack: boolean
  war_buff_defense: boolean
  war_buff_artifact: boolean
  war_buff_provisions: boolean
  war_stage: number
  war_prepared_at: string | null
}

export interface WarItemInfo {
  type: string
  name: string
  cost: number
  desc: string
}

export interface WarBattle {
  id: number
  opponent_id: number
  opponent_name: string
  game_type: string
  day: number
  battle_num: number
  my_score: number | null
  opponent_score: number | null
  winner_id: number | null
  expires_at: string
  played_by_me: boolean
}

export interface WarStatus {
  war_id: number | null
  war_stage: number
  opponent_clan: { id: number; name: string; emblem: string; total_power: number } | null
  my_clan_score: number
  opponent_clan_score: number
  battles: WarBattle[]
  participants: { user_id: number; name: string; is_participating: boolean }[]
  is_finished: boolean
  war_prepared_at: string | null
  my_participation: boolean | null
  war_expires_at: string | null
  winner_clan_id: number | null
}

export async function fetchClanList(): Promise<ClanListItem[]> {
  const { data } = await api.get('/clans')
  return data
}

export async function fetchMyClan(): Promise<ClanInfo | null> {
  const { data } = await api.get('/clans/my')
  return data
}

export async function fetchClanById(clanId: number): Promise<ClanInfo> {
  const { data } = await api.get(`/clans/${clanId}`)
  return data
}

export async function createClan(name: string, description: string, emblem: string): Promise<ClanInfo> {
  const { data } = await api.post('/clans/create', { name, description, emblem })
  return data
}

export async function joinClan(clanId: number) {
  const { data } = await api.post(`/clans/${clanId}/join`)
  return data
}

export async function leaveClan() {
  const { data } = await api.post('/clans/leave')
  return data
}

export async function contributeToTreasury(amount: number) {
  const { data } = await api.post('/clans/contribute', { amount })
  return data
}

export async function buyWarItem(itemType: string) {
  const { data } = await api.post('/clans/war/buy-item', { item_type: itemType })
  return data
}

export async function fetchWarItems(): Promise<WarItemInfo[]> {
  const { data } = await api.get('/clans/war/items')
  return data
}

export async function prepareForWar() {
  const { data } = await api.post('/clans/war/prepare')
  return data
}

export async function setWarParticipation(participating: boolean) {
  const { data } = await api.post('/clans/war/participate', { participating })
  return data
}

export async function startClanWar() {
  const { data } = await api.post('/clans/war/start')
  return data
}

export async function fetchWarStatus(): Promise<WarStatus> {
  const { data } = await api.get('/clans/war/status')
  return data
}

export async function submitBattleScore(battleId: number, score: number) {
  const { data } = await api.post(`/clans/war/battle/${battleId}/submit`, { score })
  return data
}

export async function setMemberRole(userId: number, role: string, rank?: string) {
  const { data } = await api.post('/clans/members/set-role', { user_id: userId, role, rank })
  return data
}

export async function deleteClan() {
  const { data } = await api.post('/clans/delete')
  return data as { ok: boolean; message: string }
}

export async function updateClan(name?: string, description?: string, emblem?: string) {
  const { data } = await api.post('/clans/update', { name, description, emblem })
  return data as { ok: boolean; message: string }
}

// ── Пассивный доход ───────────────────────────────────────────────────────────
export async function claimPassiveIncome() {
  const { data } = await api.post('/daily/passive/claim')
  return data as { coins_earned: number; new_balance: number; message: string; next_in_seconds: number }
}

// ── Юниты: продажа ───────────────────────────────────────────────────────────
export async function sellUnit(unitId: string) {
  const { data } = await api.post('/unit/sell', { unit_id: unitId })
  return data as { message: string; refund: number; new_balance: number }
}
