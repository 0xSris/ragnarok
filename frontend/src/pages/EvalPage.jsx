import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Clock, Database, Target } from 'lucide-react'
import { getEvalDashboard, getChatHistory } from '../utils/api'

export default function EvalPage() {
  const { data } = useQuery({ queryKey: ['eval-summary'], queryFn: getEvalDashboard, refetchInterval: 10000 })
  const { data: historyData } = useQuery({ queryKey: ['chat-history'], queryFn: getChatHistory })
  const history = historyData?.history || []

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mono text-xs uppercase tracking-[0.25em] text-cyan-300">evaluation dashboard</p>
        <h1 className="mt-2 text-3xl font-black text-white">RAG Quality Signals</h1>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="metric"><Clock className="mb-3 text-cyan-300" /><div className="text-2xl font-black">{data?.answer_latency_ms || 0}ms</div><div className="mono text-xs text-slate-500">answer latency</div></div>
        <div className="metric"><Target className="mb-3 text-emerald-300" /><div className="text-2xl font-black">{Math.round((data?.retrieval_hit_rate || 0) * 100)}%</div><div className="mono text-xs text-slate-500">hit rate</div></div>
        <div className="metric"><Activity className="mb-3 text-violet-300" /><div className="text-2xl font-black">{data?.average_score || 0}</div><div className="mono text-xs text-slate-500">avg score</div></div>
        <div className="metric"><Database className="mb-3 text-amber-300" /><div className="text-2xl font-black">{data?.indexed_docs || 0}</div><div className="mono text-xs text-slate-500">indexed docs</div></div>
        <div className="metric"><AlertTriangle className="mb-3 text-rose-300" /><div className="text-2xl font-black">{data?.failed_ingestions || 0}</div><div className="mono text-xs text-slate-500">failed ingestions</div></div>
      </div>
      <div className="panel overflow-hidden">
        <table className="table-ops">
          <thead><tr><th>Query</th><th>Model</th><th>Latency</th><th>Citations</th><th>Created</th></tr></thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td className="max-w-xl">{item.query}</td>
                <td><span className="badge">{item.model_used}</span></td>
                <td className="mono">{item.latency_ms || 0}ms</td>
                <td className="mono">{item.sources?.length || 0}</td>
                <td className="mono text-xs text-slate-500">{item.created_at}</td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan="5" className="py-12 text-center text-slate-500">No query history yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
