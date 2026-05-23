import { create } from 'zustand'
import { GameState, RaidResult, PveRaidResult } from '../types'

/** Данные текущего (или недавнего) боя — хранятся между сменами вкладок */
export interface OngoingBattle {
  result: RaidResult | PveRaidResult
  animData: { ap: number; dp: number; isPve: boolean }
  startedAt: number   // Date.now() в момент старта анимации
  duration: number    // полная длина анимации в мс (рассчитана один раз)
}

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  /** Текущий бой: сохраняется при смене вкладок, очищается по завершении анимации */
  ongoingBattle: OngoingBattle | null

  setGameState: (state: GameState) => void
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  addCoins: (amount: number) => void
  setOngoingBattle: (b: OngoingBattle | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isLoading: false,
  error: null,
  ongoingBattle: null,

  setGameState: (state) => set({ gameState: state, error: null }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),
  setOngoingBattle: (b) => set({ ongoingBattle: b }),

  addCoins: (amount) =>
    set((store) => {
      if (!store.gameState) return {}
      return {
        gameState: {
          ...store.gameState,
          user: {
            ...store.gameState.user,
            coins: store.gameState.user.coins + amount,
          },
        },
      }
    }),
}))
