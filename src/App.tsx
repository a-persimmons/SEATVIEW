import { Navigate, Route, Routes } from 'react-router'
import HomePage from '@/pages/HomePage'
import SearchPage from '@/pages/SearchPage'
import SimulationPage from '@/pages/SimulationPage'
import AdminPage from '@/pages/AdminPage'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import './Discovery.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/simulation/:slug" element={<SimulationPage />} />
      <Route path="/simulator" element={<Navigate to="/simulation/hebei-endless-possibility-2026" replace />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
