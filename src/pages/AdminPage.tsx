import { useEffect, useState } from 'react'
import { ArrowRight, Check, Database, FileImage, KeyRound, LoaderCircle, LogOut, Search, Settings2, Sparkles, Upload, Eye } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import type { Simulation } from '@contracts/simulation'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import SiteHeader from '@/components/SiteHeader'

const defaultConfig = {
  baseUrl: '', apiKey: '', modelName: '', visionModelName: '',
  searchProvider: 'none' as 'none' | 'tavily', searchBaseUrl: '', searchApiKey: '',
}

function readableError(message: string) {
  if (message.includes('SUPABASE_NOT_CONFIGURED')) return '尚未连接 Supabase。请先在服务端配置 SUPABASE_URL 与 SUPABASE_SECRET_KEY。'
  if (message.includes('MODEL_NOT_CONFIGURED')) return '请先保存模型配置，再开始构建。'
  if (message.includes('SEARCH_NOT_CONFIGURED')) return '新场馆需要公开资料搜索，请配置独立搜索服务；已有场馆可直接复用。'
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

export default function AdminPage() {
  const auth = useAuth({ redirectOnUnauthenticated: true })
  const isAdmin = auth.user?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'config' ? 'config' : 'build'
  const [config, setConfig] = useState(defaultConfig)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<Simulation | null>(null)
  const [form, setForm] = useState({
    title: '', artist: '', venueName: '河北奥林匹克体育中心体育场', city: '石家庄',
    date: '2026-11-14', time: '18:00', existingVenueId: 'venue_hebei_olympic',
  })
  const configQuery = trpc.builder.config.useQuery(undefined, { enabled: isAdmin, retry: false })
  const venues = trpc.builder.venues.useQuery(undefined, { enabled: isAdmin, retry: false })
  const builds = trpc.builder.listAll.useQuery(undefined, { enabled: isAdmin, retry: false })
  const saveConfig = trpc.builder.saveConfig.useMutation()
  const testConfig = trpc.builder.testConfig.useMutation()
  const build = trpc.builder.build.useMutation()
  const publish = trpc.builder.publish.useMutation()

  useEffect(() => {
    if (!configQuery.data) return
    setConfig((current) => ({
      ...current,
      baseUrl: configQuery.data.baseUrl,
      modelName: configQuery.data.modelName,
      visionModelName: configQuery.data.visionModelName,
      searchProvider: configQuery.data.searchProvider,
      searchBaseUrl: configQuery.data.searchBaseUrl,
    }))
  }, [configQuery.data])

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (auth.isLoading) return <div className="admin-gate"><LoaderCircle className="spin" />正在确认管理员身份…</div>
  if (!isAdmin) {
    return <div className="admin-gate"><KeyRound /><h1>需要管理员权限</h1><p>模型配置与模拟器发布仅对管理员开放。</p><Link to="/">返回首页</Link></div>
  }

  const submitConfig = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice(''); setError('')
    try {
      await saveConfig.mutateAsync(config)
      setConfig((current) => ({ ...current, apiKey: '', searchApiKey: '' }))
      setNotice('模型与搜索配置已安全保存。')
      await configQuery.refetch()
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const runTest = async () => {
    setNotice(''); setError('')
    try {
      const response = await testConfig.mutateAsync()
      setNotice(`模型连接成功${response.response ? `：${response.response}` : '。'}`)
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
  }

  const submitBuild = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice(''); setError(''); setResult(null)
    if (!file) { setError('请选择主办方提供的 2D 分区图。'); return }
    if (file.size > 12 * 1024 * 1024) { setError('图片不能超过 12 MB。'); return }
    try {
      const simulation = await build.mutateAsync({
        ...form,
        imageBase64: await fileToBase64(file),
        imageType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      })
      setResult(simulation)
      setNotice('完整模拟 JSON 已生成并保存为草稿。')
      await builds.refetch()
    } catch (reason) { setError(readableError(reason instanceof Error ? reason.message : String(reason))) }
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

  return (
    <div className="discovery-shell admin-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div><span>SIMULATION BUILDER</span><h1>构建管理</h1><p>一张 2D 分区图，生成一场可发布的现场模拟。</p></div>
          <button className="logout-button" onClick={auth.logout}><LogOut size={15} />退出登录</button>
        </div>
        <div className="admin-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'build'} className={tab === 'build' ? 'active' : ''} onClick={() => { setSearchParams({}, { replace: true }); setError(''); setNotice('') }}><Sparkles size={16} />AI 构建</button>
          <button role="tab" aria-selected={tab === 'config'} className={tab === 'config' ? 'active' : ''} onClick={() => { setSearchParams({ tab: 'config' }, { replace: true }); setError(''); setNotice('') }}><Settings2 size={16} />模型与搜索</button>
        </div>
        {(notice || error) && <div className={`admin-notice ${error ? 'is-error' : ''}`} role="status">{error || notice}</div>}
        {configQuery.error && <div className="admin-notice is-error">{readableError(configQuery.error.message)}</div>}

        {tab === 'build' ? (
          <div className="builder-layout">
            <form className="builder-form" onSubmit={submitBuild}>
              <section className="admin-section">
                <div className="admin-section-title"><span>01</span><div><h2>演出与场馆</h2><p>已有场馆会复用公开资料和基础模型。</p></div></div>
                <div className="form-grid">
                  <label className="wide"><span>演出名称</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：无限可能超级演唱会" /></label>
                  <label><span>演出主题／艺人</span><input required value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="超级演唱会" /></label>
                  <label><span>城市</span><input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                  <label className="wide"><span>复用场馆</span><select value={form.existingVenueId} onChange={(e) => {
                    const venue = venues.data?.find((item) => item.id === e.target.value)
                    setForm({ ...form, existingVenueId: e.target.value, venueName: venue?.name || form.venueName, city: venue?.city || form.city })
                  }}><option value="">新建场馆基础模型</option>{venues.data?.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} · {venue.city}</option>)}</select></label>
                  <label className="wide"><span>场馆全称</span><input required value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} disabled={Boolean(form.existingVenueId)} /></label>
                  <label><span>演出日期</span><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                  <label><span>开始时间</span><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
                </div>
              </section>
              <section className="admin-section">
                <div className="admin-section-title"><span>02</span><div><h2>主办方 2D 分区图</h2><p>视觉模型会读取票区、舞台、延伸台、控台和票档。</p></div></div>
                <label className={`image-uploader ${preview ? 'has-image' : ''}`}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {preview ? <img src={preview} alt="待构建的 2D 分区图预览" /> : <><Upload size={26} /><b>选择 2D 分区图</b><span>PNG / JPG / WebP，不超过 12 MB</span></>}
                  {file && <div className="file-caption"><FileImage size={16} /><span>{file.name}</span><b>更换图片</b></div>}
                </label>
              </section>
              <button className="build-submit" disabled={build.isPending}>{build.isPending ? <LoaderCircle className="spin" /> : <Sparkles />}{build.isPending ? '正在生成完整模拟 JSON…' : '生成并保存草稿'}<ArrowRight /></button>
              {build.isPending && <p className="build-progress">模型正在读取图片并生成结构化数据，请勿重复提交。模型与搜索调用会产生相应费用。</p>}
            </form>
            <aside className="builder-side">
              <section className="workflow-panel"><span>BUILD PIPELINE</span><h2>构建流程</h2><ol><li><i>1</i><div><b>上传本场分区图</b><p>原图进入 Supabase Storage</p></div></li><li><i>2</i><div><b>复用或检索场馆</b><p>仅新场馆调用公开资料搜索</p></div></li><li><i>3</i><div><b>AI 生成布局与主题</b><p>校验完整模拟 JSON</p></div></li><li><i>4</i><div><b>草稿审核后发布</b><p>详情页只读取最终 JSON</p></div></li></ol></section>
              {result && <section className="build-result"><span><Check />JSON 校验通过</span><h3>{result.meta.title}</h3><dl><div><dt>模拟分区</dt><dd>{result.layout.sections.length}</dd></div><div><dt>票档</dt><dd>{result.layout.priceLevels.length}</dd></div><div><dt>当前状态</dt><dd>{result.meta.status === 'draft' ? '草稿' : '已发布'}</dd></div></dl>{result.meta.status === 'draft' ? <button onClick={publishResult} disabled={publish.isPending}>{publish.isPending ? <LoaderCircle className="spin" /> : <Eye />}发布模拟器</button> : <Link to={`/simulation/${result.meta.slug}`}>打开已发布模拟器<ArrowRight /></Link>}</section>}
            </aside>
          </div>
        ) : (
          <form className="config-form" onSubmit={submitConfig}>
            <section className="admin-section">
              <div className="admin-section-title"><KeyRound /><div><h2>OpenAI 兼容模型</h2><p>密钥仅保存在服务端，读取分区图需要视觉能力。</p></div></div>
              <div className="form-grid">
                <label className="wide"><span>Base URL</span><input required type="url" value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://your-provider.example/v1" /></label>
                <label className="wide"><span>API Key {configQuery.data?.hasApiKey && <small>已配置，留空则保留原密钥</small>}</span><input type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder={configQuery.data?.hasApiKey ? '••••••••••••' : '仅在服务端保存'} autoComplete="new-password" /></label>
                <label><span>模型名称</span><input required value={config.modelName} onChange={(e) => setConfig({ ...config, modelName: e.target.value })} placeholder="your-chat-model" /></label>
                <label><span>视觉模型（可选）</span><input value={config.visionModelName} onChange={(e) => setConfig({ ...config, visionModelName: e.target.value })} placeholder="留空则使用主模型" /></label>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-title"><Search /><div><h2>独立公开资料搜索</h2><p>只在新场馆建模时使用，与站内演出搜索完全分离。</p></div></div>
              <div className="form-grid">
                <label><span>搜索服务</span><select value={config.searchProvider} onChange={(e) => setConfig({ ...config, searchProvider: e.target.value as 'none' | 'tavily' })}><option value="none">不配置</option><option value="tavily">Tavily Search</option></select></label>
                <label><span>自定义接口地址（可选）</span><input type="url" value={config.searchBaseUrl} onChange={(e) => setConfig({ ...config, searchBaseUrl: e.target.value })} placeholder="留空使用服务官方接口" /></label>
                <label className="wide"><span>Search API Key {configQuery.data?.hasSearchApiKey && <small>已配置，留空则保留</small>}</span><input type="password" value={config.searchApiKey} onChange={(e) => setConfig({ ...config, searchApiKey: e.target.value })} autoComplete="new-password" /></label>
              </div>
            </section>
            <div className="config-actions"><button type="submit" disabled={saveConfig.isPending}>{saveConfig.isPending ? <LoaderCircle className="spin" /> : <Database />}保存配置</button><button type="button" onClick={runTest} disabled={testConfig.isPending}>{testConfig.isPending ? <LoaderCircle className="spin" /> : <Settings2 />}测试已保存模型</button></div>
            <p className="security-note"><KeyRound size={14} />API Key 不会进入浏览器响应、模拟 JSON 或公开数据库读取结果。模型和搜索调用按服务商规则计费。</p>
          </form>
        )}
      </main>
    </div>
  )
}
