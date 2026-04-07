import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Layers, Lock, Globe } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listCollections, createCollection, deleteCollection } from '../utils/api'
import toast from 'react-hot-toast'

export default function CollectionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const collections = data?.collections || []

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Name required')
    try {
      await createCollection({ name, description, is_public: isPublic })
      toast.success('Collection created! 🗂️')
      queryClient.invalidateQueries(['collections'])
      setName(''); setDescription(''); setIsPublic(false); setShowForm(false)
    } catch { toast.error('Failed to create') }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete collection "${name}"? Documents will remain but will be uncollected.`)) return
    try {
      await deleteCollection(id)
      toast.success('Collection deleted')
      queryClient.invalidateQueries(['collections'])
    } catch { toast.error('Delete failed') }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--accent)' }}>Collections</h1>
          <p className="text-sm font-semibold opacity-60 mt-0.5">Organise documents into searchable groups</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="btn-glow px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={15} /> New Collection
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card-cartoon p-5 mb-6">
            <h3 className="font-display text-lg mb-4" style={{ color: 'var(--accent)' }}>Create Collection</h3>
            <div className="space-y-3">
              <input className="rag-input" placeholder="Collection name…"
                value={name} onChange={(e) => setName(e.target.value)} />
              <textarea className="rag-input resize-none" rows={2}
                placeholder="Optional description…"
                value={description} onChange={(e) => setDescription(e.target.value)} />
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${isPublic ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => setIsPublic(!isPublic)}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-semibold">{isPublic ? '🌍 Public' : '🔒 Private'}</span>
              </label>
              <div className="flex gap-3">
                <button onClick={handleCreate} className="btn-glow px-5 py-2.5 text-sm">Create</button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-2xl border-2 text-sm font-bold hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--border)' }}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card-cartoon h-24 shimmer" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16 opacity-40">
          <div className="text-5xl mb-3">🗂️</div>
          <p className="font-display text-xl">No collections yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col, i) => (
            <motion.div key={col.id}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="card-cartoon p-4 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: 'linear-gradient(135deg,rgba(217,70,239,0.15),rgba(124,58,237,0.15))', border: '2px solid rgba(217,70,239,0.3)' }}>
                  <Layers size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex items-center gap-1">
                  {col.is_public ? <Globe size={13} className="opacity-40" /> : <Lock size={13} className="opacity-40" />}
                  <button onClick={() => handleDelete(col.id, col.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-sm">{col.name}</h3>
              {col.description && <p className="text-xs opacity-50 mt-0.5 line-clamp-2">{col.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className="tag-pill">{col.doc_count || 0} docs</span>
                <span className="text-xs opacity-40">{col.is_public ? 'Public' : 'Private'}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
