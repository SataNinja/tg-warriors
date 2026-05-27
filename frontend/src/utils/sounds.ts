/**
 * Простые звуковые эффекты через Web Audio API.
 * Никаких файлов — всё генерируется налету.
 * Громкость намеренно низкая, чтобы не мешать.
 */

let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume()
    }
    return _ctx
  } catch {
    return null
  }
}

function tone(
  freq: number,
  duration: number,
  volume = 0.1,
  type: OscillatorType = 'sine',
  delay = 0,
) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + delay)
  gain.gain.setValueAtTime(0.001, c.currentTime + delay)
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration)
  osc.start(c.currentTime + delay)
  osc.stop(c.currentTime + delay + duration + 0.05)
}

/** Лёгкий клик на кнопку */
export function sfxClick() {
  tone(700, 0.04, 0.06, 'square')
}

/** Успешное действие (купил, вступил, создал) */
export function sfxSuccess() {
  tone(523, 0.08, 0.09)
  tone(784, 0.12, 0.09, 'sine', 0.09)
}

/** Ошибка / отказ */
export function sfxError() {
  tone(220, 0.1, 0.09, 'sawtooth')
  tone(160, 0.14, 0.07, 'sawtooth', 0.09)
}

/** Монеты / награда */
export function sfxCoin() {
  tone(1047, 0.05, 0.08)
  tone(1319, 0.08, 0.09, 'sine', 0.06)
  tone(1568, 0.1,  0.08, 'sine', 0.13)
}

/** Победа в бою */
export function sfxWin() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => tone(f, 0.14, 0.09, 'sine', i * 0.09))
}

/** Поражение в бою */
export function sfxLose() {
  tone(330, 0.1,  0.09, 'triangle')
  tone(220, 0.18, 0.08, 'triangle', 0.1)
}

/** Удар / атака */
export function sfxHit() {
  tone(280, 0.06, 0.1, 'sawtooth')
  tone(180, 0.1,  0.07, 'sawtooth', 0.05)
}
