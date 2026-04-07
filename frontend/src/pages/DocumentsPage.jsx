import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Trash2, RefreshCw, Search, Tag, CheckCircle, Clock, XCircle, FileImage, FileAudio, File } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { uploadDocuments, listDocuments, deleteDocument, listCollections } from '../utils/api'
import { useStore } from '../store'
import toast from 'react-hot-toast'
import MascotChat from '../components/mascot/MascotChat'
import { formatDistanceToNow } from 'date-fns'

const FILE_ICONS = {
  pdf: '📕', docx: '📘', doc: '📘', txt: '📄', md: '📝',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', webp: '🖼️', tiff: '🖼️', bmp: '🖼️',
  mp3: '🎵', wav: '🎵', m4a: '🎵', ogg: '🎵', flac: '🎵', mp4: '🎬',
}

const STATUS_CONFIG = {
  ready:      { icon: CheckCircle, color: 'text-green-500', label: 'Ready', bg: 'bg-green-100 dark:bg-green-900/20' },
  processing: { icon: Clock,       color: 'text-yellow-500', label: 'Processing', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
  error:      { icon: XCircle,     color: 'text-red-500',   label: 'Error', bg: 'bg-red-100 dark:bg-red-900/20' },
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export default function DocumentsPage() {
  const { token } = useStore()
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState([])
  const queryClient = useQueryClient()

  const { data: collectionsData } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const collections = collectionsData?.collections || []

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', collectionId, search],
    queryFn: () => listDocuments({ collection_id: collectionId || undefined }),
    refetchInterval: 5000, // Poll for processing status
  })
  const docs = data?.documents || []

  const filtered = docs.filter((d) =>
    d.original_filename.toLowerCase().includes(search.toLowerCase())
  )

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    setUploadProgress(acceptedFiles.map((f) => ({ name: f.name, progress: 0 })))

    const targetCollection = collectionId || collections[0]?.id
    if (!targetCollection) {
      toast.error('Create a collection first!')
      setUploading(false)
      return
    }

    try {
      const result = await uploadDocuments(acceptedFiles, targetCollection)
      toast.success(`${result.count} file(s) queued for processing! 🚀`)
      queryClient.invalidateQueries(['documents'])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress([])
    }
  }, [collectionId, collections])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
      'video/mp4': ['.mp4'],
    },
    multiple: true,
  })

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteDocument(id)
      toast.success('Document deleted')
      queryClient.invalidateQueries(['documents'])
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--accent)' }}>Documents</h1>
          <p className="text-sm font-semibold opacity-60 mt-0.5">
            {docs.length} documents · {docs.filter((d) => d.status === 'ready').length} indexed
          </p>
        </div>
        <button onClick={() => refetch()}
          className="p-2 rounded-xl card-cartoon text-sm font-bold flex items-center gap-1">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Upload zone */}
      <motion.div
        {...getRootProps()}
        whileHover={{ scale: 1.01 }}
        className={`relative border-3 border-dashed rounded-3xl p-10 mb-6 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''
        }`}
        style={{
          borderColor: isDragActive ? 'var(--accent)' : 'var(--border)',
          background: isDragActive ? 'rgba(217,70,239,0.06)' : 'var(--bg-card)',
          borderWidth: '2.5px',
          borderRadius: '1.5rem',
        }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <MascotChat state="upload" visible={true} message="Indexing your files! 🔄" />
          ) : (
            <>
              <motion.div
                animate={isDragActive ? { scale: [1, 1.15, 1] } : { y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-5xl"
              >
                {isDragActive ? '🎯' : '📂'}
              </motion.div>
              <div>
                <p className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>
                  {isDragActive ? 'Drop it like it\'s hot! 🔥' : 'Drop files here or click to upload'}
                </p>
                <p className="text-xs font-semibold opacity-50 mt-1">
                  PDF, DOCX, TXT, MD, PNG, JPG, MP3, WAV, MP4 and more
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploadProgress.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="card-cartoon p-4 mb-4">
            {uploadProgress.map((f, i) => (
              <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                <span className="text-sm font-semibold truncate flex-1">{f.name}</span>
                <div className="w-32 progress-bar">
                  <motion.div
                    className="progress-fill"
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'linear' }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            className="rag-input pl-9 py-2 text-sm"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rag-input py-2 text-sm w-40"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
        >
          <option value="">All collections</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-cartoon p-4 h-32 shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <p className="font-display text-xl opacity-50">No documents yet</p>
          <p className="text-sm opacity-40 mt-1">Upload some files to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((doc, i) => {
              const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing
              const StatusIcon = statusCfg.icon
              const ext = doc.file_type || 'txt'
              const emoji = FILE_ICONS[ext] || '📄'

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-cartoon p-4 group relative"
                >
                  {/* Delete btn */}
                  <button
                    onClick={() => handleDelete(doc.id, doc.original_filename)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>

                  <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0">{emoji}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate" title={doc.original_filename}>
                        {doc.original_filename}
                      </p>
                      <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${statusCfg.bg} ${statusCfg.color}`}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: 'Chunks', value: doc.chunk_count || '—' },
                      { label: 'Pages', value: doc.page_count || '—' },
                      { label: 'Size', value: formatBytes(doc.file_size) },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-1.5 rounded-xl"
                        style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                        <div className="text-xs opacity-50">{label}</div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs opacity-40 mt-2 font-semibold">
                    {doc.created_at ? formatDistanceToNow(new Date(doc.created_at), { addSuffix: true }) : ''}
                  </p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
