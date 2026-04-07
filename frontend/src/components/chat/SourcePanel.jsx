import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Star } from 'lucide-react'

export default function SourcePanel({ sources, onClose }) {
  return (
    <AnimatePresence>
      {sources && sources.length > 0 && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-80 shrink-0 border-l flex flex-col h-full overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <span className="font-display text-base" style={{ color: 'var(--accent)' }}>
              Sources ({sources.length})
            </span>
            <button onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-purple-100 dark:hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {sources.map((src, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card-cartoon p-3"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold text-white bg-accent">
                    {src.index || i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {src.filename || 'Unknown source'}
                    </div>
                    {src.page > 0 && (
                      <div className="text-xs opacity-50">Page {src.page}</div>
                    )}
                  </div>
                </div>

                {/* Relevance score */}
                {src.relevance_score !== undefined && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Star size={11} className="text-yellow-400" />
                    <div className="progress-bar flex-1">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, src.relevance_score * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono opacity-60">
                      {(src.relevance_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                {src.chunk_text && (
                  <p className="text-xs leading-relaxed opacity-70 line-clamp-5">
                    {src.chunk_text}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
