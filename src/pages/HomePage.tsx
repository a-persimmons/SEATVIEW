import { useState } from 'react'
import { ArrowDown, ArrowRight, Box, Camera, Map, Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { trpc } from '@/providers/trpc'
import SiteHeader from '@/components/SiteHeader'
import EventPoster from '@/components/EventPoster'
import EventCard from '@/components/EventCard'

export default function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const events = trpc.simulations.list.useQuery({ limit: 6 })
  const featured = events.data?.items[0]

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search')
  }

  return (
    <div className="discovery-shell">
      <SiteHeader />
      <main>
        <section className="home-hero">
          <div className="hero-copy">
            <div className="live-label"><i />CONCERT VIEW SIMULATOR</div>
            <h1>先看见现场，<br />再决定坐哪里。</h1>
            <p>输入演出、场馆或城市，打开 2D 分区与 3D 视角。比较舞台方向、预估距离，找到更适合自己的位置。</p>
            <form className="hero-search" onSubmit={submit} role="search">
              <Search size={21} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索演出、场馆或城市"
                aria-label="搜索演出、场馆或城市"
              />
              <button type="submit">找现场<ArrowRight size={18} /></button>
            </form>
            <div className="popular-searches">
              <span>试试</span>
              {['无限可能', '河北奥体', '石家庄'].map((keyword) => (
                <button key={keyword} onClick={() => navigate(`/search?q=${encodeURIComponent(keyword)}`)}>{keyword}</button>
              ))}
            </div>
            <div className="hero-capabilities" aria-label="模拟器功能">
              <span><Map size={16} />2D 分区</span>
              <span><Box size={16} />3D 选座</span>
              <span><Camera size={16} />1–5× 取景</span>
            </div>
          </div>
          <div className="hero-media">
            {featured ? <EventPoster event={featured} /> : <div className="poster-loading" aria-label="正在载入演出" />}
            <div className="hero-media-note"><span>FEATURED SIMULATION</span><b>从分区图，到观众视角</b></div>
          </div>
          <a className="hero-scroll" href="#latest"><ArrowDown size={16} />浏览模拟现场</a>
        </section>

        <section className="latest-events" id="latest">
          <div className="section-heading-row">
            <div><span>PUBLISHED SIMULATIONS</span><h2>可进入的模拟现场</h2></div>
            <button onClick={() => navigate('/search')}>查看全部<ArrowRight size={16} /></button>
          </div>
          {events.isLoading && <div className="event-list-loading"><i /><i /></div>}
          {events.error && (
            <div className="discovery-message" role="alert">
              <h3>暂时无法读取演出</h3><p>请检查网络后重试。</p>
              <button onClick={() => events.refetch()}>重新加载</button>
            </div>
          )}
          {events.data?.items.length === 0 && (
            <div className="discovery-message"><h3>还没有已发布的模拟现场</h3><p>新的演出发布后会显示在这里。</p></div>
          )}
          <div className="event-list">
            {events.data?.items.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </section>
      </main>
      <footer className="discovery-footer">
        <span>SEATVIEW · 先看清位置，再决定坐在哪里</span>
        <span>区域级估算 · 非官方排座 · 不提供票务交易</span>
      </footer>
    </div>
  )
}
