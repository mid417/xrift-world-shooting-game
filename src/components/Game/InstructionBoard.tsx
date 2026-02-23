import { Text } from '@react-three/drei'

export const InstructionBoard = () => {
  const lines = [
    'SHOOTING GAME',
    '',
    '⬅ ➡  移動',
    '🔫  弾は自動発射',
    '✅  + アイテム: 弾を増やす',
    '❌  - アイテム: 弾を減らす',
    '⏱  制限時間: 120秒',
    '💎  敵撃破: +100点（チェーンボーナスあり）',
    '',
    '▶ 前のボタンを見てインタラクト',
    '',
    '',
    'OtoLogicの音源を使用しています',
  ]

  return (
    <group position={[6, 2, 10]} rotation={[0, -0.6632251157578454, 0]}>
      {/* 背景（暗い板） */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[6, 8]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.7} />
      </mesh>

      {/* タイトル */}
      <Text
        position={[0, 3, 0]}
        fontSize={0.6}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        SHOOTING GAME
      </Text>

      {/* 説明行 */}
      {lines.slice(1).map((line, index) => (
        <Text
          key={index}
          position={[0, 2.5 - index * 0.35, 0]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={5.5}
        >
          {line}
        </Text>
      ))}
    </group>
  )
}
