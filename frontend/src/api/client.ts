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

export async function buyUnit() {
  const { data } = await api.post('/unit/buy')
  return data
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

export async function fetchLeaderboard() {
  const { data } = await api.get('/leaderboard')
  return data
}

export async function fetchBattles() {
  const { data } = await api.get('/raid/journal')
  return data
}
