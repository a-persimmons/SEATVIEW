import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, MapPin, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { trpc } from '@/providers/trpc'
import SiteHeader from '@/components/SiteHeader'
import EventPoster from '@/components/EventPoster'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const city = params.get('city') || ''
  const date = params.get('date') || ''
  const [input, setInput] = useState(query)
  const cities = trpc.simulations.cities.useQuery()
  const results = trpc.simulations.list.useQuery({ query, city, date, limit: 40 })

  useEffect(() => setInput(query), [query])

  const update = (next: { q?: string; city?: string; date?: string }) => {
    const values = { q: query, city, date, ...next }
    const updated = new URLSearchParams()
    if (values.q.trim()) updated.set('q', values.q.trim())
    if (values.city) updated.set('city', values.city)
    if (values.date) updated.set('date', values.date)
    setParams(updated)
  }

  const clear = () => {
    setInput('')
    setParams(new URLSearchParams())
  }

  return (
    <div className="discovery-shell search-shell">
      <SiteHeader />
      <main className="search-main">
        <section className="search-heading">
          <span>FIND YOUR VIEW</span>
          <h1>搜索模拟现场</h1>
          <p>按演出、主题、场馆、别名、城市或日期查找已发布的模拟器。</p>
        </section>
        <form
          className="search-page-form"
          role="search"
          onSubmit={(event) => { event.preventDefault(); update({ q: input }) }}
        >
          <Search size={22} />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如：无限可能 / 河北奥体 / 石家庄" aria-label="搜索关键词" />
          {input && <button type="button" className="clear-input" onClick={() => setInput('')} aria-label="清空关键词"><X size={18} /></button>}
          <button type="submit" className="search-submit">搜索<ArrowRight size={17} /></button>
        </form>
        <section className="search-filters" aria-label="筛选条件">
          <label><MapPin size={15} /><span>城市</span>
            <select value={city} onChange={(event) => update({ city: event.target.value })}>
              <option value="">全部城市</option>
              {cities.data?.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><CalendarDays size={15} /><span>日期</span><input type="date" value={date} onChange={(event) => update({ date: event.target.value })} /></label>
          {(query || city || date) && <button className="clear-filters" onClick={clear}>清除筛选<X size={14} /></button>}
        </section>
        <div className="results-heading">
          <h2>{query ? `“${query}” 的结果` : '全部模拟现场'}</h2>
          <span>{results.isLoading ? '正在查找…' : `${results.data?.items.length || 0} 场演出`}</span>
        </div>
        {results.isLoading && <div className="search-results-loading"><i /><i /><i /></div>}
        {results.error && (
          <div className="discovery-message" role="alert"><h3>搜索暂时不可用</h3><p>请稍后重试，站内搜索不会调用 AI。</p><button onClick={() => results.refetch()}>重新搜索</button></div>
        )}
        {!results.isLoading && results.data?.items.length === 0 && (
          <div className="discovery-message empty-search">
            <Search size={28} /><h3>没有找到匹配的模拟现场</h3><p>试试更短的关键词，或清除城市和日期筛选。</p><button onClick={clear}>查看全部演出</button>
          </div>
        )}
        <div className="search-result-list">
          {results.data?.items.map((event) => (
            <a key={event.id} href={`/simulation/${event.slug}`} className="search-result-card">
              <EventPoster event={event} compact />
              <div className="result-copy">
                <span className="result-series">{event.series}</span>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <div className="result-meta"><span><MapPin size={14} />{event.city} · {event.venueName}</span><span><CalendarDays size={14} />{event.date} {event.time}</span></div>
                <div className="result-bottom"><b>¥{event.startingPrice} 起</b><span>{event.sectionCount} 个模拟分区</span><strong>打开模拟器<ArrowRight size={16} /></strong></div>
              </div>
            </a>
          ))}
        </div>
      </main>
      <footer className="discovery-footer"><span>站内搜索直接查询发布数据，不消耗模型额度</span><span>SEATVIEW</span></footer>
    </div>
  )
}
