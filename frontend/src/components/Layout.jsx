import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, FileText, Clock, BarChart2,
  Layers, Settings, LogOut, Menu, X, Sun, Moon,
  Zap, Brain
} from 'lucide-react'
import { useStore } from '../store'
import MascotIdle from './mascot/MascotIdle'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/chat',        icon: MessageSquare, label: 'Chat' },
  { to: '/documents',  icon: FileText,       label: 'Documents' },
  { to: '/collections',icon: Layers,         label: 'Collections' },
  { to: '/history',    icon: Clock,          label: 'History' },
  { to: '/eval',       icon: BarChart2,      label: 'Evaluation' },
  { to: '/settings',   icon: Settings,       label: 'Settings' },
]

export default function Layout({ children }) {
  const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode, logout, user, focusMode, toggleFocusMode } = useStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden relative bg-primary-50 dark:bg-primary-900">
      {/* ── Sidebar ── */}
      <AnimatePresence>
        {(sidebarOpen && !focusMode) && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-20 flex flex-col w-64 shrink-0 h-screen overflow-y-auto bg-sidebar border-r border-border"
          >
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-accent text-white">
                <Brain size={20} />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-primary-900 dark:text-primary-100 leading-none">RAGNAROK</div>
                <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">Offline AI</div>
              </div>
            </div>

            {/* Mascot */}
            <div className="flex justify-center py-4 border-b border-border">
              <MascotIdle size={90} />
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 space-y-1">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => clsx('nav-item', isActive && 'active')}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Bottom */}
            <div className="px-3 pb-4 space-y-1 border-t border-border pt-3">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white bg-accent">
                  {(user?.username?.[0] || 'G').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-primary-900 dark:text-primary-100 truncate">{user?.username || 'Guest'}</div>
                  <div className="text-xs text-primary-600 dark:text-primary-400">{user?.role || 'user'}</div>
                </div>
              </div>

              <button
                onClick={toggleDarkMode}
                className="nav-item w-full"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              <button onClick={handleLogout} className="nav-item w-full text-red-600 hover:text-red-700">
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-500" />
            <span className="text-sm font-medium text-secondary">
              Fully Offline · Multimodal · Private
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleFocusMode}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
              title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            >
              {focusMode ? <Menu size={18} /> : <Zap size={18} />}
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              {darkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <motion.main
          key={window.location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-auto relative"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
