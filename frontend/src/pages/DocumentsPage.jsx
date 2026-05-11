import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { deleteDocument, listCollections, listDocuments, reindexDocument } from '../utils/api'

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const queryClient = useQueryClient()
  const { data: collectionsData } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const { data, isLoading } = useQuery({
    queryKey: ['documents', collectionId],
    queryFn: () => listDocuments({ collection_id: collectionId || undefined }),
    refetchInterval: 5000,
  })

  const collections = collectionsData?.collections || []
  const docs = data?.documents || []
  const filtered = useMemo(
    () => docs.filter((doc) => doc.original_filename.toLowerCase().includes(search.toLowerCase())),
    [docs, search],
  )

  const handleReindex = async (id) => {
    await reindexDocument(id)
    toast.success('Reindex queued')
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const handleDelete = async (id) => {
    await deleteDocument(id)
    toast.success('Document deleted')
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.25em] text-cyan-300">knowledge library</p>
          <h1 className="mt-2 text-3xl font-black text-white">Indexed Sources</h1>
          <p className="mt-1 text-sm text-slate-400">{docs.length} documents / {docs.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0)} chunks</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input className="field w-72 pl-9" placeholder="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="field w-56" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">All collections</option>
            {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <table className="table-ops">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Type</th>
              <th>Collection</th>
              <th>Status</th>
              <th>Chunks</th>
              <th>OCR / Transcript</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc) => (
              <tr key={doc.id}>
                <td><Link className="font-semibold text-cyan-200 hover:underline" to={`/documents/${doc.id}`}>{doc.original_filename}</Link></td>
                <td><span className="badge">{doc.file_type}</span></td>
                <td className="text-slate-400">{doc.collection_name || 'Default'}</td>
                <td><span className={doc.status === 'ready' ? 'badge badge-green' : doc.status === 'error' ? 'badge badge-red' : 'badge badge-amber'}>{doc.status}</span></td>
                <td className="mono text-cyan-100">{doc.chunk_count || 0}</td>
                <td className="text-slate-400">{doc.metadata?.ocr_confidence ? `${Math.round(doc.metadata.ocr_confidence * 100)}% OCR` : doc.metadata?.transcript_duration || 'direct text'}</td>
                <td className="mono text-xs text-slate-500">{doc.created_at}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn-secondary px-2 py-1" onClick={() => handleReindex(doc.id)} title="Reindex"><RefreshCw size={14} /></button>
                    <button className="btn-secondary px-2 py-1 text-rose-200" onClick={() => handleDelete(doc.id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan="8" className="py-12 text-center text-slate-500">{isLoading ? 'Loading local library...' : 'No indexed documents match this view.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
