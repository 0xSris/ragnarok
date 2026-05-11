import { useQuery } from '@tanstack/react-query'
import { Brain, Clock3, FileSearch, GitCompare, ListChecks, LockKeyhole, Network, Send, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { listCollections, listModels, queryKB } from '../utils/api'
import { useStore } from '../store'

const queryModes = ['Ask', 'Summarize', 'Compare documents', 'Extract entities', 'Timeline', 'Contradictions', 'Study notes', 'Search exact sources']
const modeCards = [
  { mode: 'Summarize', label: 'Summarize', detail: 'Compress long sources into cited briefs.', icon: Sparkles },
  { mode: 'Compare documents', label: 'Compare', detail: 'Line up claims across files.', icon: GitCompare },
  { mode: 'Extract entities', label: 'Entities', detail: 'Pull people, places, dates, and terms.', icon: Network },
  { mode: 'Timeline', label: 'Timeline', detail: 'Build event order from your archive.', icon: Clock3 },
]

function uniqueByName(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.name}:${item.owner_id || 'public'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function ChatPage() {
  const { activeModel, setActiveModel } = useStore()
  const [collectionId, setCollectionId] = useState('')
  const [mode, setMode] = useState('Ask')
  const [input, setInput] = useState('')
  const [topK, setTopK] = useState(8)
  const [temperature, setTemperature] = useState(0.1)
  const [rerankerEnabled, setRerankerEnabled] = useState(true)
  const [messages, setMessages] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  const { data: collectionsData } = useQuery({ queryKey: ['collections'], queryFn: listCollections })
  const { data: modelsData } = useQuery({ queryKey: ['models'], queryFn: listModels })
  const collections = useMemo(() => uniqueByName(collectionsData?.collections || []), [collectionsData])
  const models = modelsData?.llm_models || modelsData?.models || ['llama3', 'mistral', 'phi3']

  const send = async () => {
    const query = input.trim()
    if (!query || loading) return
    setLoading(true)
    setInput('')
    setMessages((current) => [...current, { role: 'user', content: query }])
    try {
      const result = await queryKB({
        query,
        collection_id: collectionId || undefined,
        model: activeModel,
        top_k: topK,
        temperature,
        reranker_enabled: rerankerEnabled,
        mode,
      })
      setMessages((current) => [...current, { role: 'assistant', ...result }])
      setSelected(result)
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', answer: error.response?.data?.detail || 'Local query failed.' }])
    } finally {
      setLoading(false)
    }
  }

  const currentInspection = selected?.retrieval?.reranked || selected?.citations || []

  return (
    <div className="chat-shell">
      <section className="flex min-w-0 flex-col" style={{ borderRight: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <select className="field w-52" value={collectionId} onChange={(event) => setCollectionId(event.target.value)} title="Collection">
            <option value="">All collections</option>
            {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>
          <select className="field w-44" value={activeModel} onChange={(event) => setActiveModel(event.target.value)} title="Local model">
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
          <select className="field w-52" value={mode} onChange={(event) => setMode(event.target.value)} title="Query mode">
            {queryModes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <span className="badge badge-green"><ShieldCheck size={12} /> strict citations</span>
            <span className="badge badge-cyan"><ListChecks size={12} /> source audit</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="mx-auto max-w-4xl space-y-5">
            {!messages.length && (
              <div className="hero-panel chat-empty-panel panel">
                <div className="relative z-[1] mb-4 flex items-start gap-4">
                  <div className="brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                    <Brain size={22} />
                  </div>
                  <div>
                    <h1 className="page-title text-xl">Ask the local knowledge base</h1>
                    <p className="mt-1 max-w-2xl text-sm leading-6 soft">
                      Source-grounded answers with citations, scores, timing, and provenance.
                    </p>
                  </div>
                </div>
                <div className="relative z-[1] grid grid-cols-2 gap-3">
                  {modeCards.map(({ mode: cardMode, label, detail, icon: Icon }) => (
                    <button key={cardMode} className="mode-card" onClick={() => { setMode(cardMode); setInput(`${cardMode}: `) }}>
                      <span className="mode-icon"><Icon size={17} /></span>
                      <span>
                        <span className="block font-black">{label}</span>
                        <span className="mt-1 block text-xs soft">{detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'ml-auto max-w-2xl rounded-xl p-4 text-white' : 'panel p-4'} style={message.role === 'user' ? { background: 'var(--accent)' } : undefined}>
                {message.role === 'user' ? (
                  <p>{message.content}</p>
                ) : (
                  <>
                    <div className="prose max-w-none text-sm" style={{ color: 'var(--text)' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.answer || message.content}</ReactMarkdown>
                    </div>
                    {!!message.citations?.length && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {message.citations.map((citation) => (
                          <button key={citation.chunk_id} className="badge badge-cyan" onClick={() => setSelected(message)}>
                            {citation.filename} {citation.page ? `p.${citation.page}` : citation.timestamp || `chunk ${citation.chunk_index}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {loading && (
              <div className="subtle-panel max-w-lg p-4">
                <div className="scan-line mb-3" />
                <div className="mono text-sm" style={{ color: 'var(--accent-strong)' }}>Retrieving, reranking, and prompting the local model...</div>
              </div>
            )}
          </div>
        </div>

        <div className="composer-dock">
          <div className="composer-meta">
            <span className="badge badge-green"><LockKeyhole size={12} /> local query</span>
            <button className="quick-chip" onClick={() => setInput('Find contradictions: ')}>Contradictions</button>
            <button className="quick-chip" onClick={() => setInput('Search exact sources: ')}>Exact sources</button>
          </div>
          <div className="composer-panel mx-auto max-w-4xl">
            <textarea
              className="composer-textarea"
              placeholder="Ask RAGNAROK anything about your private knowledge base..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
            />
            <button className="btn-primary h-[44px] px-5" onClick={send} disabled={loading || !input.trim()}><Send size={18} /></button>
          </div>
        </div>
      </section>

      <aside className="inspector-pane flex min-h-0 flex-col" style={{ background: 'var(--surface-2)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-lg font-bold"><FileSearch size={18} /> Retrieval Inspector</div>
          <p className="mt-1 text-xs muted">Scores, citations, latency, and chunk previews after each query.</p>
        </div>
        <div className="space-y-4 overflow-auto p-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={15} /> Controls</div>
            <label className="mono text-xs muted">top-k {topK}</label>
            <input className="w-full" type="range" min="3" max="20" value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
            <label className="mono mt-3 block text-xs muted">temperature {temperature}</label>
            <input className="w-full" type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
            <label className="mt-3 flex items-center justify-between text-sm">
              <span>Reranker</span>
              <input type="checkbox" checked={rerankerEnabled} onChange={(event) => setRerankerEnabled(event.target.checked)} />
            </label>
          </div>

          {selected ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="metric"><div className="mono text-[10px] muted">total</div><div className="font-black">{selected.latency?.total_ms || 0}ms</div></div>
                <div className="metric"><div className="mono text-[10px] muted">retrieval</div><div className="font-black">{selected.latency?.retrieval_ms || 0}ms</div></div>
                <div className="metric"><div className="mono text-[10px] muted">confidence</div><div className="font-black">{selected.confidence || 0}</div></div>
              </div>
              {currentInspection.map((chunk, index) => (
                <div key={chunk.chunk_id || index} className="panel p-4">
                  <div className="mb-2 truncate text-sm font-bold">{chunk.filename}</div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="badge">sim {chunk.similarity_score}</span>
                    <span className="badge badge-green">rerank {chunk.reranker_score}</span>
                    <span className="badge">{chunk.page ? `page ${chunk.page}` : chunk.timestamp || `chunk ${chunk.chunk_index}`}</span>
                  </div>
                  <p className="text-xs leading-5 soft">{chunk.chunk_preview || chunk.chunk_text}</p>
                </div>
              ))}
            </>
          ) : (
            <div className="panel p-4">
              <div className="mb-3 flex items-center gap-2 font-bold"><Sparkles size={16} /> Waiting for a mission</div>
              <p className="text-sm leading-6 soft">Ask a question and this panel becomes the evidence board: top chunks, reranker scores, page refs, and timing.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
