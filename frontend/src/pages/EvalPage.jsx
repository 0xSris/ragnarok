import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Plus, Play, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createEval, listEvals, getEval, getEvalDashboard, listCollections } from '../utils/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import toast from 'react-hot-toast'

const SAMPLE_QUESTIONS = [
  { question: 'What are the main topics covered?', expected_answer: null },
  { question: 'Summarize the key findings', expected_answer: null },
]

export default function EvalPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [evalName, setEvalName] = useState('')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [questions, setQuestions] = useState(SAMPLE_QUESTIONS)
  const [newQ, setNewQ] = useState('')
  const [selectedEval, setSelectedEval] = useState(null)
  const queryClient = useQueryClient()

  const { data: collectionsData } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const collections = collectionsData?.collections || []

  const { data: evalsData } = useQuery({ queryKey: ['evals'], queryFn: listEvals, refetchInterval: 5000 })
  const evals = evalsData?.evals || []

  const { data: dashData } = useQuery({ queryKey: ['eval-dashboard'], queryFn: getEvalDashboard })
  const stats = dashData?.stats || {}
  const daily = dashData?.daily_queries || []
  const byModel = dashData?.by_model || []

  const { data: evalDetail } = useQuery({
    queryKey: ['eval', selectedEval],
    queryFn: () => getEval(selectedEval),
    enabled: !!selectedEval,
    refetchInterval: (data) => data?.status === 'running' ? 2000 : false,
  })

  const handleCreateEval = async () => {
    if (!evalName || !selectedCollection || questions.length === 0) {
      return toast.error('Fill in all fields and add at least one question')
    }
    try {
      const res = await createEval({
        name: evalName,
        collection_id: selectedCollection,
        questions,
      })
      toast.success('Evaluation started! 🧪')
      queryClient.invalidateQueries(['evals'])
      setShowCreate(false)
      setSelectedEval(res.eval_id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create eval')
    }
  }

  const addQuestion = () => {
    if (!newQ.trim()) return
    setQuestions([...questions, { question: newQ.trim() }])
    setNewQ('')
  }

  const MetricCard = ({ label, value, icon: Icon, color }) => (
    <motion.div whileHover={{ scale: 1.02 }} className="card-cartoon p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#d946ef,#7c3aed)' }}>
          <Icon size={18} color="white" />
        </div>
        <div>
          <div className="font-display text-xl" style={{ color: 'var(--accent)' }}>
            {value ?? '—'}
          </div>
          <div className="text-xs font-semibold opacity-60">{label}</div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--accent)' }}>Evaluation Dashboard</h1>
          <p className="text-sm font-semibold opacity-60 mt-0.5">Measure retrieval quality and answer faithfulness</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="btn-glow px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={15} /> New Eval Run
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Queries" value={stats.total || 0} icon={BarChart2} />
        <MetricCard label="Avg Latency" value={stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : '—'} icon={Clock} />
        <MetricCard label="Avg Rating" value={stats.avg_rating ? stats.avg_rating.toFixed(1) + '/5' : '—'} icon={TrendingUp} />
        <MetricCard label="Positive Feedback" value={stats.positive_feedback || 0} icon={CheckCircle} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily queries */}
        <div className="card-cartoon p-4">
          <h3 className="font-bold mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Daily Queries (30d)</h3>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[...daily].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: '0.75rem' }} />
                <Bar dataKey="count" fill="url(#grad)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center opacity-30">
              <p className="text-sm font-semibold">No data yet</p>
            </div>
          )}
        </div>

        {/* By model */}
        <div className="card-cartoon p-4">
          <h3 className="font-bold mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Usage by Model</h3>
          {byModel.length > 0 ? (
            <div className="space-y-3">
              {byModel.map((m) => (
                <div key={m.model_used} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-24 truncate">{m.model_used}</span>
                  <div className="progress-bar flex-1">
                    <div className="progress-fill"
                      style={{ width: `${Math.min(100, (m.count / (stats.total || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono opacity-60 w-8 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center opacity-30">
              <p className="text-sm font-semibold">No model data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Create eval form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="card-cartoon p-5 mb-6">
          <h3 className="font-display text-lg mb-4" style={{ color: 'var(--accent)' }}>New Evaluation Run</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold mb-1 opacity-60">RUN NAME</label>
              <input className="rag-input" placeholder="e.g. Baseline v1"
                value={evalName} onChange={(e) => setEvalName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 opacity-60">COLLECTION</label>
              <select className="rag-input" value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}>
                <option value="">Select collection…</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <label className="block text-xs font-bold mb-2 opacity-60">TEST QUESTIONS ({questions.length})</label>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-secondary)' }}>
                <span className="opacity-40 font-mono text-xs w-5">{i + 1}.</span>
                <span className="flex-1 truncate">{q.question}</span>
                <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                  className="opacity-40 hover:opacity-100 text-red-400">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="rag-input flex-1 text-sm py-2" placeholder="Add a question…"
              value={newQ} onChange={(e) => setNewQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQuestion()} />
            <button onClick={addQuestion}
              className="btn-glow px-4 py-2 text-sm">Add</button>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleCreateEval}
              className="btn-glow px-5 py-2.5 flex items-center gap-2">
              <Play size={15} /> Run Evaluation
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-2xl border-2 text-sm font-bold hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: 'var(--border)' }}>
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Eval list */}
      <h3 className="font-display text-lg mb-3" style={{ color: 'var(--text-secondary)' }}>Eval Runs</h3>
      {evals.length === 0 ? (
        <div className="text-center py-10 opacity-40">
          <div className="text-4xl mb-2">🧪</div>
          <p className="font-semibold">No eval runs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evals.map((ev) => {
            const icon = ev.status === 'done' ? CheckCircle : ev.status === 'error' ? XCircle : Clock
            const color = ev.status === 'done' ? 'text-green-500' : ev.status === 'error' ? 'text-red-400' : 'text-yellow-500'
            const Icon = icon
            return (
              <motion.div key={ev.id} whileHover={{ x: 2 }}
                className="card-cartoon p-4 cursor-pointer flex items-center gap-4"
                onClick={() => setSelectedEval(ev.id === selectedEval ? null : ev.id)}>
                <Icon size={20} className={color} />
                <div className="flex-1">
                  <p className="font-bold text-sm">{ev.name}</p>
                  <p className="text-xs opacity-40">{ev.created_at?.slice(0, 19).replace('T', ' ')}</p>
                </div>
                <span className={`tag-pill ${color}`}>{ev.status}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Eval detail */}
      {evalDetail && evalDetail.results?.individual && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="card-cartoon p-5 mt-5">
          <h3 className="font-display text-lg mb-3" style={{ color: 'var(--accent)' }}>
            Results: {evalDetail.name}
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Questions', value: evalDetail.results.total_questions },
              { label: 'Hit@K', value: evalDetail.results.hit_at_k != null ? (evalDetail.results.hit_at_k * 100).toFixed(0) + '%' : '—' },
              { label: 'Faithfulness', value: evalDetail.results.avg_faithfulness != null ? (evalDetail.results.avg_faithfulness * 100).toFixed(0) + '%' : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
                <div className="font-display text-2xl" style={{ color: 'var(--accent)' }}>{value}</div>
                <div className="text-xs font-semibold opacity-60">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {evalDetail.results.individual.map((r, i) => (
              <div key={i} className="p-3 rounded-xl text-sm" style={{ background: 'var(--bg-secondary)' }}>
                <p className="font-bold mb-1">{r.question}</p>
                <p className="opacity-60 text-xs line-clamp-2">{r.answer}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
