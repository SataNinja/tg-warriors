import { create } from 'zustand'
import { GameState } from '../types'

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  setGameState: (state: GameState) => void
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  addCoins: (amount: number) => void
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isLoading: false,
  error: null,

  setGameState: (state) => set({ gameState: state, error: null }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),

  addCoins: (amount) =>
    set((store) => {
      if (!store.gameState) return {}
      return {
        gameState: {
          ...store.gameState,
          user: {
            ...store.gameState.user,
            coins: store.gameState.user.coins + amount
          }
        }
      }
    })
}))
