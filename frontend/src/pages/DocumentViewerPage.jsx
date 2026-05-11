import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Image, Music, ScanText } from 'lucide-react'
import { getDocument, getDocumentChunks } from '../utils/api'

export default function DocumentViewerPage() {
  const { id } = useParams()
  const { data: doc } = useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id) })
  const { data: chunksData } = useQuery({ queryKey: ['document-chunks', id], queryFn: () => getDocumentChunks(id) })
  const chunks = chunksData?.chunks || []
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'].includes(doc?.file_type)
  const isAudio = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'mp4'].includes(doc?.file_type)

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[420px_1fr]">
      <aside className="border-r border-slate-800 p-6">
        <p className="mono text-xs uppercase tracking-[0.25em] text-cyan-300">source viewer</p>
        <h1 className="mt-2 break-words text-2xl font-black text-white">{doc?.original_filename || 'Document'}</h1>
        <div className="mt-5 space-y-2">
          <span className="badge badge-cyan">{doc?.file_type}</span>
          <span className={doc?.status === 'ready' ? 'badge badge-green ml-2' : 'badge badge-amber ml-2'}>{doc?.status}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="metric"><div className="mono text-[10px] text-slate-500">chunks</div><div className="text-xl font-black">{doc?.chunk_count || 0}</div></div>
          <div className="metric"><div className="mono text-[10px] text-slate-500">pages</div><div className="text-xl font-black">{doc?.page_count || 0}</div></div>
        </div>
        <div className="panel mt-5 p-4">
          <div className="mb-3 flex items-center gap-2 font-bold"><ScanText size={16} /> Provenance</div>
          <div className="space-y-2 mono text-xs text-slate-400">
            <div>OCR confidence: {doc?.metadata?.ocr_confidence ? `${Math.round(doc.metadata.ocr_confidence * 100)}%` : 'not required'}</div>
            <div>Transcript: {doc?.metadata?.transcript_duration || 'not required'}</div>
            <div>Vector indexed: {doc?.metadata?.vector_indexed ? 'yes' : 'fallback/local chunks'}</div>
          </div>
        </div>
      </aside>

      <main className="space-y-5 overflow-auto p-6">
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            {isImage ? <Image /> : isAudio ? <Music /> : <FileText />} Preview
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
            {isImage && 'Image OCR overlay available through extracted text chunks below.'}
            {isAudio && 'Audio transcript with timestamp chunks appears below.'}
            {!isImage && !isAudio && 'Document text is available as highlighted source chunks below.'}
          </div>
        </div>

        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold text-white">Matched Chunks</h2>
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <article key={chunk.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="badge badge-cyan">chunk {chunk.chunk_index}</span>
                  <span className="badge">{chunk.page ? `page ${chunk.page}` : chunk.timestamp || 'source text'}</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">{chunk.text}</p>
              </article>
            ))}
            {!chunks.length && <p className="text-sm text-slate-500">No chunks stored for this source yet.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}
