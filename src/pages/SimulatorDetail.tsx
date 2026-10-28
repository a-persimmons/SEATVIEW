import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, Box, CalendarDays, Camera, Check, ChevronRight, CircleHelp, Clock3, Download, Expand,
  Eye, ExternalLink, Grid3X3, Info, Layers2, Map, MapPin, MousePointer2, Pause, Play, RotateCcw,
  Ruler, Search, Share2, X,
} from 'lucide-react'
import SeatMap2D from '../components/SeatMap2D'
import Venue3D from '../components/Venue3D'
import {
  ACTIVE_SIMULATION, DEFAULT_SECTION, PRICE_LEVELS, SECTIONS, getPositionLabel, getSeatViewEstimate, getViewEstimate,
  type SeatLocation, type SeatPosition, type ViewMode,
} from '../data'
import '../App.css'

type ModalType = 'event' | 'reference' | 'help' | 'capture' | 'data' | null

const formatChineseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return `${year} 年 ${month} 月 ${day} 日`
}

export default function SimulatorDetail() {
  const simulation = ACTIVE_SIMULATION
  const { meta } = simulation
  const themeStyle = {
    '--accent': simulation.theme.accent,
    '--page-bg': simulation.theme.pageBg,
    '--panel-bg': simulation.theme.panelBg,
    '--panel-raised': simulation.theme.panelRaised,
    '--panel-border': simulation.theme.panelBorder,
    '--text-bright': simulation.theme.textBright,
    '--text-soft': simulation.theme.textSoft,
    '--text-dim': simulation.theme.textDim,
    '--button-text': simulation.theme.buttonText,
  } as CSSProperties
  const [mode, setMode] = useState<ViewMode>('3d')
  const [selectedId, setSelectedId] = useState(DEFAULT_SECTION.id)
  const [selectedSeat, setSelectedSeat] = useState<SeatLocation | null>(null)
  const [activePrice, setActivePrice] = useState<number | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [seatPosition, setSeatPosition] = useState<SeatPosition>('middle')
  const [cameraMode, setCameraMode] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [captureSignal, setCaptureSignal] = useState(0)
  const [captureImage, setCaptureImage] = useState('')
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalType>(null)
  const [toast, setToast] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const selected = SECTIONS.find((section) => section.id === selectedId) || DEFAULT_SECTION
  const viewEstimate = selectedSeat?.sectionId === selected.id
    ? getSeatViewEstimate(selected, selectedSeat)
    : getViewEstimate(selected, seatPosition)
  const currentPositionLabel = selectedSeat ? `${selectedSeat.row}排 ${selectedSeat.column}座` : getPositionLabel(seatPosition)

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
    setSelectedSeat(null)
    setQuery('')
    if (immersive) setImmersive(false)
  }

  const selectSeat = (seat: SeatLocation) => {
    setSelectedId(seat.sectionId)
    setSelectedSeat(seat)
    setQuery('')
  }

  const choosePosition = (position: SeatPosition) => {
    setSelectedSeat(null)
    setSeatPosition(position)
  }

  const changeMode = (nextMode: ViewMode) => {
    setImmersive(false)
    setCameraMode(false)
    setZoom(1)
    setMode(nextMode)
  }

  const resetView = () => {
    if (!immersive) {
      setImmersive(false)
      setCameraMode(false)
      setActivePrice(null)
      setAutoRotate(false)
    }
    setZoom(1)
    setResetKey((value) => value + 1)
  }

  const share = async () => {
    const text = `${meta.title}｜${selected.name} ¥${selected.price} 视角模拟`
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

  const enterSeatView = () => {
    setMode('3d')
    setCameraMode(false)
    setZoom(1)
    setImmersive(true)
  }

  const cycleSeatPosition = () => {
    const positions: SeatPosition[] = ['front', 'middle', 'back']
    const next = (positions.indexOf(seatPosition) + 1) % positions.length
    choosePosition(positions[next])
  }

  const handleCapture = (image: string) => {
    setCaptureImage(image)
    setModal('capture')
  }

  return (
    <div className="app-shell" style={themeStyle}>
      <header className="topbar">
        <Link className="brand-block" to="/" aria-label="返回模拟器首页">
          <div className="brand-mark" aria-hidden="true"><Eye size={21} strokeWidth={1.8} /></div>
          <div className="brand-name">SEATVIEW<span>现场视角模拟器</span></div>
        </Link>
        <div className="event-heading">
          <div className="event-status"><i /> {meta.series}</div>
          <h1>{meta.shortTitle} <span>{meta.artist}</span></h1>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={share} aria-label="分享当前演出与选区" title="分享"><Share2 size={18} /></button>
          <button className="event-info-button" onClick={() => setModal('event')}><Info size={17} /><span>演出信息</span></button>
        </div>
      </header>

      <div className="event-strip">
        <div><CalendarDays size={15} /><span>{meta.date.replaceAll('-', '.')}</span><b>{meta.weekday}</b></div>
        <div><Clock3 size={15} /><span>{meta.time}</span></div>
        <div className="venue-line"><MapPin size={15} /><span>{meta.venueName}</span></div>
        <button className="simulation-badge" onClick={() => setModal('data')}><Ruler size={13} />公开资料校准 · 人眼 5.0 参考</button>
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
                  {simulation.layout.quickSections.map((id) => (
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
              <button className="icon-button" onClick={resetView} aria-label={immersive ? '重新朝向舞台' : '重置场馆视角'} title={immersive ? '重新朝向舞台' : '重置视角'}><RotateCcw size={17} /></button>
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
                selectedSeat={selectedSeat}
                activePrice={activePrice}
                immersive={immersive}
                seatPosition={seatPosition}
                autoRotate={autoRotate}
                resetKey={resetKey}
                zoom={zoom}
                captureSignal={captureSignal}
                onSelect={selectSection}
                onSeatSelect={selectSeat}
                onCapture={handleCapture}
              />
            )}

            {!immersive && (
              <>
                <button className="scene-label" onClick={() => setModal('data')} title="查看模型依据"><span className="live-dot" />{mode === '3d' ? '公开资料校准模型' : '可交互 2D 分区'}<small>HEBEI OLYMPIC SPORTS CENTER · ESTIMATED</small></button>
                <div className="scene-hint"><MousePointer2 size={14} /><span>{mode === '3d' ? '拖动旋转 · 滚轮缩放 · 点击椅子选座' : '点击彩色分区查看详情'}</span></div>
              </>
            )}

            {immersive && mode === '3d' && (
              <div className={`view-overlay ${cameraMode ? 'camera-active' : ''}`}>
                <div className="view-topline">
                  <button onClick={() => setImmersive(false)}><ArrowLeft size={17} />返回场馆</button>
                  <button className="camera-entry" onClick={() => { setCameraMode(!cameraMode); setZoom(1) }}>
                    {cameraMode ? <Eye size={16} /> : <Camera size={16} />}{cameraMode ? '视角模式' : '相机取景'}
                  </button>
                  <span>{selected.name} · {currentPositionLabel}</span>
                </div>

                <div className="view-distance" aria-label="预估到主舞台距离">
                  <span><Ruler size={14} />预估至主舞台</span>
                  <strong>{viewEstimate.label}</strong>
                  <small>估算区间 {viewEstimate.rangeLabel}</small>
                  <em>人眼 5.0 参考 · {simulation.render.humanVisionFov}° 中心视野</em>
                </div>
                <div className="look-hint"><MousePointer2 size={13} /><span>{cameraMode ? '拖动调整角度 · 点椅子换座' : '拖动环视 · 点击椅子换座'}</span></div>

                {!cameraMode && (
                  <>
                    <div className="view-reticle" aria-hidden="true"><i /><i /></div>
                    <div className="view-bottom">
                      <div className="view-caption"><span>ESTIMATED VIEW</span><strong>{selected.direction}</strong><small>人眼 5.0 角尺度参考 · 非现场实拍</small></div>
                      <div className="position-switch dark">
                        {(['front', 'middle', 'back'] as SeatPosition[]).map((position) => (
                          <button key={position} className={!selectedSeat && seatPosition === position ? 'active' : ''} onClick={() => choosePosition(position)}>{getPositionLabel(position)}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {cameraMode && (
                  <>
                    <div className={`camera-frame ${showGrid ? 'with-grid' : ''}`} aria-hidden="true">
                      <span className="corner-tl" /><span className="corner-tr" /><span className="corner-bl" /><span className="corner-br" />
                      {showGrid && <div className="camera-grid"><i /><i /><i /><i /></div>}
                    </div>
                    <div className="camera-status"><span>PHOTO</span><b>{zoom.toFixed(1)}×</b><small>模拟焦距 · 非真实手机镜头效果</small></div>
                    <div className="camera-controls">
                      <div className="zoom-switch" aria-label="相机放大倍数">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button key={value} className={zoom === value ? 'active' : ''} onClick={() => setZoom(value)} aria-label={`${value}倍焦距`} aria-pressed={zoom === value}>{value}×</button>
                        ))}
                      </div>
                      <div className="camera-shutter-row">
                        <button className={`camera-tool ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)} aria-label={showGrid ? '隐藏九宫格' : '显示九宫格'} aria-pressed={showGrid}><Grid3X3 size={20} /><span>九宫格</span></button>
                        <button className="camera-shutter" onClick={() => setCaptureSignal((value) => value + 1)} aria-label="拍摄取景截图"><i /></button>
                        <button className="camera-tool position-tool" onClick={cycleSeatPosition} aria-label="切换区域内位置"><Camera size={19} /><span>{currentPositionLabel}</span></button>
                      </div>
                    </div>
                    {captureSignal > 0 && <div key={captureSignal} className="camera-flash" aria-hidden="true" />}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="workspace-footer">
            <span><i className="status-dot" />模型已加载</span>
            <span>标准跑道校准尺度 · 距离为区域级估算</span>
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
          <div className="zone-tags"><span><i style={{ background: selected.color }} />{selected.direction}</span><span>{viewEstimate.label}</span></div>
          {selectedSeat && (
            <div className="selected-seat-badge">
              <span>已选模拟座位</span><strong>{selectedSeat.row}排 {selectedSeat.column}座</strong>
              <button onClick={() => setSelectedSeat(null)} aria-label="取消具体座位，返回区域估算"><X size={13} /></button>
              <small>排号为程序生成 · 非官方实际排号</small>
            </div>
          )}

          <div className="detail-section">
            <h3>这个位置怎么样</h3>
            <p>{selected.summary}</p>
            <div className="detail-metrics">
              <div><span>观看方向</span><b>{selected.direction}</b></div>
              <div><span>舞台距离</span><b>{viewEstimate.rangeLabel}</b></div>
            </div>
          </div>

          <div className="detail-section position-detail">
            <div className="detail-title-line"><h3>选择代表位置</h3><span>{selectedSeat ? '将取消具体座位' : '也可直接点击椅子'}</span></div>
            <div className="position-switch">
              {(['front', 'middle', 'back'] as SeatPosition[]).map((position) => (
                <button key={position} className={!selectedSeat && seatPosition === position ? 'active' : ''} onClick={() => choosePosition(position)}>{getPositionLabel(position)}</button>
              ))}
            </div>
            <p className="position-note">{selectedSeat ? '当前距离与第一视角使用已选模拟座位。' : selected.note}</p>
          </div>

          <button className="primary-action" onClick={() => { if (immersive) setImmersive(false); else enterSeatView() }}>
            {immersive ? <><ArrowLeft size={18} />返回场馆选区<ChevronRight size={17} /></> : <><Eye size={18} />{selectedSeat ? '模拟此座位视角' : '模拟观看视角'}<ChevronRight size={17} /></>}
          </button>
          <button className="secondary-action" onClick={() => setModal('reference')}><Map size={17} />对照原始座位图</button>
          <div className="accuracy-note"><Info size={15} /><p>依据公开资料与主办方分区图估算。可点击椅子选择模拟座位，排号非官方实际排号。<button className="data-link" onClick={() => setModal('data')}>查看建模依据</button></p></div>
        </aside>
      </main>

      <footer className="app-footer"><span>SEATVIEW / ENDLESS POSSIBILITY</span><span>仅作选座参考 · 不提供票务交易</span></footer>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <section className={`modal ${modal === 'reference' || modal === 'capture' ? 'reference-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="关闭弹窗"><X size={19} /></button>
            {modal === 'event' && (
              <>
                <span className="section-kicker">EVENT INFORMATION</span><h2 id="modal-title">{meta.title}</h2>
                <p className="modal-lead">{meta.description.split('。')[0]}。</p>
                <dl className="event-details"><div><dt>演出时间</dt><dd>{formatChineseDate(meta.date)} {meta.time}</dd></div><div><dt>演出场馆</dt><dd>{meta.venueName}</dd></div><div><dt>模拟范围</dt><dd>内场 {SECTIONS.filter((section) => section.kind === 'field').length} 个分区、看台 {SECTIONS.filter((section) => section.kind === 'stand').length} 个分区</dd></div><div><dt>数据说明</dt><dd>公开场馆资料校准的区域级估算模型，非官方测绘或具体排座还原。</dd></div></dl>
                <button className="primary-action" onClick={() => setModal('reference')}>查看原始座位图<ChevronRight size={17} /></button>
              </>
            )}
            {modal === 'reference' && (
              <><span className="section-kicker">ORIGINAL SEAT MAP</span><h2 id="modal-title">主办方分区示意图</h2><div className="reference-image"><img src={meta.referenceImageUrl || '/seat-map-reference.jpg'} alt={`${meta.title}原始分区与票档图`} /></div><p className="reference-caption">原始图片仅用于分区对照，实际尺寸及内场通道以现场为准。</p></>
            )}
            {modal === 'data' && (
              <>
                <span className="section-kicker">MODEL &amp; ESTIMATION</span><h2 id="modal-title">公开资料校准模型</h2>
                <p className="modal-lead">用于比较区域方位与相对观看效果，不承诺具体排座精度。</p>
                <dl className="event-details model-details">
                  <div><dt>公开参数</dt><dd>{meta.id === 'sim_hebei_endless_20261114' ? '约 6 万坐席；罩棚建筑高度 50.423 米；地上五层、地下一层。' : `${simulation.venue.publicFacts.join('；')}。`}</dd></div>
                  <div><dt>尺度基准</dt><dd>以标准 400 米田径跑道及公开场馆影像校准场地比例、双层看台、罩棚、桅杆与拉索。</dd></div>
                  <div><dt>演出布局</dt><dd>舞台、延伸台、控台与票区位置依据所提供的主办方分区示意图估算。</dd></div>
                  <div><dt>距离算法</dt><dd>从所选模拟座位或区域内前／中／后代表观察点计算至主舞台前沿的空间距离，并以区间表达估算误差。</dd></div>
                  <div><dt>视觉参考</dt><dd>第一人称采用坐姿眼高与约 58° 中心清晰视野，人物按约 1.75 米高度显示。5.0 视力仅作正常角分辨能力参考，不以统一模糊模拟，实际效果受屏幕尺寸、分辨率与观看距离影响。</dd></div>
                  <div><dt>精度边界</dt><dd>未使用 CAD／BIM、官方排座坐标或本场舞台搭建图；可点击座位为程序生成的模拟排号，实际遮挡与尺寸以现场为准。</dd></div>
                </dl>
                <div className="source-links">
                  {simulation.venue.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={13} /></a>
                  ))}
                </div>
              </>
            )}
            {modal === 'help' && (
              <><span className="section-kicker">QUICK GUIDE</span><h2 id="modal-title">三步找到合适的位置</h2><ol className="guide-list"><li><b>筛选票档</b><p>在左侧选择预算，地图会保留对应票档的区域。</p></li><li><b>比较区域与座位</b><p>点击彩色分区查看区域信息；在 3D 中点击单把椅子，可选择模拟排、座并高亮。</p></li><li><b>进入视角与相机</b><p>进入第一人称后，拖动画面可环视，单击另一把椅子可平滑换座并重新面向舞台；画面会显示预估距离。切换“相机取景”后，可调整角度，并使用 1–5 倍焦距、九宫格和截图保存。</p></li></ol><div className="keyboard-help"><span>快捷键</span><kbd>Esc</kbd><small>退出观看视角或关闭弹窗</small></div></>
            )}
            {modal === 'capture' && captureImage && (
              <><span className="section-kicker">CAMERA CAPTURE</span><h2 id="modal-title">取景截图</h2><div className="capture-preview"><img src={captureImage} alt={`${selected.name} ${zoom}倍焦距取景截图`} /></div><div className="capture-meta"><span>{selected.name} · {currentPositionLabel}</span><b>{zoom.toFixed(1)}×</b></div><a className="primary-action download-action" href={captureImage} download={`${meta.shortTitle}-${selected.name}-${zoom}倍取景.png`}><Download size={18} />保存取景截图</a><button className="secondary-action" onClick={() => setModal(null)}>继续取景</button></>
            )}
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}
