import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import type { SimulationSummary } from '@contracts/simulation'
import EventPoster from './EventPoster'

export default function EventCard({ event }: { event: SimulationSummary }) {
  return (
    <Link to={`/simulation/${event.slug}`} className="event-card" aria-label={`打开${event.title}视角模拟器`}>
      <EventPoster event={event} compact />
      <div className="event-card-copy">
        <div className="event-card-status"><span><i />已发布模拟</span><small>VERSION {event.version}</small></div>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <dl>
          <div><CalendarDays size={15} /><dt className="sr-only">演出时间</dt><dd>{event.date.replaceAll('-', '.')} · {event.time}</dd></div>
          <div><MapPin size={15} /><dt className="sr-only">演出场馆</dt><dd>{event.city} · {event.venueName}</dd></div>
        </dl>
        <div className="event-card-footer">
          <span><b>¥{event.startingPrice}</b> 起 · {event.sectionCount} 个模拟分区</span>
          <span className="enter-simulation">进入模拟<ArrowUpRight size={17} /></span>
        </div>
      </div>
    </Link>
  )
}
