export type ViewMode = '2d' | '3d'
export type SeatPosition = 'front' | 'middle' | 'back'

export type Section = {
  id: string
  name: string
  price: number
  color: string
  kind: 'field' | 'stand'
  x: number
  z: number
  width: number
  depth: number
  angle?: number
  tier?: number
  distance: string
  direction: string
  summary: string
  note: string
}

export const PRICE_LEVELS = [
  { price: 888, color: '#f04444', label: 'VIP 内场', hint: '靠近舞台核心区' },
  { price: 788, color: '#f48a22', label: 'A 区内场', hint: '侧前方与中部区域' },
  { price: 688, color: '#f4d82d', label: 'B 区内场', hint: '内场两侧区域' },
  { price: 588, color: '#38d878', label: '优选看台', hint: '侧面看台，视野较正' },
  { price: 488, color: '#25a9e8', label: '标准看台', hint: '全场视角，距离适中' },
  { price: 388, color: '#ef5b9d', label: '后排看台', hint: '适合观看整体舞美' },
  { price: 288, color: '#9258df', label: '远景看台', hint: '远距离全景视角' },
]

const fieldLayout = [
  ['VIP1区', -5.4, -8, 8.6, 7.2, 888, '正前方', '约 18–28 米', '靠近舞台的核心观看区域，能够清楚看到表演者与舞台细节。'],
  ['VIP2区', 5.4, -8, 8.6, 7.2, 888, '正前方', '约 18–28 米', '位于舞台正前方，视角集中，适合关注表演者。'],
  ['VIP3区', -5.4, 0.2, 8.6, 7.2, 888, '正前方', '约 28–38 米', '核心区内场中段，兼顾表演细节与舞台整体效果。'],
  ['VIP4区', 5.4, 0.2, 8.6, 7.2, 888, '正前方', '约 28–38 米', '核心区内场中段，能较完整地看到主舞台与延伸台。'],
  ['A1区', -15, -5.8, 8.4, 9, 788, '左侧前方', '约 24–36 米', '从左侧前方观看舞台，距离较近，画面带有自然侧向角度。'],
  ['A2区', 15, -5.8, 8.4, 9, 788, '右侧前方', '约 24–36 米', '从右侧前方观看舞台，兼顾距离与整体舞美。'],
  ['A3区', -15, 4.6, 8.4, 9, 788, '左侧中部', '约 34–46 米', '内场左侧中部，视角略侧，能够完整看到主舞台和大部分舞美。'],
  ['A4区', 15, 4.6, 8.4, 9, 788, '右侧中部', '约 34–46 米', '内场右侧中部，观看角度自然，适合兼顾表演与大屏。'],
  ['A5区', -15, 15, 8.4, 9, 788, '左侧后方', '约 44–56 米', '内场左侧后方，更强调舞台整体效果，需留意前排视线。'],
  ['A6区', 15, 15, 8.4, 9, 788, '右侧后方', '约 44–56 米', '内场右侧后方，视野开阔，适合观看完整编排。'],
  ['B1区', -25, 7, 8.4, 17, 688, '左侧内场', '约 38–58 米', '位于内场左侧，舞台呈明显侧向视角，可看到整体舞美。'],
  ['B2区', 25, 7, 8.4, 17, 688, '右侧内场', '约 38–58 米', '位于内场右侧，观看距离适中，舞台方向略侧。'],
] as const

const fieldSections: Section[] = fieldLayout.map(([name, x, z, width, depth, price, direction, distance, summary]) => ({
  id: name.replace('区', ''),
  name,
  x,
  z,
  width,
  depth,
  price,
  direction,
  distance,
  summary,
  color: PRICE_LEVELS.find((item) => item.price === price)!.color,
  kind: 'field',
  note: price === 888 ? '内场为平地座位，后排可能受到前排观众影响。' : '建议选择区域内靠前位置，减少前排遮挡影响。',
}))

const standSections: Section[] = []
const standColors: Record<number, string> = Object.fromEntries(PRICE_LEVELS.map((item) => [item.price, item.color]))

for (let tier = 0; tier < 2; tier += 1) {
  const count = 18
  for (let index = 0; index < count; index += 1) {
    const angle = -2.28 + (index / (count - 1)) * 4.56
    const rx = tier === 0 ? 41 : 48
    const rz = tier === 0 ? 34 : 41
    const x = Math.sin(angle) * rx
    const z = Math.cos(angle) * rz + 5
    const side = Math.abs(Math.sin(angle))
    const rear = Math.cos(angle)
    let price = 588
    if (side < 0.82) price = 488
    if (side < 0.48) price = 388
    if (side < 0.2 && tier === 1) price = 288
    const number = (tier === 0 ? 101 : 301) + index
    const direction = side > 0.82 ? (x < 0 ? '左侧看台' : '右侧看台') : rear > 0 ? '正面远景' : '侧前方看台'
    standSections.push({
      id: String(number),
      name: `${number}区`,
      price,
      color: standColors[price],
      kind: 'stand',
      x,
      z,
      width: 7.2,
      depth: 5.4,
      angle,
      tier,
      distance: tier === 0 ? '约 52–78 米' : '约 68–96 米',
      direction,
      summary: price >= 588
        ? '侧面看台拥有自然的俯视角度，能看到完整舞台，比同距离内场更少受前排影响。'
        : price === 488
          ? '面向舞台的看台视角，适合欣赏整体灯光、屏幕与队形变化。'
          : '以完整舞美和现场氛围为主，表演者在视野中会显得较小。',
      note: tier === 0 ? '下层看台，视线高于内场，整体遮挡较少。' : '上层看台，建议关注大屏与整体舞台效果。',
    })
  }
}

export const SECTIONS: Section[] = [...fieldSections, ...standSections]
export const DEFAULT_SECTION = SECTIONS.find((section) => section.id === 'A3')!

export function getSectionsByPrice(price: number | null) {
  return price === null ? SECTIONS : SECTIONS.filter((section) => section.price === price)
}

export function getPositionLabel(position: SeatPosition) {
  return { front: '区域前排', middle: '区域中部', back: '区域后排' }[position]
}
