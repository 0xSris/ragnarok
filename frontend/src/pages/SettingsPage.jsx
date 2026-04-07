import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Sun, Moon, Cpu, Database, Shield, Info, Save } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store'
import { checkHealth, listModels } from '../utils/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { darkMode, toggleDarkMode, activeModel, setActiveModel, user } = useStore()
  const [chunkSize, setChunkSize] = useState(512)
  const [topK, setTopK] = useState(10)
  const [temperature, setTemperature] = useState(0.1)

  const { data: healthData } = useQuery({ queryKey: ['health'], queryFn: checkHealth })
  const { data: modelsData } = useQuery({ queryKey: ['models'], queryFn: listModels })
  const models = modelsData?.models || ['llama3']

  const Section = ({ title, icon: Icon, children }) => (
    <div className="card-cartoon p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="font-display text-lg" style={{ color: 'var(--accent)' }}>{title}</h3>
      </div>
      {children}
    </div>
  )

  const Row = ({ label, description, children }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}>
      <div>
        <p className="text-sm font-bold">{label}</p>
        {description && <p className="text-xs opacity-50 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }) => (
    <div className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${value ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      onClick={onChange}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl" style={{ color: 'var(--accent)' }}>Settings</h1>
        <p className="text-sm font-semibold opacity-60 mt-0.5">Configure RAGNAROK to your preferences</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={Sun}>
        <Row label="Dark Mode" description="Toggle between light and dark theme">
          <Toggle value={darkMode} onChange={toggleDarkMode} />
        </Row>
      </Section>

      {/* LLM */}
      <Section title="Language Model" icon={Cpu}>
        <Row label="Default Model" description="Model used for all queries">
          <select className="rag-input py-1.5 text-sm w-40"
            value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="Temperature" description={`Creativity level: ${temperature} (lower = more focused)`}>
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="1" step="0.05" value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-28 accent-purple-500" />
            <span className="text-xs font-mono w-8 text-right">{temperature}</span>
          </div>
        </Row>
      </Section>

      {/* Retrieval */}
      <Section title="Retrieval" icon={Database}>
        <Row label="Chunk Size" description="Words per chunk (restart to apply)">
          <div className="flex items-center gap-2">
            <input type="range" min="128" max="1024" step="64" value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value))}
              className="w-28 accent-purple-500" />
            <span className="text-xs font-mono w-12 text-right">{chunkSize}w</span>
          </div>
        </Row>
        <Row label="Top-K Results" description="Documents retrieved per query">
          <div className="flex items-center gap-2">
            <input type="range" min="3" max="20" step="1" value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-28 accent-purple-500" />
            <span className="text-xs font-mono w-6 text-right">{topK}</span>
          </div>
        </Row>
      </Section>

      {/* User */}
      <Section title="Account" icon={Shield}>
        <Row label="Username"><span className="text-sm font-bold">{user?.username}</span></Row>
        <Row label="Role"><span className="tag-pill capitalize">{user?.role}</span></Row>
      </Section>

      {/* System status */}
      <Section title="System Status" icon={Info}>
        <div className="space-y-2">
          {[
            { label: 'API Server', ok: !!healthData },
            { label: 'Vector DB (Chroma)', ok: !!healthData },
            { label: 'LLM (Ollama)', ok: models.length > 0 },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold">{label}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${ok ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : 'bg-red-100 dark:bg-red-900/20 text-red-500'}`}>
                {ok ? '● Operational' : '● Offline'}
              </span>
            </div>
          ))}
        </div>
        {healthData && (
          <div className="mt-3 p-3 rounded-xl text-xs font-mono opacity-60"
            style={{ background: 'var(--bg-secondary)' }}>
            {JSON.stringify(healthData, null, 2)}
          </div>
        )}
      </Section>

      <p className="text-center text-xs opacity-30 font-semibold">
        RAGNAROK v1.0.0 · 100% Offline · MIT License
      </p>
    </div>
  )
}
