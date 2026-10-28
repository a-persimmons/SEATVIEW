import { useId, type CSSProperties } from 'react'
import type { SimulationSummary } from '@contracts/simulation'

type Props = {
  event: SimulationSummary
  compact?: boolean
}

export default function EventPoster({ event, compact = false }: Props) {
  const id = useId().replaceAll(':', '')
  const style = {
    '--poster-accent': event.theme.stageAccent,
    '--poster-bg': event.theme.pageBg,
  } as CSSProperties
  const [year, month, day] = event.date.split('-')

  return (
    <div className={`event-poster ${compact ? 'is-compact' : ''}`} style={style} aria-label={`${event.title}模拟海报`}>
      <svg viewBox="0 0 480 600" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`glow-${id}`} cx="50%" cy="34%" r="68%">
            <stop offset="0" stopColor={event.theme.stageAccent} stopOpacity=".24" />
            <stop offset="1" stopColor={event.theme.pageBg} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`stage-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={event.theme.stageAccent} stopOpacity=".08" />
            <stop offset=".5" stopColor={event.theme.stageAccent} stopOpacity=".85" />
            <stop offset="1" stopColor={event.theme.stageAccent} stopOpacity=".08" />
          </linearGradient>
        </defs>
        <rect width="480" height="600" fill={`url(#glow-${id})`} />
        <g fill="none" stroke={event.theme.stageAccent} strokeOpacity=".15">
          <ellipse cx="240" cy="352" rx="205" ry="145" />
          <ellipse cx="240" cy="352" rx="176" ry="122" />
          <ellipse cx="240" cy="352" rx="145" ry="98" />
          <path d="M35 352h410M240 207v290" strokeOpacity=".08" />
        </g>
        <g fill={event.theme.stageAccent} opacity=".34">
          {Array.from({ length: 28 }, (_, index) => {
            const angle = (index / 28) * Math.PI * 2
            return <circle key={index} cx={240 + Math.sin(angle) * 177} cy={352 + Math.cos(angle) * 122} r="2.2" />
          })}
        </g>
        <rect x="123" y="206" width="234" height="74" rx="3" fill="#07101c" stroke={event.theme.stageAccent} strokeOpacity=".65" />
        <rect x="137" y="218" width="206" height="42" fill={`url(#stage-${id})`} />
        <path d="M228 280h24v103h-24z" fill={event.theme.stageAccent} opacity=".55" />
        <path d="M118 435h244" stroke={event.theme.stageAccent} strokeOpacity=".22" />
      </svg>
      <div className="poster-topline"><span>SEATVIEW</span><span>{event.series}</span></div>
      <div className="poster-date"><b>{month}.{day}</b><span>{year} · {event.weekday}</span></div>
      <div className="poster-copy">
        <small>{event.city} · {event.venueName}</small>
        <strong>{event.shortTitle}</strong>
        <span>{event.artist}</span>
      </div>
      <div className="poster-bottom"><i />3D VIEW SIMULATION<span>{event.sectionCount} ZONES</span></div>
    </div>
  )
}
