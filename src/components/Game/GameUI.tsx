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
  bulletCount?: number
  speedMultiplier?: number
}

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

interface PlayerHUDProps {
  score: number
  hp: number
  timeLeft: number
  wave: number
  bulletCount: number
  speedMultiplier: number
}

const offset = new THREE.Vector3(0, 0.4, -1.5)

const PlayerHUD = ({ score, hp, timeLeft, wave, bulletCount, speedMultiplier }: PlayerHUDProps) => {
  const hudRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!hudRef.current) return

    // カメラの位置と回転を取得
    const camera = state.camera

    // HUDをカメラの少し前（Z=-1.5）、少し上（Y=0.4）に配置
    hudRef.current.position.copy(offset)
    hudRef.current.position.applyQuaternion(camera.quaternion)
    
    // カメラ位置にオフセットを足してHUD位置を決定
    hudRef.current.position.add(camera.position)
    
    // 常にカメラを向くように回転を設定
    hudRef.current.quaternion.copy(camera.quaternion)
  })

  // HPの描画
  const hpString = Array.from({ length: hp }).map(() => '♥').join('')
  
  // 弾数の描画（最大5）
  const bulletLv = Math.min(5, Math.max(0, bulletCount))
  const bulletGauge = '■'.repeat(bulletLv) + '□'.repeat(5 - bulletLv)

  // 速度の描画（初期値1.0=Lv1、最大3.0=Lv5）
  const speedLv = Math.min(5, Math.max(1, Math.round((speedMultiplier - 1.0) / 0.5) + 1))
  const speedGauge = '■'.repeat(speedLv) + '□'.repeat(5 - speedLv)

  return (
    <group ref={hudRef}>
      {/* 半透明の背景パネル */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.2, 0.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} />
      </mesh>

      {/* スコア・タイム・ウェーブ */}
      <Text position={[-0.5, 0.05, 0]} fontSize={0.04} color="white" anchorX="left" anchorY="middle">
        {`SCORE: ${score}`}
      </Text>
      <Text position={[0, 0.05, 0]} fontSize={0.04} color="white" anchorX="center" anchorY="middle">
        {`TIME: ${timeLeft}s`}
      </Text>
      <Text position={[0.5, 0.05, 0]} fontSize={0.04} color="white" anchorX="right" anchorY="middle">
        {`WAVE: ${wave}`}
      </Text>

      {/* HP・弾数・スピード */}
      <Text position={[-0.5, -0.05, 0]} fontSize={0.032} color="#ff4444" anchorX="left" anchorY="middle">
        {`HP: ${hpString}`}
      </Text>

      {/* 弾数 */}
      <Text position={[0, -0.052, 0]} fontSize={0.038} color="#44ff44" anchorX="center" anchorY="middle">
        {`弾数: ${bulletGauge}`}
      </Text>

      {/* スピード */}
      <Text position={[0.5, -0.052, 0]} fontSize={0.038} color="#4488ff" anchorX="right" anchorY="middle">
        {`弾速: ${speedGauge}`}
      </Text>
    </group>
  )
}

export const GameUI = ({ 
  status, 
  score, 
  hp, 
  timeLeft, 
  wave, 
  sharedScores, 
  damageTakenCount,
  bulletCount = 1,
  speedMultiplier = 1
}: GameUIProps) => {
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
    <>
      {/* ダメージ演出（画面全体） */}
      {isFlashing && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
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
          <style>{`
            @keyframes damageFlash {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </Html>
      )}

      {/* 3Dカメラ追従HUD */}
      <PlayerHUD
        score={score}
        hp={hp}
        timeLeft={timeLeft}
        wave={wave}
        bulletCount={bulletCount}
        speedMultiplier={speedMultiplier}
      />
    </>
  )
}
