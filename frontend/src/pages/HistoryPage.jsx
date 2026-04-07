import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, Download, ThumbsUp, ThumbsDown, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getHistory, deleteHistory, clearHistory, exportAnswers } from '../utils/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function HistoryItem({ item, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card-cartoon overflow-hidden"
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); setSelected(e.target.checked) }}
          className="mt-1 accent-purple-500"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{item.query}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs opacity-50 flex items-center gap-1">
              <Clock size={10} />
              {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
            </span>
            {item.model_used && (
              <span className="tag-pill">{item.model_used}</span>
            )}
            {item.latency_ms && (
              <span className="text-xs opacity-40">{item.latency_ms}ms</span>
            )}
            {item.feedback != null && (
              <span className={`text-xs font-bold ${item.feedback >= 4 ? 'text-green-500' : 'text-red-400'}`}>
                {item.feedback >= 4 ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400 opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t px-4 pb-4 pt-3 overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="prose-rag text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer || ''}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function HistoryPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['history', search, page],
    queryFn: () => getHistory({ search, page, page_size: 20 }),
  })

  const items = data?.history || []
  const total = data?.total || 0

  const handleDelete = async (id) => {
    try {
      await deleteHistory(id)
      queryClient.invalidateQueries(['history'])
      toast.success('Deleted!')
    } catch { toast.error('Delete failed') }
  }

  const handleClearAll = async () => {
    if (!confirm('Clear all history? This cannot be undone.')) return
    try {
      await clearHistory()
      queryClient.invalidateQueries(['history'])
      toast.success('History cleared! 🧹')
    } catch { toast.error('Failed') }
  }

  const handleExport = async () => {
    const ids = items.map((i) => i.id)
    if (!ids.length) return toast.error('No history to export')
    try {
      const res = await exportAnswers(ids, 'markdown')
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = 'ragnarok_history.md'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported! 📄')
    } catch { toast.error('Export failed') }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--accent)' }}>Query History</h1>
          <p className="text-sm font-semibold opacity-60 mt-0.5">{total} queries stored</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl card-cartoon text-xs font-bold">
            <Download size={13} /> Export
          </button>
          <button onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-red-200 dark:border-red-900 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={13} /> Clear All
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
        <input
          className="rag-input pl-9"
          placeholder="Search queries and answers…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card-cartoon h-16 shimmer" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <p className="font-display text-xl opacity-50">No history yet</p>
          <p className="text-sm opacity-40 mt-1">Start chatting to build your history!</p>
        </div>
      ) : (
        <div className="space-y-3 group">
          <AnimatePresence>
            {items.map((item) => (
              <HistoryItem key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-3 mt-6">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            className="btn-glow px-4 py-2 text-sm disabled:opacity-30">← Prev</button>
          <span className="flex items-center text-sm font-bold opacity-60">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}
            className="btn-glow px-4 py-2 text-sm disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  )
}
