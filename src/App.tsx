import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Box, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Expand,
  Eye, Info, Layers2, Map, MapPin, MousePointer2, Pause, Play, RotateCcw,
  Search, Share2, X,
} from 'lucide-react'
import SeatMap2D from './components/SeatMap2D'
import Venue3D from './components/Venue3D'
import {
  DEFAULT_SECTION, PRICE_LEVELS, SECTIONS, getPositionLabel,
  type SeatPosition, type ViewMode,
} from './data'
import './App.css'

type ModalType = 'event' | 'reference' | 'help' | null

export default function App() {
  const [mode, setMode] = useState<ViewMode>('3d')
  const [selectedId, setSelectedId] = useState(DEFAULT_SECTION.id)
  const [activePrice, setActivePrice] = useState<number | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [seatPosition, setSeatPosition] = useState<SeatPosition>('middle')
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalType>(null)
  const [toast, setToast] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const selected = SECTIONS.find((section) => section.id === selectedId) || DEFAULT_SECTION

  const searchResults = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return []
    return SECTIONS.filter((section) => section.name.toLowerCase().includes(keyword) || section.id.toLowerCase() === keyword).slice(0, 8)
  }, [query])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!modal) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setImmersive(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectSection = (id: string) => {
    setSelectedId(id)
    setQuery('')
    if (immersive) setImmersive(false)
  }

  const changeMode = (nextMode: ViewMode) => {
    setImmersive(false)
    setMode(nextMode)
  }

  const resetView = () => {
    setImmersive(false)
    setActivePrice(null)
    setAutoRotate(false)
    setResetKey((value) => value + 1)
  }

  const share = async () => {
    const text = `无限可能超级演唱会｜${selected.name} ¥${selected.price} 视角模拟`
    try {
      await navigator.clipboard.writeText(`${text} ${window.location.href}`)
      setToast('演出与选区链接已复制')
    } catch {
      setToast('可复制浏览器地址分享当前页面')
    }
  }

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await workspaceRef.current?.requestFullscreen()
    } catch {
      setToast('当前浏览器不支持全屏显示')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><Eye size={21} strokeWidth={1.8} /></div>
          <div className="brand-name">SEATVIEW<span>现场视角模拟器</span></div>
        </div>
        <div className="event-heading">
          <div className="event-status"><i /> 2026 SUPER CONCERT</div>
          <h1>无限可能 <span>超级演唱会</span></h1>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={share} aria-label="分享当前演出与选区" title="分享"><Share2 size={18} /></button>
          <button className="event-info-button" onClick={() => setModal('event')}><Info size={17} /><span>演出信息</span></button>
        </div>
      </header>

      <div className="event-strip">
        <div><CalendarDays size={15} /><span>2026.11.14</span><b>周六</b></div>
        <div><Clock3 size={15} /><span>18:00</span></div>
        <div className="venue-line"><MapPin size={15} /><span>河北奥林匹克体育中心体育场</span></div>
        <div className="simulation-badge">3D 场景为示意模拟</div>
      </div>

      <div className="mobile-prices" aria-label="按票档筛选">
        <button className={activePrice === null ? 'active' : ''} onClick={() => setActivePrice(null)}>全部</button>
        {PRICE_LEVELS.map((level) => (
          <button key={level.price} className={activePrice === level.price ? 'active' : ''} onClick={() => setActivePrice(activePrice === level.price ? null : level.price)}>
            <i style={{ background: level.color }} />¥{level.price}
          </button>
        ))}
      </div>

      <main className={`main-layout ${immersive ? 'is-viewing' : ''}`}>
        <aside className="left-panel panel">
          <div className="panel-heading">
            <div><span className="section-kicker">TICKET ZONES</span><h2>票档与区域</h2></div>
            <span className="section-count">{SECTIONS.length} 区</span>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索区域，如 A3 / 105" aria-label="搜索座位区域" />
            {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={14} /></button>}
          </label>
          {query ? (
            <div className="search-results">
              {searchResults.length ? searchResults.map((section) => (
                <button key={section.id} className={selectedId === section.id ? 'active' : ''} onClick={() => selectSection(section.id)}>
                  <i style={{ background: section.color }} /><span>{section.name}</span><small>¥{section.price}</small><ChevronRight size={14} />
                </button>
              )) : <div className="empty-result">未找到该区域，请尝试输入区号</div>}
            </div>
          ) : (
            <>
              <div className="price-list">
                {PRICE_LEVELS.map((level) => {
                  const count = SECTIONS.filter((section) => section.price === level.price).length
                  const active = activePrice === level.price
                  return (
                    <button key={level.price} className={`price-row ${active ? 'active' : ''}`} onClick={() => setActivePrice(active ? null : level.price)} aria-pressed={active}>
                      <i className="price-color" style={{ background: level.color }} />
                      <span className="price-copy"><b>¥{level.price}</b><small>{level.label}</small></span>
                      <span className="price-hint">{level.hint}</span>
                      <span className="price-check">{active ? <Check size={14} /> : `${count}区`}</span>
                    </button>
                  )
                })}
              </div>
              <div className="quick-sections">
                <div className="subheading"><span>快速选区</span>{activePrice !== null && <button onClick={() => setActivePrice(null)}>清除筛选</button>}</div>
                <div className="section-chips">
                  {['VIP1', 'VIP3', 'A1', 'A3', 'B1', '105', '112', '308'].map((id) => (
                    <button key={id} className={selectedId === id ? 'active' : ''} onClick={() => selectSection(id)}>{SECTIONS.find((section) => section.id === id)?.name}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="left-note"><Info size={14} /><span>票档用于筛选区域，不代表实时余票。</span></div>
        </aside>

        <section className={`workspace ${immersive ? 'is-immersive' : ''}`} ref={workspaceRef} aria-label="场馆模拟工作区">
          <div className="workspace-toolbar">
            <div className="mode-switch" aria-label="场馆视图模式">
              <button className={mode === '2d' ? 'active' : ''} onClick={() => changeMode('2d')}><Map size={16} />2D</button>
              <button className={mode === '3d' ? 'active' : ''} onClick={() => changeMode('3d')}><Box size={16} />3D</button>
            </div>
            <div className="workspace-title"><Layers2 size={15} /><span>{immersive ? '第一人称观看视角' : '场馆分区模拟'}</span></div>
            <div className="workspace-actions">
              {mode === '3d' && !immersive && <button className={`icon-button ${autoRotate ? 'active' : ''}`} onClick={() => setAutoRotate(!autoRotate)} aria-label={autoRotate ? '停止自动旋转' : '自动旋转场馆'} title={autoRotate ? '停止旋转' : '自动旋转'}>{autoRotate ? <Pause size={17} /> : <Play size={17} />}</button>}
              <button className="icon-button" onClick={resetView} aria-label="重置场馆视角" title="重置视角"><RotateCcw size={17} /></button>
              <button className="icon-button desktop-only" onClick={fullscreen} aria-label="全屏显示" title="全屏"><Expand size={17} /></button>
            </div>
          </div>

          <div className="scene-container">
            <div className="scene-grid" />
            {mode === '2d' ? (
              <SeatMap2D selectedId={selectedId} activePrice={activePrice} onSelect={selectSection} />
            ) : (
              <Venue3D
                selectedId={selectedId}
                activePrice={activePrice}
                immersive={immersive}
                seatPosition={seatPosition}
                autoRotate={autoRotate}
                resetKey={resetKey}
                onSelect={selectSection}
              />
            )}

            {!immersive && (
              <>
                <div className="scene-label"><span className="live-dot" />{mode === '3d' ? '可交互 3D 模型' : '可交互 2D 分区'}<small>HEBEI OLYMPIC SPORTS CENTER</small></div>
                <div className="scene-hint"><MousePointer2 size={14} /><span>{mode === '3d' ? '拖动旋转 · 滚轮缩放 · 点击分区' : '点击彩色分区查看详情'}</span></div>
              </>
            )}

            {immersive && mode === '3d' && (
              <div className="view-overlay">
                <div className="view-topline">
                  <button onClick={() => setImmersive(false)}><ArrowLeft size={17} />返回场馆</button>
                  <div><span className="live-dot" />视角模拟</div>
                  <span>{selected.name} · {getPositionLabel(seatPosition)}</span>
                </div>
                <div className="view-reticle" aria-hidden="true"><i /><i /></div>
                <div className="view-bottom">
                  <div className="view-caption"><span>ESTIMATED VIEW</span><strong>{selected.direction}</strong><small>模拟画面仅用于比较位置关系，非现场实拍</small></div>
                  <div className="position-switch dark">
                    {(['front', 'middle', 'back'] as SeatPosition[]).map((position) => (
                      <button key={position} className={seatPosition === position ? 'active' : ''} onClick={() => setSeatPosition(position)}>{getPositionLabel(position)}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="workspace-footer">
            <span><i className="status-dot" />模型已加载</span>
            <span>座位排布、舞台尺寸与遮挡均为示意</span>
            <button onClick={() => setModal('help')}><CircleHelp size={14} />使用指南</button>
          </div>
        </section>

        <aside className="right-panel panel">
          <div className="selected-heading">
            <span className="section-kicker">SELECTED ZONE</span>
            <span className="zone-type">{selected.kind === 'field' ? '内场' : selected.tier === 0 ? '下层看台' : '上层看台'}</span>
          </div>
          <div className="zone-title-row">
            <h2>{selected.name}</h2>
            <div className="zone-price"><small>票档</small><b>¥{selected.price}</b></div>
          </div>
          <div className="zone-tags"><span><i style={{ background: selected.color }} />{selected.direction}</span><span>{selected.distance}</span></div>

          <div className="detail-section">
            <h3>这个位置怎么样</h3>
            <p>{selected.summary}</p>
            <div className="detail-metrics">
              <div><span>观看方向</span><b>{selected.direction}</b></div>
              <div><span>舞台距离</span><b>{selected.distance.replace('约 ', '')}</b></div>
            </div>
          </div>

          <div className="detail-section position-detail">
            <div className="detail-title-line"><h3>选择代表位置</h3><span>无需具体座位号</span></div>
            <div className="position-switch">
              {(['front', 'middle', 'back'] as SeatPosition[]).map((position) => (
                <button key={position} className={seatPosition === position ? 'active' : ''} onClick={() => setSeatPosition(position)}>{getPositionLabel(position)}</button>
              ))}
            </div>
            <p className="position-note">{selected.note}</p>
          </div>

          <button className="primary-action" onClick={() => { if (immersive) setImmersive(false); else { setMode('3d'); setImmersive(true) } }}>
            {immersive ? <><ArrowLeft size={18} />返回场馆选区<ChevronRight size={17} /></> : <><Eye size={18} />模拟观看视角<ChevronRight size={17} /></>}
          </button>
          <button className="secondary-action" onClick={() => setModal('reference')}><Map size={17} />对照原始座位图</button>
          <div className="accuracy-note"><Info size={15} /><p>依据主办方分区图重建，视角为近似效果。实际尺寸、内场通道及遮挡以现场为准。</p></div>
        </aside>
      </main>

      <footer className="app-footer"><span>SEATVIEW / ENDLESS POSSIBILITY</span><span>仅作选座参考 · 不提供票务交易</span></footer>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <section className={`modal ${modal === 'reference' ? 'reference-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="关闭弹窗"><X size={19} /></button>
            {modal === 'event' && (
              <>
                <span className="section-kicker">EVENT INFORMATION</span><h2 id="modal-title">无限可能超级演唱会</h2>
                <p className="modal-lead">先看清位置，再决定坐在哪里。</p>
                <dl className="event-details"><div><dt>演出时间</dt><dd>2026 年 11 月 14 日 18:00</dd></div><div><dt>演出场馆</dt><dd>河北奥林匹克体育中心体育场</dd></div><div><dt>模拟范围</dt><dd>内场 12 个分区、看台 36 个分区</dd></div><div><dt>数据说明</dt><dd>根据所提供的演出分区示意图重建，非官方场馆测绘模型。</dd></div></dl>
                <button className="primary-action" onClick={() => setModal('reference')}>查看原始座位图<ChevronRight size={17} /></button>
              </>
            )}
            {modal === 'reference' && (
              <><span className="section-kicker">ORIGINAL SEAT MAP</span><h2 id="modal-title">主办方分区示意图</h2><div className="reference-image"><img src="/seat-map-reference.jpg" alt="无限可能超级演唱会原始分区与票档图" /></div><p className="reference-caption">原始图片仅用于分区对照，实际尺寸及内场通道以现场为准。</p></>
            )}
            {modal === 'help' && (
              <><span className="section-kicker">QUICK GUIDE</span><h2 id="modal-title">三步找到合适的位置</h2><ol className="guide-list"><li><b>筛选票档</b><p>在左侧选择预算，地图会保留对应票档的区域。</p></li><li><b>比较区域</b><p>点击 2D 或 3D 场馆中的彩色分区，查看方向、距离和位置特点。</p></li><li><b>进入视角</b><p>选择区域内前、中、后排，进入第一人称模拟，直观比较舞台在视野中的大小。</p></li></ol><div className="keyboard-help"><span>快捷键</span><kbd>Esc</kbd><small>退出观看视角或关闭弹窗</small></div></>
            )}
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}
