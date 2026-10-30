import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Circle, Database, ExternalLink, FileImage, ImageUp, Info, KeyRound, LoaderCircle, Search, Settings2, Sparkles, Upload, Eye } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import type { Simulation } from '@contracts/simulation'
import { EMPTY_RECOGNIZED_EVENT, type RecognitionResult, type VenueResearchResult } from '@contracts/builder'
import { trpc } from '@/providers/trpc'
import { loadModelConfig, saveModelConfig } from '@/lib/local-model-config'
import SiteHeader from '@/components/SiteHeader'

function readableError(message: string) {
  if (message.includes('SUPABASE_NOT_CONFIGURED')) return '尚未连接 Supabase。请先在服务端配置 SUPABASE_URL 与 SUPABASE_SECRET_KEY。'
  if (message.includes('MODEL_NOT_CONFIGURED')) return '请先在当前浏览器保存模型配置，再开始构建。'
  if (message.includes('SEARCH_NOT_CONFIGURED')) return '新场馆需要公开资料搜索，请配置独立搜索服务；已有场馆可直接复用。'
  if (message.includes('VENUE_NAME_REQUIRED')) return '未检测到场馆全称，无法根据公开建筑信息构建模型，请补全后再开始构建。'
  if (message.includes('RESEARCH_REQUIRED')) return '尚未取得公开建筑资料，请返回上一步重新检索。'
  return message
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择'))
    reader.readAsDataURL(file)
  })
}

type BuildPhase = 'upload' | 'review' | 'building' | 'complete'
type EventForm = RecognitionResult

const progressSteps = [
  { title: '校验演出与场馆信息', note: '使用用户确认后的内容' },
  { title: '检索或复用公开建筑资料', note: '完成后可立即查看来源与摘要' },
  { title: 'AI 分析布局并生成主题', note: '读取票区、舞台、延伸台和控台' },
  { title: '校验完整模拟 JSON', note: '校验数据契约与引用完整性' },
  { title: '保存原图与构建草稿', note: '写入 Supabase，不自动发布' },
]

function ResearchPanel({ data }: { data: VenueResearchResult }) {
  const sourceCount = data.mode === 'reuse' ? data.venue?.sources.length || 0 : data.research.length
  return (
    <details className="research-panel" open>
      <summary>
        <span><Database size={17} /><b>公开建筑资料</b><small>{data.mode === 'reuse' ? '复用已有场馆' : '本次检索结果'}</small></span>
        <span className="research-count">{sourceCount} 个来源<ChevronDown size={16} /></span>
      </summary>
      <div className="research-content">
        {data.mode === 'reuse' && data.venue ? (
          <>
            <div className="research-venue"><Building2 size={18} /><div><b>{data.venue.name}</b><span>{data.venue.city} · 已复用基础几何，无需重复搜索</span></div></div>
            {data.venue.publicFacts.length > 0 && <ul className="fact-list">{data.venue.publicFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>}
            <div className="source-list">{data.venue.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><b>{source.label}</b>{source.note && <small>{source.note}</small>}</span><ExternalLink size={15} /></a>)}</div>
          </>
        ) : (
          <div className="source-list">{data.research.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><b>{source.title}</b>{source.content && <small>{source.content}</small>}</span><ExternalLink size={15} /></a>)}</div>
        )}
        <p className="research-disclaimer"><Info size={14} />公开事实与模型估算会分开标注；场馆尺度用于区域级模拟，不代表官方 CAD 或排座。</p>
      </div>
    </details>
  )
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'config' ? 'config' : 'build'
  const [config, setConfig] = useState(loadModelConfig)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [phase, setPhase] = useState<BuildPhase>('upload')
  const [stage, setStage] = useState(0)
  const [buildFailed, setBuildFailed] = useState(false)
  const [research, setResearch] = useState<VenueResearchResult | null>(null)
  const [result, setResult] = useState<Simulation | null>(null)
  const [form, setForm] = useState<EventForm>({ ...EMPTY_RECOGNIZED_EVENT, existingVenueId: '' })
  const venues = trpc.builder.venues.useQuery(undefined, { retry: false })
  const builds = trpc.builder.listAll.useQuery(undefined, { retry: false })
  const testConfig = trpc.builder.testConfig.useMutation()
  const recognize = trpc.builder.recognize.useMutation()
  const researchVenue = trpc.builder.research.useMutation()
  const generate = trpc.builder.generate.useMutation()
  const saveDraft = trpc.builder.saveDraft.useMutation()
  const publish = trpc.builder.publish.useMutation()

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const requireModelConfig = () => {
    if (config.baseUrl && config.apiKey && config.modelName) return true
    setSearchParams({ tab: 'config' }, { replace: true })
    setError('上传建模前，请先填写并保存当前浏览器的模型配置。')
    return false
  }

  const submitConfig = (event: React.FormEvent) => {
    event.preventDefault(); setNotice(''); setError('')
    try {
      saveModelConfig(config)
      setNotice('模型与搜索配置已保存到当前浏览器，不会写入 Supabase。')
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const runTest = async () => {
    setNotice(''); setError('')
    try {
      const response = await testConfig.mutateAsync(config)
      setNotice(`模型连接成功${response.response ? `：${response.response}` : '。'}`)
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile)
    setPhase('upload')
    setResult(null)
    setResearch(null)
    setError('')
    setNotice('')
    setBuildFailed(false)
    setStage(0)
  }

  const startRecognition = async () => {
    setNotice(''); setError(''); setResult(null); setResearch(null)
    if (!requireModelConfig()) return
    if (!file) { setError('请选择主办方提供的 2D 分区图。'); return }
    if (file.size > 12 * 1024 * 1024) { setError('图片不能超过 12 MB。'); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('仅支持 PNG、JPG 或 WebP 图片。'); return }
    try {
      const recognized = await recognize.mutateAsync({
        modelConfig: config,
        imageBase64: await fileToBase64(file),
        imageType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      })
      setForm(recognized)
      setPhase('review')
      setNotice('图片信息识别完成。请核对或修正后再开始构建，此时尚未检索公开建筑资料。')
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const submitBuild = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(''); setError(''); setResult(null); setResearch(null); setBuildFailed(false)
    if (!file) { setPhase('upload'); setError('原始分区图已失效，请重新选择。'); return }
    if (!requireModelConfig()) return
    if (!form.venueName.trim()) {
      setError('未检测到场馆全称，无法根据公开建筑信息构建模型，也就无法进入下一步生成模型。')
      return
    }
    setPhase('building')
    setStage(1)
    try {
      const imageBase64 = await fileToBase64(file)
      const researchResult = await researchVenue.mutateAsync({
        venueName: form.venueName,
        city: form.city,
        existingVenueId: form.existingVenueId,
        modelConfig: config,
      })
      setResearch(researchResult)
      setStage(2)
      const simulation = await generate.mutateAsync({
        ...form,
        modelConfig: config,
        research: researchResult.research,
        imageBase64,
        imageType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      })
      setStage(4)
      const saved = await saveDraft.mutateAsync({
        simulation,
        imageBase64,
        imageType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      })
      setResult(saved)
      setStage(5)
      setPhase('complete')
      setNotice('完整模拟 JSON 已生成、校验并保存为草稿。')
      await builds.refetch()
    } catch (reason) {
      setBuildFailed(true)
      setError(readableError(reason instanceof Error ? reason.message : String(reason)))
    }
  }

  const backToReview = () => {
    setPhase('review')
    setStage(0)
    setBuildFailed(false)
    setResearch(null)
    setError('')
    setNotice('可以修改确认信息；再次开始构建时会重新执行场馆检索。')
  }

  const publishResult = async () => {
    if (!result) return
    setError(''); setNotice('')
    try {
      await publish.mutateAsync({ slug: result.meta.slug })
      setResult({ ...result, meta: { ...result.meta, status: 'published', version: result.meta.version + 1 } })
      setNotice('模拟器已发布，现在可以在首页和搜索中进入。')
      await builds.refetch()
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const stepState = (index: number) => {
    if (phase === 'complete' || index < stage) return 'done'
    if (index === stage && buildFailed) return 'error'
    if (index === stage && phase === 'building') return 'active'
    return 'pending'
  }

  const resultPanel = result && <section className="build-result"><span><Check />JSON 校验通过</span><h3>{result.meta.title}</h3><dl><div><dt>模拟分区</dt><dd>{result.layout.sections.length}</dd></div><div><dt>票档</dt><dd>{result.layout.priceLevels.length}</dd></div><div><dt>当前状态</dt><dd>{result.meta.status === 'draft' ? '草稿' : '已发布'}</dd></div></dl>{result.meta.status === 'draft' ? <button onClick={publishResult} disabled={publish.isPending}>{publish.isPending ? <LoaderCircle className="spin" /> : <Eye />}发布模拟器</button> : <Link to={`/simulation/${result.meta.slug}`}>打开已发布模拟器<ArrowRight /></Link>}</section>

  return (
    <div className="discovery-shell admin-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div><span>SIMULATION BUILDER</span><h1>构建管理</h1><p>先确认图片里的演出信息，再检索建筑资料并生成现场模拟。</p></div>
        </div>
        <div className="admin-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'build'} className={tab === 'build' ? 'active' : ''} onClick={() => { setSearchParams({}, { replace: true }); setError(''); setNotice('') }}><Sparkles size={16} />AI 构建</button>
          <button role="tab" aria-selected={tab === 'config'} className={tab === 'config' ? 'active' : ''} onClick={() => { setSearchParams({ tab: 'config' }, { replace: true }); setError(''); setNotice('') }}><Settings2 size={16} />模型与搜索</button>
        </div>
        {(notice || error) && <div className={`admin-notice ${error ? 'is-error' : ''}`} role="status">{error || notice}</div>}

        {tab === 'build' ? (
          <div className={`builder-layout phase-${phase}`}>
            {phase === 'upload' && <>
              <div className="builder-form">
                <section className="admin-section upload-first-section">
                  <div className="admin-section-title"><span>01</span><div><h2>上传主办方 2D 分区图</h2><p>先识别演出与场馆信息，确认无误后才会检索和生成。</p></div></div>
                  <label className={`image-uploader ${preview ? 'has-image' : ''}`}>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => chooseFile(e.target.files?.[0] || null)} />
                    {preview ? <img src={preview} alt="待识别的 2D 分区图预览" /> : <><Upload size={26} /><b>选择完整 2D 分区图</b><span>需包含可识别场馆全称 · PNG / JPG / WebP · 不超过 12 MB</span></>}
                    {file && <div className="file-caption"><FileImage size={16} /><span>{file.name}</span><b>更换图片</b></div>}
                  </label>
                  <button className="build-submit" onClick={startRecognition} disabled={!file || recognize.isPending}>{recognize.isPending ? <LoaderCircle className="spin" /> : <ImageUp />}{recognize.isPending ? '正在识别图片基本信息…' : '上传并识别图片信息'}<ArrowRight /></button>
                  {recognize.isPending && <p className="build-progress">只提取演出、场馆和时间，不会在此步搜索建筑资料或写入数据库。</p>}
                </section>
              </div>
              <aside className="builder-side"><section className="workflow-panel"><span>BUILD PIPELINE</span><h2>构建流程</h2><ol><li><i>1</i><div><b>上传并识别分区图</b><p>回显图片中的六项基本信息</p></div></li><li><i>2</i><div><b>用户确认识别结果</b><p>可修正内容，场馆全称为必需项</p></div></li><li><i>3</i><div><b>检索并生成模型</b><p>公开资料、生成和校验进度可见</p></div></li><li><i>4</i><div><b>保存草稿后审核</b><p>原图进入私有存储，不自动发布</p></div></li></ol></section></aside>
            </>}

            {phase === 'review' && <>
              <form className="builder-form" onSubmit={submitBuild}>
                <section className="admin-section">
                  <div className="admin-section-title"><span>02</span><div><h2>确认识别信息</h2><p>这些内容来自图片识别，可以修改。点击构建后才开始检索公开建筑资料。</p></div></div>
                  <div className="recognition-source"><img src={preview} alt="本次识别的原始分区图" /><div><span><CheckCircle2 size={15} />图片识别完成</span><b>{file?.name}</b><button type="button" onClick={() => setPhase('upload')}>返回并更换图片</button></div></div>
                  <div className="form-grid">
                    <label className="wide"><span>演出名称</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="未识别，请补全演出名称" /></label>
                    <label><span>演出主题／艺人</span><input required value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="未识别，请补全" /></label>
                    <label><span>城市</span><input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="未识别，请补全城市" /></label>
                    <label className="wide"><span>场馆匹配方式 <small>系统匹配，可修改</small></span><select value={form.existingVenueId} onChange={(e) => {
                      const venue = venues.data?.find((item) => item.id === e.target.value)
                      setForm({ ...form, existingVenueId: e.target.value, venueName: venue?.name || form.venueName, city: venue?.city || form.city })
                    }}><option value="">作为新场馆检索公开资料</option>{venues.data?.map((venue) => <option key={venue.id} value={venue.id}>复用：{venue.name} · {venue.city}</option>)}</select></label>
                    <label className="wide"><span>场馆全称 <small>公开建筑检索必需</small></span><input value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} disabled={Boolean(form.existingVenueId)} placeholder="未检测到场馆全称" aria-describedby="venue-name-help" /></label>
                    <label><span>演出日期</span><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                    <label><span>开始时间</span><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
                  </div>
                  <p id="venue-name-help" className="venue-requirement"><Info size={15} />没有场馆全称将无法检索公开建筑资料，也不能进入模型生成。已有场馆会复用资料，新场馆则在下一步实时搜索。</p>
                  <button className="build-submit" type="submit"><Sparkles />确认信息，开始构建<ArrowRight /></button>
                </section>
              </form>
              <aside className="builder-side"><section className="workflow-panel"><span>CONFIRM BEFORE SEARCH</span><h2>确认后再检索</h2><div className="review-principle"><Search size={20} /><p>此页尚未请求公开建筑搜索。确认后，检索结果会显示在生成进度中，你可以随时查看来源。</p></div></section></aside>
            </>}

            {(phase === 'building' || phase === 'complete') && <>
              <div className="builder-form">
                <section className="admin-section generation-section">
                  <div className="admin-section-title"><span>03</span><div><h2>{phase === 'complete' ? '构建与保存完成' : '正在构建现场模型'}</h2><p>{form.venueName} · 每个阶段按真实接口结果更新</p></div></div>
                  <ol className="build-stage-list">{progressSteps.map((item, index) => {
                    const state = stepState(index)
                    return <li key={item.title} className={state}><span className="stage-marker">{state === 'done' ? <Check size={15} /> : state === 'active' ? <LoaderCircle size={16} className="spin" /> : state === 'error' ? <span>!</span> : <Circle size={12} />}</span><div><b>{item.title}</b><p>{item.note}</p></div><small>{state === 'done' ? '完成' : state === 'active' ? '进行中' : state === 'error' ? '已停止' : '等待'}</small></li>
                  })}</ol>
                  {buildFailed && <button className="back-review-button" onClick={backToReview}><ArrowLeft size={17} />返回修改确认信息</button>}
                  {phase === 'building' && !buildFailed && <p className="build-progress">请勿重复提交。模型与搜索调用会产生相应费用；公开资料检索完成后会立即显示在下方。</p>}
                </section>
                {research && <ResearchPanel data={research} />}
              </div>
              <aside className="builder-side">
                <section className="workflow-panel build-context"><span>CONFIRMED EVENT</span><h2>{form.title}</h2><dl><div><dt>场馆</dt><dd>{form.venueName}</dd></div><div><dt>城市</dt><dd>{form.city}</dd></div><div><dt>时间</dt><dd>{form.date} {form.time}</dd></div><div><dt>场馆方式</dt><dd>{form.existingVenueId ? '复用基础模型' : '检索新场馆'}</dd></div></dl></section>
                {resultPanel}
              </aside>
            </>}
          </div>
        ) : (
          <form className="config-form" onSubmit={submitConfig}>
            <section className="admin-section">
              <div className="admin-section-title"><KeyRound /><div><h2>OpenAI 兼容模型</h2><p>配置只保存在当前浏览器，读取分区图需要视觉能力。</p></div></div>
              <div className="form-grid">
                <label className="wide"><span>Base URL</span><input required type="url" value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://your-provider.example/v1" /></label>
                <label className="wide"><span>API Key <small>仅保存到当前浏览器</small></span><input required type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="当前浏览器的本地模型密钥" autoComplete="new-password" /></label>
                <label><span>模型名称</span><input required value={config.modelName} onChange={(e) => setConfig({ ...config, modelName: e.target.value })} placeholder="your-chat-model" /></label>
                <label><span>视觉模型（可选）</span><input value={config.visionModelName} onChange={(e) => setConfig({ ...config, visionModelName: e.target.value })} placeholder="留空则使用主模型" /></label>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-title"><Search /><div><h2>独立公开资料搜索</h2><p>只在用户确认后的新场馆构建阶段使用，与站内演出搜索完全分离。</p></div></div>
              <div className="form-grid">
                <label><span>搜索服务</span><select value={config.searchProvider} onChange={(e) => setConfig({ ...config, searchProvider: e.target.value as 'none' | 'tavily' })}><option value="none">不配置</option><option value="tavily">Tavily Search</option></select></label>
                <label><span>自定义接口地址（可选）</span><input type="url" value={config.searchBaseUrl} onChange={(e) => setConfig({ ...config, searchBaseUrl: e.target.value })} placeholder="留空使用服务官方接口" /></label>
                <label className="wide"><span>Search API Key <small>仅保存到当前浏览器</small></span><input type="password" value={config.searchApiKey} onChange={(e) => setConfig({ ...config, searchApiKey: e.target.value })} autoComplete="new-password" /></label>
              </div>
            </section>
            <div className="config-actions"><button type="submit"><Check />保存到此浏览器</button><button type="button" onClick={runTest} disabled={testConfig.isPending} title="使用当前配置测试主模型连接">{testConfig.isPending ? <LoaderCircle className="spin" /> : <Settings2 />}测试当前配置</button></div>
            <p className="security-note"><KeyRound size={14} />配置保存在当前浏览器 localStorage，清除浏览器数据后需重新填写。配置完整后即可测试模型和上传构建，无需登录。测试或构建时会随请求临时传给服务端使用，不写入 Supabase、模拟 JSON 或公开响应。模型和搜索调用按服务商规则计费。</p>
          </form>
        )}
      </main>
    </div>
  )
}
