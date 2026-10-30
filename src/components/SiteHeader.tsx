import { Eye, Search, Settings2 } from 'lucide-react'
import { Link, NavLink } from 'react-router'

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-brand" aria-label="席见｜SEATVIEW 首页">
        <Eye size={23} strokeWidth={1.7} />
        <span>席见｜SEATVIEW<small>现场视角模拟器</small></span>
      </Link>
      <nav aria-label="主导航">
        <NavLink to="/" end>演出</NavLink>
        <NavLink to="/search"><Search size={15} />搜索</NavLink>
        <NavLink to="/admin?tab=config" className="admin-nav" aria-label="模型与搜索 API 配置" title="模型与搜索 API 配置"><Settings2 size={15} /><span>模型设置</span></NavLink>
      </nav>
    </header>
  )
}
