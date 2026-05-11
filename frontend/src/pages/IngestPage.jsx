import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileAudio, FileImage, FileText, ScanLine, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { getIngestionJobs, listCollections, uploadDocuments } from '../utils/api'

const stageLabels = ['received', 'extracted', 'ocr_transcribed', 'chunked', 'embedded', 'indexed', 'ready']

export default function IngestPage() {
  const queryClient = useQueryClient()
  const [collectionId, setCollectionId] = useState('')
  const { data: collectionsData } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const { data: jobsData } = useQuery({ queryKey: ['ingestion-jobs'], queryFn: getIngestionJobs, refetchInterval: 3000 })
  const collections = collectionsData?.collections || []
  const jobs = jobsData?.jobs || []

  const onDrop = useCallback(async (files) => {
    if (!files.length) return
    const targetCollection = collectionId || collections[0]?.id
    if (!targetCollection) {
      toast.error('Create a collection before ingesting files.')
      return
    }
    try {
      const result = await uploadDocuments(files, targetCollection)
      toast.success(`${result.count} file(s) queued for local ingestion`)
      queryClient.invalidateQueries({ queryKey: ['ingestion-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed')
    }
  }, [collectionId, collections, queryClient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
      'video/mp4': ['.mp4'],
    },
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.25em] text-cyan-300">multimodal ingestion hub</p>
          <h1 className="mt-2 text-3xl font-black text-white">Ingest, Extract, Embed, Index</h1>
        </div>
        <select className="field w-64" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
          <option value="">Default collection</option>
          {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </select>
      </div>

      <section {...getRootProps()} className={`panel cursor-pointer p-8 transition ${isDragActive ? 'border-cyan-300 bg-cyan-950/30' : ''}`}>
        <input {...getInputProps()} />
        <div className="grid grid-cols-[1fr_auto] items-center gap-8">
          <div>
            <div className="mb-3 flex items-center gap-3 text-cyan-200"><UploadCloud size={28} /><span className="text-xl font-black">Drop private sources here</span></div>
            <p className="max-w-3xl text-sm text-slate-400">
              PDFs, DOCX, TXT/Markdown, images, scanned documents, audio, and MP4 transcripts are processed through the local extraction pipeline.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="metric"><FileText className="mx-auto mb-2 text-cyan-300" /><span className="mono text-xs">PDF/TXT/DOCX</span></div>
            <div className="metric"><ScanLine className="mx-auto mb-2 text-emerald-300" /><span className="mono text-xs">OCR scans</span></div>
            <div className="metric"><FileImage className="mx-auto mb-2 text-violet-300" /><span className="mono text-xs">images</span></div>
            <div className="metric"><FileAudio className="mx-auto mb-2 text-amber-300" /><span className="mono text-xs">audio</span></div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Pipeline Timeline</h2>
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{job.filename}</div>
                  <div className="mono text-xs text-slate-500">{job.file_type} / {job.status}</div>
                </div>
                <span className={job.status === 'ready' ? 'badge badge-green' : job.status === 'error' ? 'badge badge-red' : 'badge badge-amber'}>{job.progress}%</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {stageLabels.map((stage) => {
                  const stageData = job.stages?.find((item) => item.name === stage)
                  const complete = stageData?.status === 'complete'
                  const error = stageData?.status === 'error'
                  return (
                    <div key={stage} className={`rounded-md border p-2 text-center mono text-[10px] ${error ? 'border-rose-400/40 bg-rose-950/30 text-rose-200' : complete ? 'border-emerald-400/40 bg-emerald-950/30 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-500'}`}>
                      {stage.replace('_', ' ')}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!jobs.length && <p className="text-sm text-slate-500">No files have entered the pipeline yet.</p>}
        </div>
      </section>
    </div>
  )
}
