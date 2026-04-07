import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Plus, Trash2, ChevronDown, Cpu, ThumbsUp, ThumbsDown, Copy, Download, Sparkles, Mic, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '../store'
import { streamQuery, submitFeedback, listCollections, listModels, transcribeAudio } from '../utils/api'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import MascotChat from '../components/mascot/MascotChat'
import SourcePanel from '../components/chat/SourcePanel'
import ModelSelector from '../components/chat/ModelSelector'
import TypingIndicator from '../components/TypingIndicator'
import clsx from 'clsx'

let msgIdCounter = 0
const newId = () => `msg-${++msgIdCounter}-${Date.now()}`

const SUGGESTED = [
  "Summarize all uploaded documents",
  "What are the key findings in my research files?",
  "Find all mentions of contracts or agreements",
  "Compare the main topics across documents",
]

export default function ChatPage() {
  const { activeCollection, activeModel, setActiveModel } = useStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mascotState, setMascotState] = useState('idle')
  const [selectedSources, setSelectedSources] = useState(null)
  const [collectionId, setCollectionId] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  })
  const collections = collectionsData?.collections || []

  const { data: modelsData } = useQuery({
    queryKey: ['models'],
    queryFn: listModels,
  })
  const models = modelsData?.models || ['llama3']

  useEffect(() => {
    if (!collectionId && collections.length > 0) {
      setCollectionId(collections[0].id)
    }
  }, [collections])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text) => {
      const query = (text || input).trim()
      if (!query || streaming) return
      setInput('')

      const userMsgId = newId()
      const aiMsgId = newId()

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: query },
        { id: aiMsgId, role: 'assistant', content: '', sources: [], streaming: true },
      ])
      setStreaming(true)
      setMascotState('thinking')

      let fullContent = ''

      const abort = streamQuery(
        {
          query,
          collection_id: collectionId,
          model: activeModel,
          stream: true,
        },
        (token) => {
          fullContent += token
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: fullContent } : m
            )
          )
        },
        (sources) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, sources } : m
            )
          )
        },
        (queryId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, streaming: false, queryId } : m
            )
          )
          setStreaming(false)
          setMascotState('success')
          setTimeout(() => setMascotState('idle'), 3000)
        },
        (err) => {
          console.error(err)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: '❌ Error reaching the AI. Is Ollama running?', streaming: false }
                : m
            )
          )
          setStreaming(false)
          setMascotState('error')
          setTimeout(() => setMascotState('idle'), 3000)
        }
      )
      abortRef.current = abort
    },
    [input, streaming, collectionId, activeModel]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    if (streaming && abortRef.current) abortRef.current()
    setMessages([])
    setStreaming(false)
    setMascotState('idle')
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        try {
          const { text } = await transcribeAudio(blob)
          setInput((prev) => prev + text)
          toast.success('Voice transcribed!')
        } catch (err) {
          toast.error('Transcription failed')
        }
        setRecording(false)
        setMascotState('idle')
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorderRef.current.start()
      setRecording(true)
      setMascotState('listening')
    } catch (err) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }

  const copyMsg = (content) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied!')
  }

  const speakMsg = (content) => {
    const utterance = new SpeechSynthesisUtterance(content)
    speechSynthesis.speak(utterance)
  }

  const handleFeedback = async (queryId, rating) => {
    if (!queryId) return
    try {
      await submitFeedback(queryId, rating)
      toast.success(rating >= 4 ? 'Great, thanks! 👍' : 'Thanks for the feedback!')
    } catch { }
  }

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          {/* Collection picker */}
          <div className="relative">
            <select
              value={collectionId || ''}
              onChange={(e) => setCollectionId(e.target.value)}
              className="rag-input py-1.5 pr-8 text-sm w-44 appearance-none cursor-pointer"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>

          <ModelSelector models={models} value={activeModel} onChange={setActiveModel} />

          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-400 border-red-200 dark:border-red-900"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {/* Mascot */}
              <MascotChat state={mascotState} visible={true} message="Ask me anything about your docs! 🧠" />

              {/* Suggested prompts */}
              <div className="w-full max-w-xl">
                <p className="text-center text-xs font-bold mb-3 opacity-50 uppercase tracking-wider">
                  Suggested Queries
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUGGESTED.map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => sendMessage(s)}
                      className="card-cartoon p-3 text-left text-sm font-semibold flex items-start gap-2"
                    >
                      <Sparkles size={14} className="mt-0.5 text-purple-400 shrink-0" />
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-2xl shrink-0 flex items-center justify-center text-sm mt-1 bg-accent text-white">
                    🧠
                  </div>
                )}

                <div className={`max-w-[75%] space-y-2`}>
                  <div className={clsx(
                    'px-4 py-3 text-sm',
                    msg.role === 'user' ? 'bubble-user font-semibold' : 'bubble-ai'
                  )}>
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <>
                        {msg.content ? (
                          <div className="prose-rag">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                            {msg.streaming && <span className="typing-cursor" />}
                          </div>
                        ) : (
                          <TypingIndicator />
                        )}
                      </>
                    )}
                  </div>

                  {/* Sources */}
                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedSources(msg.sources)}
                          className="source-badge"
                        >
                          📄 {src.filename || `Source ${src.index}`}
                          {src.page > 0 && <span className="opacity-70">p.{src.page}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {msg.role === 'assistant' && !msg.streaming && msg.content && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => speakMsg(msg.content)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100">
                        <Volume2 size={13} />
                      </button>
                      <button onClick={() => copyMsg(msg.content)}
                        className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100">
                        <Copy size={13} />
                      </button>
                      {msg.queryId && (
                        <>
                          <button
                            onClick={() => handleFeedback(msg.queryId, 5)}
                            className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors opacity-60 hover:opacity-100 text-green-500">
                            <ThumbsUp size={13} />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.queryId, 1)}
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors opacity-60 hover:opacity-100 text-red-400">
                            <ThumbsDown size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-2xl shrink-0 flex items-center justify-center text-sm font-bold text-white bg-accent mt-1">
                    U
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Mascot during streaming */}
          {streaming && (
            <div className="flex justify-center">
              <MascotChat state="thinking" visible={true} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 pb-5 pt-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your documents… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={streaming}
                className="rag-input resize-none max-h-32 overflow-y-auto pr-12"
                style={{ minHeight: '48px', paddingTop: '12px', paddingBottom: '12px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>
            <motion.button
              onClick={recording ? stopRecording : startRecording}
              disabled={streaming}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              className={clsx(
                "px-4 py-3 shrink-0 rounded-xl border-2 transition-colors",
                recording
                  ? "bg-red-500 border-red-500 text-white animate-pulse"
                  : "border-accent text-accent hover:bg-accent hover:text-white"
              )}
            >
              <Mic size={18} />
            </motion.button>
            <motion.button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              className="btn-glow px-5 py-3 shrink-0 disabled:opacity-40"
            >
              <Send size={18} />
            </motion.button>
          </div>
          <p className="text-center text-xs mt-2 opacity-40 font-semibold">
            Running on {activeModel} · All processing is local · Zero cloud dependency
          </p>
        </div>
      </div>

      {/* Source panel */}
      <SourcePanel sources={selectedSources} onClose={() => setSelectedSources(null)} />
    </div>
  )
}
