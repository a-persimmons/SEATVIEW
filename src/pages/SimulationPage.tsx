import { useEffect, useState } from 'react'
import { ArrowLeft, Eye } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { trpc } from '@/providers/trpc'
import { hydrateSimulation } from '@/data'
import SimulatorDetail from './SimulatorDetail'

export default function SimulationPage() {
  const { slug = 'hebei-endless-possibility-2026' } = useParams()
  const simulation = trpc.simulations.bySlug.useQuery({ slug }, { retry: false })
  const [readySlug, setReadySlug] = useState('')

  useEffect(() => {
    if (!simulation.data) return
    hydrateSimulation(simulation.data)
    setReadySlug(simulation.data.meta.slug)
  }, [simulation.data])

  if (simulation.isLoading || (simulation.data && readySlug !== simulation.data.meta.slug)) {
    return (
      <div className="simulation-loading">
        <Eye size={30} /><span>SEATVIEW</span><p>正在装载场馆与模拟排座…</p><i />
      </div>
    )
  }

  if (simulation.error || !simulation.data) {
    return (
      <div className="simulation-loading simulation-not-found">
        <span>404 / SIMULATION NOT FOUND</span>
        <h1>没有找到这个模拟现场</h1>
        <p>它可能尚未发布，或链接已经更新。</p>
        <Link to="/"><ArrowLeft size={17} />返回演出首页</Link>
      </div>
    )
  }

  return <SimulatorDetail key={simulation.data.meta.id} />
}
