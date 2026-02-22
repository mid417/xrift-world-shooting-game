import type { BulletColumn } from './types'

/**
 * 弾の列を追加（左右交互に外側へ）
 * center -> center,l1 -> center,l1,r1 -> center,l1,r1,l2 -> ...
 */
export function addBulletColumn(pattern: BulletColumn[]): BulletColumn[] {
  const newPattern = [...pattern]
  
  if (newPattern.length === 0) {
    return ['center']
  }
  
  // 次に追加するのは左 or 右？
  // length=1(center) -> l1追加 -> length=2 -> r1追加 -> length=3 -> l2追加...
  const isLeftNext = newPattern.length % 2 === 1
  
  // 追加する層の番号を計算
  // length=1 -> layer=1(l1), length=2 -> layer=1(r1), length=3 -> layer=2(l2), length=4 -> layer=2(r2)
  const layer = Math.ceil(newPattern.length / 2)
  
  if (isLeftNext) {
    newPattern.push(`l${layer}` as BulletColumn)
  } else {
    newPattern.push(`r${layer}` as BulletColumn)
  }
  
  return newPattern
}

/**
 * 最も外側の弾の列を削除
 */
export function removeOuterBulletColumn(pattern: BulletColumn[]): BulletColumn[] {
  if (pattern.length <= 1) {
    return ['center'] // 最低1列は残す
  }
  
  const newPattern = [...pattern]
  newPattern.pop()
  return newPattern
}

/**
 * 弾パターンからX座標のオフセット配列を取得
 * spacing: 列間の間隔（デフォルト 0.6）
 */
export function getBulletXOffsets(pattern: BulletColumn[], spacing = 0.6): number[] {
  return pattern.map((col) => {
    if (col === 'center') return 0
    
    const match = col.match(/^([lr])(\d+)$/)
    if (!match) return 0
    
    const [, direction, layer] = match
    const layerNum = parseInt(layer, 10)
    const offset = layerNum * spacing
    
    return direction === 'l' ? -offset : offset
  })
}
