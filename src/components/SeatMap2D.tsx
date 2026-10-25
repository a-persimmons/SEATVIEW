import { useMemo, useState } from 'react'
import { SECTIONS } from '../data'

const CX = 400
const CY = 350
const SX = 6
const SY = 5.7

function point(rx: number, rz: number, angle: number) {
  return [CX + Math.sin(angle) * rx * SX, CY + Math.cos(angle) * rz * SY]
}

function ringPath(rx: number, rz: number, angle: number, span: number, thickness: number) {
  const a0 = angle - span / 2
  const a1 = angle + span / 2
  const outer0 = point(rx + thickness / 2, rz + thickness / 2, a0)
  const outer1 = point(rx + thickness / 2, rz + thickness / 2, a1)
  const inner1 = point(rx - thickness / 2, rz - thickness / 2, a1)
  const inner0 = point(rx - thickness / 2, rz - thickness / 2, a0)
  return `M ${outer0.join(' ')} A ${(rx + thickness / 2) * SX} ${(rz + thickness / 2) * SY} 0 0 1 ${outer1.join(' ')} L ${inner1.join(' ')} A ${(rx - thickness / 2) * SX} ${(rz - thickness / 2) * SY} 0 0 0 ${inner0.join(' ')} Z`
}

type Props = {
  selectedId: string
  activePrice: number | null
  onSelect: (id: string) => void
}

export default function SeatMap2D({ selectedId, activePrice, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const stands = useMemo(() => SECTIONS.filter((section) => section.kind === 'stand'), [])
  const fields = useMemo(() => SECTIONS.filter((section) => section.kind === 'field'), [])
  const hoveredSection = SECTIONS.find((section) => section.id === hovered)

  return (
    <div className="seat-map-2d">
      <svg viewBox="0 0 800 690" role="img" aria-label="演唱会交互座位分区图">
        <defs>
          <filter id="selected-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="stage-screen" x1="0" x2="1">
            <stop offset="0" stopColor="#102a3d" />
            <stop offset="0.5" stopColor="#1b6073" />
            <stop offset="1" stopColor="#102a3d" />
          </linearGradient>
        </defs>

        <g className="map-stands">
          {stands.map((section) => {
            const dimmed = activePrice !== null && activePrice !== section.price
            const selected = selectedId === section.id
            const rx = section.tier === 0 ? 41 : 48
            const rz = section.tier === 0 ? 34 : 41
            return (
              <g
                key={section.id}
                role="button"
                tabIndex={0}
                aria-label={`${section.name}，${section.price}元`}
                className={`map-section ${selected ? 'is-selected' : ''}`}
                opacity={dimmed ? 0.14 : 1}
                onClick={() => onSelect(section.id)}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onSelect(section.id)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <path
                  d={ringPath(rx, rz, section.angle!, 0.235, 5.2)}
                  fill={section.color}
                  fillOpacity={selected ? 1 : 0.72}
                  stroke={selected ? '#d9fbff' : '#09111e'}
                  strokeWidth={selected ? 3 : 1.6}
                  filter={selected ? 'url(#selected-glow)' : undefined}
                />
                <text x={CX + section.x * SX} y={CY + section.z * SY + 3} textAnchor="middle" className="stand-label">
                  {section.id}
                </text>
              </g>
            )
          })}
        </g>

        <g className="map-stage" aria-label="舞台">
          <rect x="286" y="142" width="228" height="100" rx="4" fill="#c8d3dc" />
          <rect x="300" y="154" width="200" height="55" rx="2" fill="url(#stage-screen)" />
          <text x="400" y="181" textAnchor="middle" className="stage-title">ENDLESS</text>
          <text x="400" y="198" textAnchor="middle" className="stage-subtitle">POSSIBILITY</text>
          <rect x="384" y="242" width="32" height="88" fill="#aebdca" />
          <rect x="360" y="316" width="80" height="26" rx="3" fill="#c8d3dc" />
          <text x="400" y="266" textAnchor="middle" className="stage-name" transform="rotate(-90 400 266)">舞台</text>
        </g>

        <g className="map-field">
          {fields.map((section) => {
            const dimmed = activePrice !== null && activePrice !== section.price
            const selected = selectedId === section.id
            const x = CX + (section.x - section.width / 2) * SX
            const y = CY + (section.z - section.depth / 2) * SY
            return (
              <g
                key={section.id}
                role="button"
                tabIndex={0}
                aria-label={`${section.name}，${section.price}元`}
                className={`map-section ${selected ? 'is-selected' : ''}`}
                opacity={dimmed ? 0.14 : 1}
                onClick={() => onSelect(section.id)}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onSelect(section.id)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={section.width * SX}
                  height={section.depth * SY}
                  rx="3"
                  fill={section.color}
                  fillOpacity={selected ? 1 : 0.8}
                  stroke={selected ? '#e5fcff' : '#09111e'}
                  strokeWidth={selected ? 3 : 1.8}
                  filter={selected ? 'url(#selected-glow)' : undefined}
                />
                <text x={CX + section.x * SX} y={CY + section.z * SY + 4} textAnchor="middle" className="field-label">
                  {section.name}
                </text>
              </g>
            )
          })}
        </g>

        <g className="map-control-booth">
          <rect x="365" y="475" width="70" height="30" rx="3" fill="#d5dde2" />
          <text x="400" y="495" textAnchor="middle">控台</text>
        </g>
      </svg>
      <div className="map-orientation"><span>舞台方向</span><i /></div>
      {hoveredSection && (
        <div className="map-tooltip" role="status">
          <b>{hoveredSection.name}</b><span>¥{hoveredSection.price}</span><small>{hoveredSection.direction}</small>
        </div>
      )}
    </div>
  )
}
