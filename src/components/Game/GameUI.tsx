import { useState, useEffect } from 'react'
import { Html } from '@react-three/drei'
import type { GameStatus, ScoreEntry } from './types'

interface GameUIProps {
  status: GameStatus
  score: number
  hp: number
  timeLeft: number
  wave: number
  sharedScores?: string
  damageTakenCount?: number
}

export const GameUI = ({ status, score, hp, timeLeft, wave, sharedScores, damageTakenCount }: GameUIProps) => {
  const [isFlashing, setIsFlashing] = useState(false)

  useEffect(() => {
    if (!damageTakenCount) return
    setIsFlashing(true)
    const timer = setTimeout(() => setIsFlashing(false), 600)
    return () => clearTimeout(timer)
  }, [damageTakenCount])

  // スタート画面（ボタンなし、pointerEventsを無効化）
  if (status === 'start') {
    return null  // 3D看板で表示するため、HTMLは不要
  }

  // ゲームオーバー画面（ボタンなし、pointerEventsを無効化）
  if (status === 'gameover') {
    const isTimeUp = timeLeft <= 0 && hp > 0
    const title = isTimeUp ? 'TIME UP' : 'GAME OVER'

    let scoreList: ScoreEntry[] = []
    try {
      scoreList = JSON.parse(sharedScores || '[]')
    } catch {
      scoreList = []
    }

    return (
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            pointerEvents: 'none',
          }}
        >
          <h1 style={{ fontSize: '60px', marginBottom: '30px', color: '#ff4444' }}>{title}</h1>
          <div style={{ fontSize: '32px', marginBottom: '20px' }}>
            Score: <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{score}</span>
          </div>

          {/* スコアボード */}
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              minWidth: '300px',
              marginBottom: '30px',
            }}
          >
            <h2 style={{ fontSize: '20px', marginBottom: '10px', color: '#FFD700' }}>🏆 RANKING</h2>
            {scoreList.length === 0 ? (
              <p style={{ color: '#aaa' }}>まだスコアがありません</p>
            ) : (
              scoreList.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    fontSize: '16px',
                    color:
                      i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'white',
                  }}
                >
                  <span>
                    {i + 1}. {entry.name}
                  </span>
                  <span>{entry.score.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Html>
    )
  }

  // プレイ中のHUD
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      {isFlashing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 0, 0, 0.35)',
            pointerEvents: 'none',
            animation: 'damageFlash 0.6s ease-out forwards',
          }}
        />
      )}

      {isFlashing && (
        <style>{`
          @keyframes damageFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      )}

      <style>{`
        .game-hud {
          top: 20px;
        }

        @supports (top: env(safe-area-inset-top, 0px)) {
          .game-hud {
            top: calc(20px + env(safe-area-inset-top, 0px));
          }
        }
      `}</style>
      <div
        className="game-hud"
        style={{
          position: 'fixed',
          left: '50%',
          zIndex: 0,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '30px',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
        }}
      >
        <div>Score: {score}</div>
        <div>
          HP: {Array.from({ length: hp }).map((_, i) => (
            <span key={i} style={{ color: '#ff4444' }}>♥</span>
          ))}
        </div>
        <div>Time: {timeLeft}s</div>
        <div>Wave: {wave}</div>
      </div>
    </Html>
  )
}
