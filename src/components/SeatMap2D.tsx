import { useMemo, useState } from 'react'
import { ACTIVE_SIMULATION, SECTIONS, STAND_TIERS, VENUE } from '../data'

const CX = 400
const CY = 350
const SX = 2.65
const SY = 2.25

function point(rx: number, rz: number, angle: number) {
  return [CX + Math.sin(angle) * rx * SX, CY + Math.cos(angle) * rz * SY]
}

function ringPath(rxInner: number, rzInner: number, rxOuter: number, rzOuter: number, angle: number, span: number) {
  const a0 = angle - span / 2
  const a1 = angle + span / 2
  const outer0 = point(rxOuter, rzOuter, a0)
  const outer1 = point(rxOuter, rzOuter, a1)
  const inner1 = point(rxInner, rzInner, a1)
  const inner0 = point(rxInner, rzInner, a0)
  return `M ${outer0.join(' ')} A ${rxOuter * SX} ${rzOuter * SY} 0 0 1 ${outer1.join(' ')} L ${inner1.join(' ')} A ${rxInner * SX} ${rzInner * SY} 0 0 0 ${inner0.join(' ')} Z`
}

function capsulePath(radius: number, straight: number) {
  const r = radius * SX
  const half = (straight / 2) * SY
  const rz = radius * SY
  return `M ${CX + r} ${CY - half} L ${CX + r} ${CY + half} A ${r} ${rz} 0 0 1 ${CX - r} ${CY + half} L ${CX - r} ${CY - half} A ${r} ${rz} 0 0 1 ${CX + r} ${CY - half} Z`
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
  const outerTrack = VENUE.trackRadius + VENUE.trackLanes * VENUE.trackLaneWidth

  return (
    <div className="seat-map-2d">
      <svg viewBox="0 0 800 700" role="img" aria-label="演唱会交互座位分区估算图">
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
            const config = STAND_TIERS[section.tier || 0]
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
                  d={ringPath(config.innerRx, config.innerRz, config.outerRx, config.outerRz, section.angle!, section.span!)}
                  fill={section.color}
                  fillOpacity={selected ? 0.96 : 0.68}
                  stroke={selected ? '#d9fbff' : '#09111e'}
                  strokeWidth={selected ? 3 : 1.25}
                  filter={selected ? 'url(#selected-glow)' : undefined}
                />
                <text x={CX + section.x * SX} y={CY + section.z * SY + 3} textAnchor="middle" className="stand-label">
                  {section.id}
                </text>
              </g>
            )
          })}
        </g>

        <g className="map-track" aria-hidden="true">
          <path d={capsulePath(outerTrack, VENUE.trackStraight)} fill="#123e59" stroke="#6b98aa" strokeOpacity="0.45" />
          <path d={capsulePath(VENUE.trackRadius, VENUE.trackStraight)} fill="#102b2a" stroke="#7c9b9d" strokeOpacity="0.3" />
        </g>

        <g className="map-stage" aria-label="舞台">
          <rect x={CX - 22 * SX} y={CY + (-60) * SY} width={44 * SX} height={12 * SY} rx="3" fill="#c8d3dc" />
          <rect x={CX - 18.5 * SX} y={CY + (-59) * SY} width={37 * SX} height={8 * SY} rx="2" fill="url(#stage-screen)" />
          <text x={CX} y={CY + (-54.5) * SY} textAnchor="middle" className="stage-title">{ACTIVE_SIMULATION.meta.id === 'sim_hebei_endless_20261114' ? 'ENDLESS' : ACTIVE_SIMULATION.meta.shortTitle}</text>
          <text x={CX} y={CY + (-51.5) * SY} textAnchor="middle" className="stage-subtitle">{ACTIVE_SIMULATION.meta.id === 'sim_hebei_endless_20261114' ? 'POSSIBILITY' : ACTIVE_SIMULATION.meta.artist}</text>
          <rect x={CX - 2 * SX} y={CY + (-48) * SY} width={4 * SX} height={28 * SY} fill="#aebdca" />
          <text x={CX + 16} y={CY + (-34) * SY} textAnchor="middle" className="stage-name" transform={`rotate(-90 ${CX + 16} ${CY + (-34) * SY})`}>延伸台</text>
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
                  rx="2"
                  fill={section.color}
                  fillOpacity={selected ? 1 : 0.82}
                  stroke={selected ? '#e5fcff' : '#09111e'}
                  strokeWidth={selected ? 3 : 1.4}
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
          <rect
            x={CX + (ACTIVE_SIMULATION.layout.controlBooth.x - ACTIVE_SIMULATION.layout.controlBooth.width / 2) * SX}
            y={CY + (ACTIVE_SIMULATION.layout.controlBooth.z - ACTIVE_SIMULATION.layout.controlBooth.depth / 2) * SY}
            width={ACTIVE_SIMULATION.layout.controlBooth.width * SX}
            height={ACTIVE_SIMULATION.layout.controlBooth.depth * SY}
            rx="2"
            fill="#d5dde2"
          />
          <text x={CX + ACTIVE_SIMULATION.layout.controlBooth.x * SX} y={CY + ACTIVE_SIMULATION.layout.controlBooth.z * SY + SY} textAnchor="middle">控台</text>
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
