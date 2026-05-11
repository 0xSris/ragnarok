import { useQuery } from '@tanstack/react-query'
import { Cpu, Database, Eye, FileText, Gauge, ShieldCheck, Waves } from 'lucide-react'
import { getIngestionJobs, getSystemStatus, getEvalDashboard } from '../utils/api'

function StatusRow({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm soft">{label}</span>
      <span className={ok ? 'badge badge-green' : 'badge badge-red'}>{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { data: status } = useQuery({ queryKey: ['system-status'], queryFn: getSystemStatus, refetchInterval: 10000 })
  const { data: jobs } = useQuery({ queryKey: ['ingestion-jobs'], queryFn: getIngestionJobs, refetchInterval: 5000 })
  const { data: evals } = useQuery({ queryKey: ['eval-summary'], queryFn: getEvalDashboard, refetchInterval: 10000 })

  const latestJobs = jobs?.jobs || []

  return (
    <div className="space-y-6 p-6">
      <section className="flex items-end justify-between">
        <div>
          <p className="page-kicker">local forensic knowledge lab</p>
          <h1 className="page-title mt-2 text-3xl">Offline AI Knowledge Command Center</h1>
          <p className="mt-2 max-w-3xl text-sm soft">
            Ingest private documents, images, scans, audio, and transcripts, then inspect every retrieval decision before a local LLM answers.
          </p>
        </div>
        <div className="hidden gap-2 xl:flex">
          {(status?.privacy_badges || []).slice(0, 3).map((badge) => <span key={badge} className="badge badge-green"><ShieldCheck size={12} />{badge}</span>)}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-4 max-xl:grid-cols-2">
        <div className="metric"><FileText className="mb-3" style={{ color: 'var(--accent)' }} /><div className="text-2xl font-black">{status?.chromadb?.document_count ?? 0}</div><div className="mono text-xs muted">indexed docs</div></div>
        <div className="metric"><Database className="mb-3" style={{ color: 'var(--success)' }} /><div className="text-2xl font-black">{status?.chromadb?.chunk_count ?? 0}</div><div className="mono text-xs muted">local chunks</div></div>
        <div className="metric"><Gauge className="mb-3" style={{ color: 'var(--warning)' }} /><div className="text-2xl font-black">{evals?.answer_latency_ms || 0}ms</div><div className="mono text-xs muted">avg answer latency</div></div>
        <div className="metric"><Eye className="mb-3" style={{ color: 'var(--accent-strong)' }} /><div className="text-2xl font-black">{Math.round((evals?.retrieval_hit_rate || 0) * 100)}%</div><div className="mono text-xs muted">retrieval hit rate</div></div>
      </section>

      <section className="grid grid-cols-[1.1fr_.9fr] gap-4 max-xl:grid-cols-1">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Offline System Status</h2>
            <span className="badge badge-cyan"><Cpu size={12} />{status?.selected_llm || 'llama3'}</span>
          </div>
          <StatusRow label="Ollama daemon" value={status?.ollama?.available ? 'running' : 'not detected'} ok={status?.ollama?.available} />
          <StatusRow label="Embedding model" value={status?.embedding_model?.available ? status?.embedding_model?.name : 'package missing'} ok={status?.embedding_model?.available} />
          <StatusRow label="ChromaDB local index" value={status?.chromadb?.available ? 'available' : 'SQLite fallback'} ok={status?.chromadb?.available} />
          <StatusRow label="Tesseract OCR" value={status?.tesseract?.available ? 'available' : 'not detected'} ok={status?.tesseract?.available} />
          <StatusRow label="Whisper STT" value={status?.whisper?.available ? 'available' : 'not detected'} ok={status?.whisper?.available} />
          <StatusRow label="Cross-encoder reranker" value={status?.reranker?.available ? 'available' : 'fallback scores'} ok={status?.reranker?.available} />
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Ingestion Queue</h2>
            <span className="badge badge-amber"><Waves size={12} />live pipeline</span>
          </div>
          <div className="space-y-3">
            {latestJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="subtle-panel p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{job.filename}</span>
                  <span className={job.status === 'ready' ? 'badge badge-green' : job.status === 'error' ? 'badge badge-red' : 'badge badge-amber'}>{job.stage}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <div className="h-full" style={{ width: `${job.progress || 0}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
            {!latestJobs.length && <p className="text-sm muted">No active ingestion jobs yet.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
