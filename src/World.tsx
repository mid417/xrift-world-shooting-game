import { SpawnPoint, Skybox } from '@xrift/world-components'
import { RigidBody } from '@react-three/rapier'
import { GameManager } from './components/Game'

export interface WorldProps {
  position?: [number, number, number]
  scale?: number
}

export const World: React.FC<WorldProps> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* プレイヤーのスポーン地点（ゲームが見渡せる位置） */}
      <SpawnPoint position={[0, 0, 12]} />

      <Skybox topColor={0xAAAAAA} bottomColor={0x666666} offset={0} exponent={1} />

      {/* 照明設定 */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* 地面（暗い色、30×60の長方形） */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 60]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
      </RigidBody>

      {/* ゲームマネージャー */}
      <GameManager />
    </group>
  )
}
