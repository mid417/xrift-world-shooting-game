// ゲームの状態
export type GameStatus = 'start' | 'playing' | 'gameover'

// 弾パターンの列定義
export type BulletColumn = 'center' | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3' | 'l4' | 'r4' | 'l5' | 'r5'

// プレイヤーの弾
export interface Bullet {
  id: string
  x: number
  z: number
  vx: number
  vz: number
}

// 敵
export interface Enemy {
  id: string
  x: number
  z: number
  hp: number
  vx: number
  vz: number
}

// アイテム
export interface Item {
  id: string
  x: number
  z: number
  type: '+' | '-'
  vx: number
  vz: number
}

// ゲームの状態
export interface GameState {
  // ゲームオブジェクト（useRef で管理）
  bullets: Bullet[]
  enemies: Enemy[]
  items: Item[]
  hitEffects: HitEffect[]
  
  // プレイヤー状態
  playerX: number
  playerZ: number
  
  // 発射管理
  lastShotTime: number
  
  // スポーン管理
  lastEnemySpawnTime: number
  lastItemSpawnTime: number
  nextItemSpawnTime: number
  
  // チェーン管理
  lastHitTime: number
  chainCount: number
}

// ヒットエフェクト
export interface HitEffect {
  id: string
  x: number
  z: number
  age: number  // 経過秒数
  chain: number  // チェーン数
}

// チェーンラベル
export interface ChainLabel {
  id: string
  x: number
  z: number
  chain: number
  startTime: number
}

// スコアエントリ
export interface ScoreEntry {
  name: string
  score: number
  timestamp: number
}

// UI用の状態（useState で管理）
export interface UIState {
  status: GameStatus
  score: number
  hp: number
  timeLeft: number
  wave: number
  bulletPattern: BulletColumn[]
  damageTakenCount: number  // HP減少のたびにインクリメント、フラッシュトリガー用
}
