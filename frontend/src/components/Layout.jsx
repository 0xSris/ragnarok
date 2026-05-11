import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  Database,
  FolderKanban,
  LogOut,
  MessageSquareText,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UploadCloud,
} from 'lucide-react'
import clsx from 'clsx'
import { getSystemStatus } from '../utils/api'
import { useStore } from '../store'
import CursorCompanion from './CursorCompanion'

const navItems = [
  { to: '/dashboard', icon: Activity, label: 'Dashboard' },
  { to: '/ingest', icon: UploadCloud, label: 'Ingest' },
  { to: '/library', icon: Database, label: 'Library' },
  { to: '/chat', icon: MessageSquareText, label: 'RAG Chat' },
  { to: '/collections', icon: FolderKanban, label: 'Collections' },
  { to: '/evals', icon: BarChart3, label: 'Evals' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function HealthDot({ ok }) {
  return <span className={clsx('h-2.5 w-2.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-rose-400')} />
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { logout, user, darkMode, toggleDarkMode } = useStore()
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    refetchInterval: 10000,
  })

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const privacyBadges = (status?.privacy_badges || ['Fully Offline', 'Local LLM', 'Local Vectors', 'No Cloud Calls']).slice(0, 2)

  return (
    <div className="min-h-screen bg-rag">
      <aside className="app-sidebar fixed left-0 top-0 z-20 w-64">
        <div className="flex h-full flex-col">
          <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="brand-mark grid h-10 w-10 place-items-center rounded-xl">
                <Boxes size={20} />
              </div>
              <div>
                <div className="text-lg font-black tracking-[0.14em]">RAGNAROK</div>
                <div className="mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--accent-strong)' }}>offline RAG</div>
              </div>
            </div>
          </div>

          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="grid gap-2">
              {privacyBadges.map((badge) => (
                <div key={badge} className="badge badge-green">
                  <ShieldCheck size={12} />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => clsx('nav-ops', isActive && 'active')}>
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer border-t p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="subtle-panel mb-3 p-3">
              <div className="mb-2 flex items-center justify-between mono text-[11px] uppercase muted">
                <span>Runtime</span>
                <Bot size={14} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs soft">
                <div className="flex items-center justify-center gap-1"><HealthDot ok={status?.ollama?.available} /><span>LLM</span></div>
                <div className="flex items-center justify-center gap-1"><HealthDot ok={status?.embedding_model?.available} /><span>Emb</span></div>
                <div className="flex items-center justify-center gap-1"><HealthDot ok={status?.chromadb?.available || status?.chromadb?.chunk_count >= 0} /><span>Vec</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl font-bold text-white" style={{ background: 'var(--accent)' }}>
                {(user?.username?.[0] || 'A').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{user?.username || 'admin'}</div>
                <div className="mono text-[11px] muted">local session</div>
              </div>
              <button onClick={handleLogout} className="icon-button" title="Logout">
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <div className="app-topbar sticky top-0 z-10 flex h-14 items-center justify-between px-6">
          <div className="mono text-xs uppercase tracking-[0.16em]">
            Private local multimodal RAG
          </div>
          <div className="flex items-center gap-3">
            <span className="badge">LLM <b>{status?.selected_llm || 'llama3'}</b></span>
            <span className="badge">Chunks <b>{status?.chromadb?.chunk_count ?? 0}</b></span>
            <button onClick={toggleDarkMode} className="btn-secondary py-2" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              {darkMode ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
        {children}
      </main>
      <CursorCompanion />
    </div>
  )
}
