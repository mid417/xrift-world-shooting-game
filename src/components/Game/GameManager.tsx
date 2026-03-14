import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useInstanceState, useUsers, Interactable } from '@xrift/world-components'
import type { GameState, UIState, ScoreEntry, ChainLabel, Item } from './types'
import { addBulletColumn, getBulletXOffsets } from './bulletPattern'
import { GameUI } from './GameUI'
import { InstructionBoard } from './InstructionBoard'
import { useGameSound } from './useGameSound'

// ゲーム定数
const GAME_CONFIG = {
  SPAWN_DISTANCE: 25,         // 敵・アイテムのスポーン距離
  MAX_OBJECT_DISTANCE: 30,    // オブジェクトの最大有効距離
  PLAYER_SPEED: 5.0,
  BULLET_SPEED: 10,
  ENEMY_SPEED: 2.4,           // 敵の基本移動速度
  ITEM_SPEED: 1.8,            // アイテムの移動速度
  SHOT_INTERVAL: 0.3,
  INITIAL_HP: 5,
  GAME_DURATION: 300,
  OBJECT_Y: 0.4,
  COLLISION_DISTANCE: 0.6,     // 衝突判定距離
  ITEM_COLLISION_DISTANCE: 1.8, // アイテム取得判定距離（通常の3倍）
  PASS_THROUGH_THRESHOLD: 3,   // 通り過ぎ判定距離
  // InstancedMesh用の最大インスタンス数
  MAX_BULLETS: 200,
  MAX_ENEMIES: 100,
  MAX_ITEMS_PER_TYPE: 50,
  MAX_HIT_EFFECTS: 100,      // 追加
  HIT_EFFECT_DURATION: 0.3,  // 追加（秒）
  // 敵スポーン制御（時間ベース）
  BASE_ENEMIES_PER_WAVE: 2,         // 最小スポーン数
  ENEMY_COUNT_SCALE_INTERVAL: 20,   // 何秒ごとに敵数+1するか
  MAX_ENEMIES_PER_SPAWN: 12,        // 1スポーンあたり最大敵数
  SPAWN_INTERVAL_MIN: 2.0,          // スポーン間隔の最小（秒）
  SPAWN_INTERVAL_INITIAL: 5.0,      // スポーン間隔の初期値（秒）
  BULLET_SPEED_MULTIPLIERS: [1.5, 2.0, 2.5, 3.0] as const,
} as const

// 画面外座標（未使用インスタンス用）
const OFF_SCREEN_POS = new THREE.Vector3(0, -1000, 0)

export const GameManager = () => {
  // useInstanceState と useUsers（トップレベルで呼び出す）
  const { localUser } = useUsers()
  const [sharedScores, setSharedScores] = useInstanceState<string>('game3-highscores-v1', '[]')

  // サウンドシステム
  const { playBGM, stopBGM, playShoot, playPowerUp, playDamage00, playDamage10 } = useGameSound()

  // InstancedMesh の参照
  const bulletMeshRef = useRef<THREE.InstancedMesh>(null)
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null)
  const itemPlusMeshRef = useRef<THREE.InstancedMesh>(null)
  const itemSpeedMeshRef = useRef<THREE.InstancedMesh>(null)
  const itemHealMeshRef = useRef<THREE.InstancedMesh>(null)
  const hitEffectMeshRef = useRef<THREE.InstancedMesh>(null)

  // Matrix4 とベクトルの再利用(パフォーマンス最適化)
  const matrixRef = useRef(new THREE.Matrix4())
  const hitMatrixRef = useRef(new THREE.Matrix4())
  const posVecRef = useRef(new THREE.Vector3())
  const quatRef = useRef(new THREE.Quaternion())
  const scaleVecRef = useRef(new THREE.Vector3())

  // ゲーム状態(useRef: 高頻度更新、レンダリング不要)
  const gameState = useRef<GameState>({
    bullets: [],
    enemies: [],
    items: [],
    hitEffects: [],
    playerX: 0,
    playerZ: 0,
    lastShotTime: 0,
    lastEnemySpawnTime: 0,
    lastItemSpawnTime: 0,
    nextItemSpawnTime: 15 + Math.random() * 15, // 15〜30秒
    lastHitTime: 0,
    chainCount: 0,
  })

  // UI状態（useState: UIレンダリングに必要）
  const [uiState, setUIState] = useState<UIState>({
    status: 'start',
    score: 0,
    hp: GAME_CONFIG.INITIAL_HP,
    timeLeft: GAME_CONFIG.GAME_DURATION,
    wave: 1,
    bulletPattern: ['center'],
    damageTakenCount: 0,
    bulletSpeedMultiplier: 1.0,
  })

  // チェーンラベル管理（RefとStateを分離してパフォーマンス向上）
  const chainLabelsRef = useRef<ChainLabel[]>([])
  const [chainLabels, setChainLabels] = useState<ChainLabel[]>([])

  const startTimeRef = useRef<number>(0)
  const spawnCountRef = useRef<number>(0)
  const forwardVecRef = useRef(new THREE.Vector3())
  const rightVecRef = useRef(new THREE.Vector3())

  // ゲーム開始
  const handleStart = () => {
    gameState.current = {
      bullets: [],
      enemies: [],
      items: [],
      hitEffects: [],
      playerX: 0,
      playerZ: 0,
      lastShotTime: 0,
      lastEnemySpawnTime: 0,
      lastItemSpawnTime: 0,
      nextItemSpawnTime: 15 + Math.random() * 15,
      lastHitTime: 0,
      chainCount: 0,
    }

    setUIState({
      status: 'playing',
      score: 0,
      hp: GAME_CONFIG.INITIAL_HP,
      timeLeft: GAME_CONFIG.GAME_DURATION,
      wave: 1,
      bulletPattern: ['center'],
      damageTakenCount: 0,
      bulletSpeedMultiplier: 1.0,
    })

    chainLabelsRef.current = []
    setChainLabels([])
    playBGM()
    startTimeRef.current = Date.now() / 1000
    spawnCountRef.current = 0
  }

  // ゲームループ
  useFrame((rfState, delta) => {
    if (uiState.status !== 'playing') return

    const state = gameState.current
    const now = Date.now() / 1000

    // カメラXZ位置をプレイヤー位置に同期
    state.playerX = rfState.camera.position.x
    state.playerZ = rfState.camera.position.z

    // カメラの前方ベクトルを取得（XZ平面のみ）
    const forward = forwardVecRef.current
    rfState.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    // 経過時間更新
    const elapsed = now - startTimeRef.current
    const newTimeLeft = Math.max(0, Math.ceil(GAME_CONFIG.GAME_DURATION - elapsed))

    // ゲームオーバー判定
    if (uiState.hp <= 0 || newTimeLeft <= 0) {
      // スコアを保存
      const playerName = localUser?.displayName || 'Player'
      const currentScore = uiState.score
      try {
        const existing: ScoreEntry[] = JSON.parse(sharedScores || '[]')
        existing.push({ name: playerName, score: currentScore, timestamp: Date.now() })
        existing.sort((a, b) => b.score - a.score)
        setSharedScores(JSON.stringify(existing.slice(0, 10)))
      } catch (error) {
        console.warn('Failed to save score:', error)
      }
      stopBGM()
      // 敵と弾をクリア
      state.bullets = []
      state.enemies = []
      const isTimeUp = newTimeLeft <= 0 && uiState.hp > 0
      setUIState((prev) => ({ ...prev, status: 'gameover', timeLeft: isTimeUp ? 0 : newTimeLeft }))
      
      // メッシュの即座更新（敵と弾を画面から消す）
      const matrix = matrixRef.current
      if (bulletMeshRef.current) {
        const mesh = bulletMeshRef.current
        for (let i = 0; i < GAME_CONFIG.MAX_BULLETS; i++) {
          matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
          mesh.setMatrixAt(i, matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
      }
      if (enemyMeshRef.current) {
        const mesh = enemyMeshRef.current
        for (let i = 0; i < GAME_CONFIG.MAX_ENEMIES; i++) {
          matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
          mesh.setMatrixAt(i, matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
      }
      return
    }

    // 自動発射
    if (now - state.lastShotTime >= GAME_CONFIG.SHOT_INTERVAL) {
      state.lastShotTime = now
      playShoot()
      const offsets = getBulletXOffsets(uiState.bulletPattern)
      
      // カメラの右方向ベクトル（XZ平面）
      const right = rightVecRef.current.set(-forward.z, 0, forward.x)
      
      offsets.forEach((offset) => {
        const bx = state.playerX + right.x * offset
        const bz = state.playerZ + right.z * offset
        
        state.bullets.push({
          id: `bullet-${Date.now()}-${Math.random()}`,
          x: bx,
          z: bz,
          vx: forward.x * GAME_CONFIG.BULLET_SPEED * uiState.bulletSpeedMultiplier,
          vz: forward.z * GAME_CONFIG.BULLET_SPEED * uiState.bulletSpeedMultiplier,
        })
      })
    }

    // 弾の移動
    {
      const bullets = state.bullets
      const maxDist2 = GAME_CONFIG.MAX_OBJECT_DISTANCE * GAME_CONFIG.MAX_OBJECT_DISTANCE
      let writeIndex = 0
      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i]
        bullet.x += bullet.vx * delta
        bullet.z += bullet.vz * delta

        // プレイヤーからの距離チェック
        const dx = bullet.x - state.playerX
        const dz = bullet.z - state.playerZ
        const dist2 = dx * dx + dz * dz
        if (dist2 < maxDist2) {
          bullets[writeIndex] = bullet
          writeIndex += 1
        }
      }
      bullets.length = writeIndex
    }

    // 敵の移動と通過ダメージ
    let escapeDamage = 0
    {
      const enemies = state.enemies
      const maxDist2 = GAME_CONFIG.MAX_OBJECT_DISTANCE * GAME_CONFIG.MAX_OBJECT_DISTANCE
      const passThroughDist2 = GAME_CONFIG.PASS_THROUGH_THRESHOLD * GAME_CONFIG.PASS_THROUGH_THRESHOLD
      let writeIndex = 0
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i]
        const speed = GAME_CONFIG.ENEMY_SPEED + (uiState.wave - 1) * 0.1
        enemy.x += enemy.vx * speed * delta
        enemy.z += enemy.vz * speed * delta

        const dx = enemy.x - state.playerX
        const dz = enemy.z - state.playerZ
        const dist2 = dx * dx + dz * dz

        // 最大距離到達で削除（ダメージなし）
        if (dist2 >= maxDist2) continue

        // 近距離でプレイヤーを通り過ぎた場合はダメージ
        const passedThrough = (enemy.x - state.playerX) * enemy.vx + (enemy.z - state.playerZ) * enemy.vz > 0
        if (passedThrough && dist2 < passThroughDist2) {
          escapeDamage += 1
          continue
        }

        enemies[writeIndex] = enemy
        writeIndex += 1
      }
      enemies.length = writeIndex
    }

    // アイテムの移動
    {
      const items = state.items
      const maxDist2 = GAME_CONFIG.MAX_OBJECT_DISTANCE * GAME_CONFIG.MAX_OBJECT_DISTANCE
      const passThroughDist2 = GAME_CONFIG.PASS_THROUGH_THRESHOLD * GAME_CONFIG.PASS_THROUGH_THRESHOLD
      let writeIndex = 0
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        item.x += item.vx * GAME_CONFIG.ITEM_SPEED * delta
        item.z += item.vz * GAME_CONFIG.ITEM_SPEED * delta

        const dx = item.x - state.playerX
        const dz = item.z - state.playerZ
        const dist2 = dx * dx + dz * dz

        // プレイヤーを通り過ぎたか（velocity方向を使用）
        const passedThrough = (item.x - state.playerX) * item.vx + (item.z - state.playerZ) * item.vz > 0
        if (passedThrough && dist2 < passThroughDist2) continue

        if (dist2 < maxDist2) {
          items[writeIndex] = item
          writeIndex += 1
        }
      }
      items.length = writeIndex
    }

    // 弾と敵の衝突判定
    let scoreGain = 0
    const destroyedEnemies = new Set<string>()
    const destroyedBullets = new Set<string>()
    const collisionDist2 = GAME_CONFIG.COLLISION_DISTANCE * GAME_CONFIG.COLLISION_DISTANCE

    state.bullets.forEach((bullet) => {
      if (destroyedBullets.has(bullet.id)) return

      state.enemies.forEach((enemy) => {
        if (destroyedEnemies.has(enemy.id)) return

        const dx = bullet.x - enemy.x
        const dz = bullet.z - enemy.z
        const distance2 = dx * dx + dz * dz

        if (distance2 < collisionDist2) {
          enemy.hp -= 1
          destroyedBullets.add(bullet.id)

          if (enemy.hp <= 0) {
            destroyedEnemies.add(enemy.id)
            
            // チェーンカウント計算
            const nowMs = Date.now()
            const nowSec = nowMs / 1000
            const timeSinceLastHit = nowSec - state.lastHitTime
            
            if (timeSinceLastHit <= 0.8 && state.lastHitTime > 0) {
              // 0.8秒以内ならチェーン継続
              state.chainCount = Math.min(state.chainCount + 1, 9)
            } else {
              // 0.8秒以上経過していたらリセット
              state.chainCount = 1
            }
            
            state.lastHitTime = nowSec
            
            // スコア加算（100 × chainCount）
            scoreGain += 100 * state.chainCount
            playDamage10()
            
            // ヒットエフェクト追加
            state.hitEffects.push({
              id: `hit-${nowMs}-${Math.random()}`,
              x: enemy.x,
              z: enemy.z,
              age: 0,
              chain: state.chainCount,
            })
            
            // チェーンラベル追加（Refに追加、State更新は後で同期）
            chainLabelsRef.current.push({
              id: `chain-${nowMs}-${Math.random()}`,
              x: enemy.x,
              z: enemy.z,
              chain: state.chainCount,
              startTime: nowMs,
            })
          }
        }
      })
    })

    if (destroyedBullets.size > 0) {
      const bullets = state.bullets
      let writeIndex = 0
      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i]
        if (!destroyedBullets.has(bullet.id)) {
          bullets[writeIndex] = bullet
          writeIndex += 1
        }
      }
      bullets.length = writeIndex
    }

    if (destroyedEnemies.size > 0) {
      const enemies = state.enemies
      let writeIndex = 0
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i]
        if (!destroyedEnemies.has(enemy.id)) {
          enemies[writeIndex] = enemy
          writeIndex += 1
        }
      }
      enemies.length = writeIndex
    }

    // プレイヤーと敵の衝突判定
    let collisionDamage = 0
    {
      const enemies = state.enemies
      const collisionDist2 = GAME_CONFIG.COLLISION_DISTANCE * GAME_CONFIG.COLLISION_DISTANCE
      let writeIndex = 0
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i]
        const dx = state.playerX - enemy.x
        const dz = state.playerZ - enemy.z
        const distance2 = dx * dx + dz * dz

        if (distance2 < collisionDist2) {
          collisionDamage += 1
          continue
        }

        enemies[writeIndex] = enemy
        writeIndex += 1
      }
      enemies.length = writeIndex
    }

    // プレイヤーとアイテムの衝突判定
    let patternChanged = false
    let newPattern = uiState.bulletPattern
    let speedMultiplierChanged = false
    let newSpeedMultiplier = uiState.bulletSpeedMultiplier
    let hpGain = 0

    {
      const items = state.items
      const collisionDist2 = GAME_CONFIG.ITEM_COLLISION_DISTANCE * GAME_CONFIG.ITEM_COLLISION_DISTANCE
      let writeIndex = 0
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const dx = state.playerX - item.x
        const dz = state.playerZ - item.z
        const distance2 = dx * dx + dz * dz

        if (distance2 < collisionDist2) {
          if (item.type === '+') {
            playPowerUp()
            if (newPattern.length >= 5) {
              scoreGain += 200  // 上限に達した場合はボーナス点
            } else {
              newPattern = addBulletColumn(newPattern)
              patternChanged = true
            }
          } else if (item.type === 'speed') {
            playPowerUp()
            const currentIndex = GAME_CONFIG.BULLET_SPEED_MULTIPLIERS.findIndex((m) => m === newSpeedMultiplier)
            if (currentIndex < GAME_CONFIG.BULLET_SPEED_MULTIPLIERS.length - 1) {
              newSpeedMultiplier = GAME_CONFIG.BULLET_SPEED_MULTIPLIERS[currentIndex + 1]
              speedMultiplierChanged = true
            } else {
              scoreGain += 200  // 上限に達した場合はボーナス点
            }
          } else if (item.type === 'heal') {
            playPowerUp()
            hpGain = Math.min(1, GAME_CONFIG.INITIAL_HP - uiState.hp)
          }
          continue
        }

        items[writeIndex] = item
        writeIndex += 1
      }
      items.length = writeIndex
    }

    // 敵のスポーン（時間経過で難易度上昇）
    // スポーン間隔: 開始時5秒 → 時間とともに短縮、最小2秒
    const spawnInterval = Math.max(
      GAME_CONFIG.SPAWN_INTERVAL_MIN,
      GAME_CONFIG.SPAWN_INTERVAL_INITIAL - Math.floor(elapsed / 30) * 0.5
    )

    if (now - state.lastEnemySpawnTime >= spawnInterval) {
      state.lastEnemySpawnTime = now
      spawnCountRef.current += 1

      // Wave: 30秒ごとに1増加（より緩やかな上昇）
      const currentWave = Math.floor(elapsed / 30) + 1

      // 敵数: 基本2体から始まり、20秒ごとに+1体（最大12体）、±1体のランダム
      const baseCount = GAME_CONFIG.BASE_ENEMIES_PER_WAVE + Math.floor(elapsed / GAME_CONFIG.ENEMY_COUNT_SCALE_INTERVAL)
      const enemyCount = Math.min(
        baseCount + Math.floor(Math.random() * 2),
        GAME_CONFIG.MAX_ENEMIES_PER_SPAWN
      )

      for (let i = 0; i < enemyCount; i++) {
        // カメラ前方にスポーン
        const spawnX = state.playerX + forward.x * GAME_CONFIG.SPAWN_DISTANCE + (Math.random() - 0.5) * 12
        const spawnZ = state.playerZ + forward.z * GAME_CONFIG.SPAWN_DISTANCE + (Math.random() - 0.5) * 4
        
        state.enemies.push({
          id: `enemy-${Date.now()}-${Math.random()}`,
          x: spawnX,
          z: spawnZ,
          hp: 1,
          vx: -forward.x,
          vz: -forward.z,
        })
      }

      if (currentWave !== uiState.wave) {
        setUIState((prev) => ({ ...prev, wave: currentWave }))
      }
    }

    // アイテムのスポーン
    if (now - state.lastItemSpawnTime >= state.nextItemSpawnTime) {
      state.lastItemSpawnTime = now
      state.nextItemSpawnTime = 15 + Math.random() * 15

      const rand = Math.random()
      const itemType: Item['type'] =
        rand < 0.4 ? '+' :
        rand < 0.8 ? 'speed' : 'heal'
      
      // カメラ前方にスポーン
      const spawnX = state.playerX + forward.x * GAME_CONFIG.SPAWN_DISTANCE + (Math.random() - 0.5) * 10
      const spawnZ = state.playerZ + forward.z * GAME_CONFIG.SPAWN_DISTANCE + (Math.random() - 0.5) * 4
      
      state.items.push({
        id: `item-${Date.now()}-${Math.random()}`,
        x: spawnX,
        z: spawnZ,
        type: itemType,
        vx: -forward.x,
        vz: -forward.z,
      })
    }

    // ヒットエフェクトの更新
    {
      const effects = state.hitEffects
      let writeIndex = 0
      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i]
        effect.age += delta
        if (effect.age < GAME_CONFIG.HIT_EFFECT_DURATION) {
          effects[writeIndex] = effect
          writeIndex += 1
        }
      }
      effects.length = writeIndex
    }

    // チェーンラベルのクリーンアップ（毎フレーム実行）
    const nowMs = Date.now()
    {
      const labels = chainLabelsRef.current
      const maxAgeMs = GAME_CONFIG.HIT_EFFECT_DURATION * 1000
      let writeIndex = 0
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i]
        if (nowMs - label.startTime <= maxAgeMs) {
          labels[writeIndex] = label
          writeIndex += 1
        }
      }
      labels.length = writeIndex
    }

    // UI状態を更新（必要な場合のみ）
    const totalHpLoss = collisionDamage + escapeDamage
    if (totalHpLoss > 0) {
      playDamage00()
    }
    if (scoreGain > 0 || totalHpLoss > 0 || hpGain > 0 || patternChanged || speedMultiplierChanged || newTimeLeft !== uiState.timeLeft) {
      setUIState((prev) => ({
        ...prev,
        score: prev.score + scoreGain,
        hp: Math.min(GAME_CONFIG.INITIAL_HP, Math.max(0, prev.hp - totalHpLoss + hpGain)),
        timeLeft: newTimeLeft,
        bulletPattern: patternChanged ? newPattern : prev.bulletPattern,
        bulletSpeedMultiplier: speedMultiplierChanged ? newSpeedMultiplier : prev.bulletSpeedMultiplier,
        damageTakenCount: totalHpLoss > 0 ? prev.damageTakenCount + 1 : prev.damageTakenCount,
      }))
      
      // チェーンラベルの同期（RefからStateへ）
      setChainLabels([...chainLabelsRef.current])
    }

    // ========== InstancedMesh の更新 ==========
    const matrix = matrixRef.current

    // 弾の描画更新
    if (bulletMeshRef.current) {
      const mesh = bulletMeshRef.current
      for (let i = 0; i < GAME_CONFIG.MAX_BULLETS; i++) {
        if (i < state.bullets.length) {
          const bullet = state.bullets[i]
          matrix.setPosition(bullet.x, GAME_CONFIG.OBJECT_Y, bullet.z)
        } else {
          // 未使用インスタンスは画面外に配置
          matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
        }
        mesh.setMatrixAt(i, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    // 敵の描画更新
    if (enemyMeshRef.current) {
      const mesh = enemyMeshRef.current
      for (let i = 0; i < GAME_CONFIG.MAX_ENEMIES; i++) {
        if (i < state.enemies.length) {
          const enemy = state.enemies[i]
          matrix.setPosition(enemy.x, GAME_CONFIG.OBJECT_Y, enemy.z)
        } else {
          matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
        }
        mesh.setMatrixAt(i, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    // アイテムの描画更新（単一パスで各タイプのInstancedMeshを更新）
    {
      const plusMesh = itemPlusMeshRef.current
      const speedMesh = itemSpeedMeshRef.current
      const healMesh = itemHealMeshRef.current

      if (plusMesh || speedMesh || healMesh) {
        let plusIndex = 0
        let speedIndex = 0
        let healIndex = 0

        for (let i = 0; i < state.items.length; i++) {
          const item = state.items[i]
          if (item.type === '+') {
            if (plusMesh && plusIndex < GAME_CONFIG.MAX_ITEMS_PER_TYPE) {
              matrix.setPosition(item.x, GAME_CONFIG.OBJECT_Y, item.z)
              plusMesh.setMatrixAt(plusIndex, matrix)
              plusIndex += 1
            }
          } else if (item.type === 'speed') {
            if (speedMesh && speedIndex < GAME_CONFIG.MAX_ITEMS_PER_TYPE) {
              matrix.setPosition(item.x, GAME_CONFIG.OBJECT_Y, item.z)
              speedMesh.setMatrixAt(speedIndex, matrix)
              speedIndex += 1
            }
          } else if (item.type === 'heal') {
            if (healMesh && healIndex < GAME_CONFIG.MAX_ITEMS_PER_TYPE) {
              matrix.setPosition(item.x, GAME_CONFIG.OBJECT_Y, item.z)
              healMesh.setMatrixAt(healIndex, matrix)
              healIndex += 1
            }
          }
        }

        if (plusMesh) {
          for (let i = plusIndex; i < GAME_CONFIG.MAX_ITEMS_PER_TYPE; i++) {
            matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
            plusMesh.setMatrixAt(i, matrix)
          }
          plusMesh.instanceMatrix.needsUpdate = true
        }

        if (speedMesh) {
          for (let i = speedIndex; i < GAME_CONFIG.MAX_ITEMS_PER_TYPE; i++) {
            matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
            speedMesh.setMatrixAt(i, matrix)
          }
          speedMesh.instanceMatrix.needsUpdate = true
        }

        if (healMesh) {
          for (let i = healIndex; i < GAME_CONFIG.MAX_ITEMS_PER_TYPE; i++) {
            matrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
            healMesh.setMatrixAt(i, matrix)
          }
          healMesh.instanceMatrix.needsUpdate = true
        }
      }
    }

    // ヒットエフェクトの描画更新
    if (hitEffectMeshRef.current) {
      const mesh = hitEffectMeshRef.current
      const hitMatrix = hitMatrixRef.current
      const pos = posVecRef.current
      const quat = quatRef.current
      const scaleVec = scaleVecRef.current
      
      quat.identity()
      
      for (let i = 0; i < GAME_CONFIG.MAX_HIT_EFFECTS; i++) {
        if (i < state.hitEffects.length) {
          const effect = state.hitEffects[i]
          const progress = effect.age / GAME_CONFIG.HIT_EFFECT_DURATION
          const scale = 0.3 + progress * 2.0
          
          pos.set(effect.x, GAME_CONFIG.OBJECT_Y, effect.z)
          scaleVec.set(scale, scale, scale)
          hitMatrix.compose(pos, quat, scaleVec)
        } else {
          hitMatrix.setPosition(OFF_SCREEN_POS.x, OFF_SCREEN_POS.y, OFF_SCREEN_POS.z)
        }
        mesh.setMatrixAt(i, hitMatrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  // オブジェクトの描画
  const state = gameState.current

  return (
    <>
      {/* UI（スタート・ゲームオーバーのオーバーレイ + プレイ中HUD） */}
      <GameUI
        status={uiState.status}
        score={uiState.score}
        hp={uiState.hp}
        timeLeft={uiState.timeLeft}
        wave={uiState.wave}
        sharedScores={sharedScores}
        damageTakenCount={uiState.damageTakenCount}
        bulletCount={uiState.bulletPattern.length}
        speedMultiplier={uiState.bulletSpeedMultiplier}
      />

      {/* スタート画面の3D立て看板 */}
      {uiState.status === 'start' && <InstructionBoard />}

      {/* スタートボタン（ローカル） */}
      {uiState.status === 'start' && (
        <group position={[0, 1.5, 5]}>
          <Interactable
            id="local-start-button"
            onInteract={handleStart}
            interactionText="ゲームをスタート"
          >
            <mesh castShadow>
              <boxGeometry args={[2.0, 0.6, 0.2]} />
              <meshStandardMaterial color="#4CAF50" emissive="#2d6e30" emissiveIntensity={0.3} />
            </mesh>
          </Interactable>
          <Text
            position={[0, 0, 0.12]}
            fontSize={0.25}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            ▶ PLAY
          </Text>
        </group>
      )}

      {/* リトライボタン（ローカル） */}
      {uiState.status === 'gameover' && (
        <group position={[0, 1.5, 5]}>
          <Interactable
            id="local-retry-button"
            onInteract={handleStart}
            interactionText="もう一度プレイ"
          >
            <mesh castShadow>
              <boxGeometry args={[2.0, 0.6, 0.2]} />
              <meshStandardMaterial color="#2196F3" emissive="#0d4a7a" emissiveIntensity={0.3} />
            </mesh>
          </Interactable>
          <Text
            position={[0, 0, 0.12]}
            fontSize={0.25}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            🔄 RETRY
          </Text>
        </group>
      )}

      {/* 弾(InstancedMesh) */}
      <instancedMesh ref={bulletMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_BULLETS]} frustumCulled={false}>
        <sphereGeometry args={[0.15]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* 敵(InstancedMesh) */}
      <instancedMesh ref={enemyMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_ENEMIES]} frustumCulled={false}>
        <boxGeometry args={[0.8, 0.5, 0.8]} />
        <meshStandardMaterial color="#ff4444" />
      </instancedMesh>

      {/* アイテム(+タイプ、緑) */}
      <instancedMesh ref={itemPlusMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_ITEMS_PER_TYPE]} frustumCulled={false}>
        <octahedronGeometry args={[0.3]} />
        <meshStandardMaterial color="#44ff44" />
      </instancedMesh>


      {/* アイテム(speedタイプ、青) */}
      <instancedMesh ref={itemSpeedMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_ITEMS_PER_TYPE]} frustumCulled={false}>
        <octahedronGeometry args={[0.3]} />
        <meshStandardMaterial color="#4488ff" />
      </instancedMesh>

      {/* アイテム(healタイプ、ピンク) */}
      <instancedMesh ref={itemHealMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_ITEMS_PER_TYPE]} frustumCulled={false}>
        <octahedronGeometry args={[0.3]} />
        <meshStandardMaterial color="#ff88cc" />
      </instancedMesh>

      {/* ヒットエフェクト(InstancedMesh) */}
      <instancedMesh ref={hitEffectMeshRef} args={[undefined, undefined, GAME_CONFIG.MAX_HIT_EFFECTS]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff4400" emissiveIntensity={1.5} transparent opacity={0.8} />
      </instancedMesh>

      {/* アイテムのテキスト(最適化版) */}
      {state.items.map((item) => (
        <Text
          key={item.id}
          position={[item.x, GAME_CONFIG.OBJECT_Y + 0.4, item.z]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0}
        >
          {item.type === 'speed' ? '↑' : item.type === 'heal' ? '♥' : item.type}
        </Text>
      ))}

      {/* チェーンラベル */}
      {chainLabels.map((label) => (
        <Text
          key={label.id}
          position={[label.x, GAME_CONFIG.OBJECT_Y + 1.5, label.z]}
          fontSize={0.8}
          color={label.chain >= 9 ? '#ff4400' : '#ffff00'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {label.chain >= 9 ? 'MAX' : `x${label.chain}`}
        </Text>
      ))}
    </>
  )
}
