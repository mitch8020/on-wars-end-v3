import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../game/types'

export const AUDIO_PREFERENCE_KEY = 'on-wars-end-v3:table-audio'

type TableSound = 'card' | 'marker' | 'paper' | 'stamp'

const SOUND_SHAPE: Record<TableSound, { frequency: number; duration: number; volume: number }> = {
  card: { frequency: 182, duration: 0.07, volume: 0.025 },
  marker: { frequency: 122, duration: 0.09, volume: 0.035 },
  paper: { frequency: 238, duration: 0.055, volume: 0.018 },
  stamp: { frequency: 82, duration: 0.14, volume: 0.055 },
}

export function playTableSound(
  sound: TableSound,
  AudioContextConstructor: typeof AudioContext | undefined = globalThis.AudioContext,
) {
  if (!AudioContextConstructor) return
  const context = new AudioContextConstructor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const shape = SOUND_SHAPE[sound]
  oscillator.type = sound === 'paper' || sound === 'card' ? 'triangle' : 'sine'
  oscillator.frequency.setValueAtTime(shape.frequency, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(34, shape.frequency * 0.54),
    context.currentTime + shape.duration,
  )
  gain.gain.setValueAtTime(shape.volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + shape.duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + shape.duration)
  oscillator.addEventListener('ended', () => void context.close(), { once: true })
}

export function useTableAudio(state: GameState) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(AUDIO_PREFERENCE_KEY) === 'on')
  const previous = useRef(state)

  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (!enabled || before === state) return

    const beforeSigned = before.countryOrder.filter((country) => before.countries[country].signed).length
    const signed = state.countryOrder.filter((country) => state.countries[country].signed).length
    if (signed > beforeSigned) playTableSound('stamp')
    else if (state.phase !== before.phase) playTableSound(state.phase === 'cabinet' ? 'card' : 'paper')
    else if (state.log.length > before.log.length) playTableSound('marker')
  }, [enabled, state])

  const toggle = () => {
    setEnabled((current) => {
      const next = !current
      localStorage.setItem(AUDIO_PREFERENCE_KEY, next ? 'on' : 'off')
      if (next) playTableSound('paper')
      return next
    })
  }

  return { enabled, toggle }
}
