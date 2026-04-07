import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Eye, EyeOff, Zap } from 'lucide-react'
import { useStore } from '../store'
import { login, register } from '../utils/api'
import toast from 'react-hot-toast'
import MascotIdle from '../components/mascot/MascotIdle'

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth, darkMode, toggleDarkMode } = useStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return toast.error('Fill in all fields!')
    setLoading(true)
    try {
      let data
      if (mode === 'login') {
        data = await login(username, password)
      } else {
        data = await register({ username, password, email })
      }
      setAuth(data.user || { username, role: 'user' }, data.access_token)
      toast.success(mode === 'login' ? `Welcome back, ${username}! 🎉` : `Account created! 🚀`)
      navigate('/chat')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const quickDemo = async () => {
    setLoading(true)
    try {
      const data = await login('admin', 'admin123')
      setAuth(data.user || { username: 'admin', role: 'admin' }, data.access_token)
      toast.success('Demo mode activated! 🚀')
      navigate('/chat')
    } catch {
      toast.error('Start the backend first: uvicorn backend.main:app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${darkMode ? 'dark' : ''}`}
      style={{ background: 'var(--bg-primary)' }}>

      {/* Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-5 right-5 p-2 rounded-xl card-cartoon text-sm font-bold z-10"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="card-cartoon p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <MascotIdle size={90} />
            </div>
            <h1 className="font-display text-3xl" style={{ color: 'var(--accent)' }}>RAGNAROK</h1>
            <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>
              Offline Multimodal AI Knowledge Base
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-2xl p-1 mb-6"
            style={{ background: 'var(--bg-secondary)' }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                  mode === m
                    ? 'text-white shadow-md'
                    : 'opacity-60'
                }`}
                style={mode === m ? { background: 'linear-gradient(135deg,#d946ef,#7c3aed)' } : {}}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                USERNAME
              </label>
              <input
                className="rag-input"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  EMAIL (optional)
                </label>
                <input
                  className="rag-input"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                PASSWORD
              </label>
              <div className="relative">
                <input
                  className="rag-input pr-10"
                  placeholder="••••••••"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="btn-glow w-full py-3 text-base disabled:opacity-50"
            >
              {loading ? '...' : mode === 'login' ? '🔓 Login' : '🚀 Create Account'}
            </motion.button>
          </form>

          <div className="relative my-4 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-bold opacity-50">OR</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <motion.button
            onClick={quickDemo}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-2xl text-sm font-bold border-2 flex items-center justify-center gap-2 transition-all hover:bg-purple-50 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <Zap size={16} className="text-yellow-400" />
            Quick Demo (admin / admin123)
          </motion.button>
        </div>

        <p className="text-center text-xs mt-4 opacity-50 font-semibold">
          100% offline · No telemetry · Your data stays local
        </p>
      </motion.div>
    </div>
  )
}
