export type ViewMode = '2d' | '3d'
export type SeatPosition = 'front' | 'middle' | 'back'
export type SeatLocation = { sectionId: string, row: number, column: number }

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
  span?: number
  tier?: number
  direction: string
  summary: string
  note: string
}

export const VENUE = {
  stageFrontZ: -48,
  stageCenterZ: -54,
  stageTargetY: 4,
  roofHeight: 50.423,
  trackRadius: 36.5,
  trackStraight: 84.39,
  trackLaneWidth: 1.22,
  trackLanes: 8,
}

export const STAND_TIERS = [
  { innerRx: 56, innerRz: 92, outerRx: 69, outerRz: 106, innerY: 3.2, outerY: 15.2, rows: 16 },
  { innerRx: 74, innerRz: 112, outerRx: 88, outerRz: 128, innerY: 21, outerY: 36, rows: 18 },
]

export const PRICE_LEVELS = [
  { price: 888, color: '#f04444', label: 'VIP 内场', hint: '靠近舞台核心区' },
  { price: 788, color: '#f48a22', label: 'A 区内场', hint: '内场前部与中部区域' },
  { price: 688, color: '#f4d82d', label: 'B 区内场', hint: '内场后侧左右两区' },
  { price: 588, color: '#38d878', label: '优选看台', hint: '侧面看台，视野较正' },
  { price: 488, color: '#25a9e8', label: '标准看台', hint: '全场视角，距离适中' },
  { price: 388, color: '#ef5b9d', label: '后排看台', hint: '适合观看整体舞美' },
  { price: 288, color: '#9258df', label: '远景看台', hint: '远距离全景视角' },
]

const fieldLayout = [
  ['VIP1区', -21.5, -36, 12, 11, 888, '左侧前方', '位于左侧组团前排，靠近主舞台，能够清楚看到表演者与舞台细节。'],
  ['VIP2区', -8.5, -36, 12, 11, 888, '延伸台左前方', '位于左侧组团前排、延伸台旁，兼顾主舞台与延伸台表演。'],
  ['VIP5区', 8.5, -36, 12, 11, 888, '延伸台右前方', '位于右侧组团前排、延伸台旁，兼顾主舞台与延伸台表演。'],
  ['VIP4区', 21.5, -36, 12, 11, 888, '右侧前方', '位于右侧组团前排，靠近主舞台，视角带有自然侧向角度。'],
  ['A1区', -21.5, -24, 12, 11, 788, '左侧前中部', '位于 VIP1 后方，与 VIP3 同排，距离舞台较近。'],
  ['VIP3区', -8.5, -24, 12, 11, 888, '延伸台左侧', '位于左侧组团第二排、延伸台旁，与 A1 同排。'],
  ['VIP6区', 8.5, -24, 12, 11, 888, '延伸台右侧', '位于右侧组团第二排、延伸台旁，与 A2 同排。'],
  ['A2区', 21.5, -24, 12, 11, 788, '右侧前中部', '位于 VIP4 后方，与 VIP6 同排，适合兼顾表演与大屏。'],
  ['A3区', -21.5, -12, 12, 11, 788, '左侧中部', '位于 A1 后方，与 A4 同排，能够完整看到主舞台和大部分舞美。'],
  ['A4区', -8.5, -12, 12, 11, 788, '左侧中后部', '位于 VIP3 后方、A3 内侧，靠近左右组团中间通道。'],
  ['A5区', 8.5, -12, 12, 11, 788, '右侧中后部', '位于 VIP6 后方、A6 内侧，靠近左右组团中间通道。'],
  ['A6区', 21.5, -12, 12, 11, 788, '右侧中部', '位于 A2 后方，与 A5 同排，视野开阔，适合观看完整编排。'],
  ['B1区', -16, 4, 23, 14, 688, '左侧内场后部', '位于左侧组团最后方、A3 与 A4 后方，是一整块大面积票区。'],
  ['B2区', 16, 4, 23, 14, 688, '右侧内场后部', '位于右侧组团最后方、A5 与 A6 后方，是一整块大面积票区。'],
] as const

const fieldSections: Section[] = fieldLayout.map(([name, x, z, width, depth, price, direction, summary]) => ({
  id: name.replace('区', ''),
  name,
  x,
  z,
  width,
  depth,
  price,
  direction,
  summary,
  color: PRICE_LEVELS.find((item) => item.price === price)!.color,
  kind: 'field',
  note: price === 888 ? '内场为平地座位，后排可能受到前排观众影响。' : '建议选择区域内靠前位置，减少前排遮挡影响。',
}))

function getLowerPrice(id: number) {
  if ((id >= 101 && id <= 104) || id >= 118) return 588
  if ((id >= 105 && id <= 106) || (id >= 116 && id <= 117)) return 488
  if ((id >= 107 && id <= 108) || (id >= 114 && id <= 115)) return 388
  return 288
}

function getUpperPrice(id: number) {
  if (id <= 302 || id === 322) return 588
  if (id >= 311 && id <= 314) return 388
  return 488
}

function getStandSummary(price: number) {
  if (price >= 588) return '侧面看台拥有自然的俯视角度，能看到完整舞台，比同距离内场更少受前排影响。'
  if (price === 488) return '面向舞台的看台视角，适合欣赏整体灯光、屏幕与队形变化。'
  return '以完整舞美和现场氛围为主，表演者在视野中会显得较小。'
}

const standSections: Section[] = []
for (let tier = 0; tier < 2; tier += 1) {
  const count = tier === 0 ? 40 : 22
  const config = STAND_TIERS[tier]
  for (let index = 0; index < count; index += 1) {
    const angle = 2.4 - (index / (count - 1)) * 4.8
    const span = (4.8 / (count - 1)) * 0.91
    const id = tier === 0 ? 101 + index : 301 + index
    const price = tier === 0 ? getLowerPrice(id) : getUpperPrice(id)
    const rx = (config.innerRx + config.outerRx) / 2
    const rz = (config.innerRz + config.outerRz) / 2
    const x = Math.sin(angle) * rx
    const z = Math.cos(angle) * rz
    const side = Math.abs(Math.sin(angle))
    const direction = side > 0.82 ? (x < 0 ? '左侧看台' : '右侧看台') : Math.cos(angle) > 0 ? '正面远景' : '侧前方看台'
    standSections.push({
      id: String(id),
      name: `${id}区`,
      price,
      color: PRICE_LEVELS.find((item) => item.price === price)!.color,
      kind: 'stand',
      x,
      z,
      width: 0,
      depth: 0,
      angle,
      span,
      tier,
      direction,
      summary: getStandSummary(price),
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

export function getSeatCounts(section: Section) {
  if (section.kind === 'stand') {
    return { rows: STAND_TIERS[section.tier || 0].rows, columns: section.tier === 0 ? 10 : 8 }
  }
  return {
    rows: Math.max(7, Math.floor(section.depth / 1.35)),
    columns: Math.max(8, Math.floor(section.width / 1.15)),
  }
}

export function getSeatCoordinates(section: Section, seat: SeatLocation) {
  const counts = getSeatCounts(section)
  const row = Math.max(1, Math.min(counts.rows, seat.row))
  const column = Math.max(1, Math.min(counts.columns, seat.column))
  if (section.kind === 'stand') {
    const config = STAND_TIERS[section.tier || 0]
    const ratio = (row - 0.5) / counts.rows
    const rx = THREE_LERP(config.innerRx, config.outerRx, ratio)
    const rz = THREE_LERP(config.innerRz, config.outerRz, ratio)
    const angle = section.angle! + (column / counts.columns - 0.5) * section.span! * 0.86
    return {
      x: Math.sin(angle) * rx,
      y: THREE_LERP(config.innerY, config.outerY, ratio) + 0.3,
      z: Math.cos(angle) * rz,
      angle,
    }
  }
  return {
    x: section.x + (column / counts.columns - 0.5) * section.width * 0.9,
    y: 0.48,
    z: section.z + (row / counts.rows - 0.5) * section.depth * 0.9,
    angle: 0,
  }
}

export type ViewEstimate = {
  eye: { x: number, y: number, z: number }
  nominal: number
  min: number
  max: number
  label: string
  rangeLabel: string
}

const roundToFive = (value: number) => Math.max(5, Math.round(value / 5) * 5)

export function getViewEstimate(section: Section, position: SeatPosition): ViewEstimate {
  const ratio = position === 'front' ? 0.12 : position === 'back' ? 0.88 : 0.5
  let eye = { x: section.x, y: 1.62, z: section.z }
  if (section.kind === 'field') {
    eye = {
      x: section.x,
      y: 1.62,
      z: section.z + (ratio - 0.5) * section.depth,
    }
  } else {
    const config = STAND_TIERS[section.tier || 0]
    const rx = THREE_LERP(config.innerRx, config.outerRx, ratio)
    const rz = THREE_LERP(config.innerRz, config.outerRz, ratio)
    eye = {
      x: Math.sin(section.angle!) * rx,
      y: THREE_LERP(config.innerY, config.outerY, ratio) + 1.25,
      z: Math.cos(section.angle!) * rz,
    }
  }
  const actualDistance = Math.hypot(eye.x, eye.y - VENUE.stageTargetY, eye.z - VENUE.stageFrontZ)
  const uncertainty = section.kind === 'field' ? 5 : 10
  const nominal = roundToFive(actualDistance)
  const min = roundToFive(actualDistance - uncertainty)
  const max = roundToFive(actualDistance + uncertainty)
  return { eye, nominal, min, max, label: `约 ${nominal} 米`, rangeLabel: `${min}–${max} 米` }
}

export function getSeatViewEstimate(section: Section, seat: SeatLocation): ViewEstimate {
  const coordinates = getSeatCoordinates(section, seat)
  const eye = {
    x: coordinates.x,
    y: section.kind === 'field' ? 1.62 : coordinates.y + 0.95,
    z: coordinates.z,
  }
  const actualDistance = Math.hypot(eye.x, eye.y - VENUE.stageTargetY, eye.z - VENUE.stageFrontZ)
  const uncertainty = section.kind === 'field' ? 5 : 10
  const nominal = roundToFive(actualDistance)
  const min = roundToFive(actualDistance - uncertainty)
  const max = roundToFive(actualDistance + uncertainty)
  return { eye, nominal, min, max, label: `约 ${nominal} 米`, rangeLabel: `${min}–${max} 米` }
}

function THREE_LERP(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio
}
