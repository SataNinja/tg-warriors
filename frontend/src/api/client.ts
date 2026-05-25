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
