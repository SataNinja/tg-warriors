import { useEffect, useState } from 'react'
import { authTelegram, fetchGameState } from './api/client'
import { HomePage } from './pages/HomePage'
import { GameState } from './types'

// Telegram WebApp SDK инжектирует глобальный объект window.Telegram
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          start_param?: string
          user?: { id: number; first_name: string; username?: string }
        }
        ready: () => void
        expand: () => void
        close: () => void
        MainButton: {
          show: () => void
          hide: () => void
        }
      }
    }
  }
}

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setError('Открой приложение через Telegram')
      return
    }

    tg.ready()
    tg.expand()

    const init = async () => {
      try {
        const initData = tg.initData

        // Извлекаем реферальный код из start_param (ref_USERID)
        // start_param есть в initDataUnsafe (t.me ссылки) ИЛИ в URL ?startapp= (WebApp кнопки)
        const startParam =
          tg.initDataUnsafe?.start_param ||
          new URLSearchParams(window.location.search).get('startapp') ||
          ''
        let referrerId: number | undefined
        if (startParam.startsWith('ref_')) {
          const parsed = parseInt(startParam.slice(4))
          if (!isNaN(parsed)) referrerId = parsed
        }

        // Авторизуемся и сохраняем токен
        const { access_token } = await authTelegram(initData, referrerId)
        localStorage.setItem('access_token', access_token)

        // Загружаем состояние игры
        const state = await fetchGameState()
        setGameState(state)
      } catch (e) {
        console.error(e)
        setError('Ошибка загрузки игры. Попробуй ещё раз.')
      }
    }

    init()
  }, [])

  const refresh = async () => {
    try {
      const state = await fetchGameState()
      setGameState(state)
    } catch {/* тихо */}
  }

  if (error) {
    return (
      <div style={styles.center}>
        <div style={styles.errorIcon}>⚠️</div>
        <div style={styles.errorText}>{error}</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>⚔️</div>
        <div style={styles.loadText}>Загрузка TG Warriors...</div>
      </div>
    )
  }

  return <HomePage gameState={gameState} onRefresh={refresh} />
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  spinner: { fontSize: 48, animation: 'pulse 1s infinite' },
  loadText: { fontSize: 16, opacity: 0.7 },
  errorIcon: { fontSize: 48 },
  errorText: { fontSize: 16, color: '#f87171', textAlign: 'center', maxWidth: 280 }
}

export default App
