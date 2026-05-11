import { useQuery } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { getSystemStatus, listModels, updateRetrievalSettings } from '../utils/api'

export default function SettingsPage() {
  const { data: status } = useQuery({ queryKey: ['system-status'], queryFn: getSystemStatus, refetchInterval: 10000 })
  const { data: modelsData } = useQuery({ queryKey: ['models'], queryFn: listModels })
  const [settings, setSettings] = useState({
    selected_llm: 'llama3',
    top_k: 10,
    chunk_size: 512,
    chunk_overlap: 64,
    reranker_enabled: true,
    temperature: 0.1,
    citation_strictness: 'strict',
  })
  const models = modelsData?.llm_models || ['llama3', 'mistral', 'phi3']

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }))
  const save = async () => {
    await updateRetrievalSettings(settings)
    toast.success('Local retrieval settings saved')
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mono text-xs uppercase tracking-[0.25em] text-cyan-300">local model and retrieval settings</p>
        <h1 className="mt-2 text-3xl font-black text-white">Settings</h1>
      </div>
      <div className="grid grid-cols-[1fr_420px] gap-5">
        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold text-white">Prompt and Context Controls</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2"><span className="mono text-xs text-slate-500">LLM model</span><select className="field" value={settings.selected_llm} onChange={(event) => update('selected_llm', event.target.value)}>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
            <label className="space-y-2"><span className="mono text-xs text-slate-500">citation strictness</span><select className="field" value={settings.citation_strictness} onChange={(event) => update('citation_strictness', event.target.value)}><option>strict</option><option>balanced</option><option>exploratory</option></select></label>
            <label className="space-y-2"><span className="mono text-xs text-slate-500">top-k {settings.top_k}</span><input type="range" min="3" max="30" value={settings.top_k} onChange={(event) => update('top_k', Number(event.target.value))} /></label>
            <label className="space-y-2"><span className="mono text-xs text-slate-500">temperature {settings.temperature}</span><input type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={(event) => update('temperature', Number(event.target.value))} /></label>
            <label className="space-y-2"><span className="mono text-xs text-slate-500">chunk size</span><input className="field" type="number" value={settings.chunk_size} onChange={(event) => update('chunk_size', Number(event.target.value))} /></label>
            <label className="space-y-2"><span className="mono text-xs text-slate-500">overlap</span><input className="field" type="number" value={settings.chunk_overlap} onChange={(event) => update('chunk_overlap', Number(event.target.value))} /></label>
          </div>
          <label className="mt-5 flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <span>Cross-encoder reranker</span>
            <input type="checkbox" checked={settings.reranker_enabled} onChange={(event) => update('reranker_enabled', event.target.checked)} />
          </label>
          <button className="btn-primary mt-5" onClick={save}><Save size={16} /> Save local settings</button>
        </section>

        <aside className="panel p-5">
          <h2 className="mb-4 text-lg font-bold text-white">System Status</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Ollama</span><span className={status?.ollama?.available ? 'badge badge-green' : 'badge badge-red'}>{status?.ollama?.available ? 'running' : 'offline'}</span></div>
            <div className="flex justify-between"><span>Embeddings</span><span className="badge">{status?.embedding_model?.name}</span></div>
            <div className="flex justify-between"><span>Chroma chunks</span><span className="badge badge-cyan">{status?.chromadb?.chunk_count || 0}</span></div>
            <div className="flex justify-between"><span>Tesseract</span><span className={status?.tesseract?.available ? 'badge badge-green' : 'badge badge-red'}>{status?.tesseract?.available ? 'available' : 'missing'}</span></div>
            <div className="flex justify-between"><span>Whisper</span><span className={status?.whisper?.available ? 'badge badge-green' : 'badge badge-red'}>{status?.whisper?.available ? 'available' : 'missing'}</span></div>
          </div>
        </aside>
      </div>
    </div>
  )
}
