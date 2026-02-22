import { useRef, useCallback } from 'react'
import { useXRift } from '@xrift/world-components'

export const useGameSound = () => {
  const { baseUrl } = useXRift()

  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const shootRef = useRef<HTMLAudioElement | null>(null)
  const powerUpRef = useRef<HTMLAudioElement | null>(null)
  const damage00Ref = useRef<HTMLAudioElement | null>(null)
  const damage10Ref = useRef<HTMLAudioElement | null>(null)
  const initializedRef = useRef(false)

  const init = useCallback(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    bgmRef.current = new Audio(`${baseUrl}BGM.mp3`)
    bgmRef.current.loop = true
    bgmRef.current.volume = 0.1

    shootRef.current = new Audio(`${baseUrl}Shoot.mp3`)
    shootRef.current.volume = 0.1

    powerUpRef.current = new Audio(`${baseUrl}PowerUp.mp3`)
    powerUpRef.current.volume = 0.2

    damage00Ref.current = new Audio(`${baseUrl}Damage00.mp3`)
    damage00Ref.current.volume = 0.2

    damage10Ref.current = new Audio(`${baseUrl}Damage10.mp3`)
    damage10Ref.current.volume = 0.2
  }, [baseUrl])

  const playBGM = useCallback(() => {
    init()
    bgmRef.current?.play().catch(() => {})
  }, [init])

  const stopBGM = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.currentTime = 0
    }
  }, [])

  const playShoot = useCallback(() => {
    if (shootRef.current) {
      shootRef.current.currentTime = 0
      shootRef.current.play().catch(() => {})
    }
  }, [])

  const playPowerUp = useCallback(() => {
    if (powerUpRef.current) {
      powerUpRef.current.currentTime = 0
      powerUpRef.current.play().catch(() => {})
    }
  }, [])

  const playDamage00 = useCallback(() => {
    if (damage00Ref.current) {
      damage00Ref.current.currentTime = 0
      damage00Ref.current.play().catch(() => {})
    }
  }, [])

  const playDamage10 = useCallback(() => {
    if (damage10Ref.current) {
      damage10Ref.current.currentTime = 0
      damage10Ref.current.play().catch(() => {})
    }
  }, [])

  return { playBGM, stopBGM, playShoot, playPowerUp, playDamage00, playDamage10 }
}
