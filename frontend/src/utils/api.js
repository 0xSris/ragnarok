import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120_000,
})

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  try {
    const stored = JSON.parse(localStorage.getItem('ragnarok-store') || '{}')
    const token = stored?.state?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {}
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ragnarok-store')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)
export const register = (data) =>
  api.post('/auth/register', data).then((r) => r.data)
export const getMe = () => api.get('/auth/me').then((r) => r.data)

// ── Documents ──
export const uploadDocuments = (files, collectionId, tags = '[]') => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  return api
    .post(`/documents/upload?collection_id=${collectionId}&tags=${tags}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}
export const listDocuments = (params) =>
  api.get('/documents/', { params }).then((r) => r.data)
export const deleteDocument = (id) =>
  api.delete(`/documents/${id}`).then((r) => r.data)
export const getDocument = (id) =>
  api.get(`/documents/${id}`).then((r) => r.data)
export const retagDocument = (id, tags) =>
  api.post(`/documents/${id}/retag`, tags).then((r) => r.data)

// ── Collections ──
export const listCollections = () =>
  api.get('/collections/').then((r) => r.data)
export const createCollection = (data) =>
  api.post('/collections/', data).then((r) => r.data)
export const deleteCollection = (id) =>
  api.delete(`/collections/${id}`).then((r) => r.data)

// ── Query ──
export const queryKB = (data) =>
  api.post('/query/', data).then((r) => r.data)
export const transcribeAudio = (blob) => {
  const form = new FormData()
  form.append('file', blob, 'audio.wav')
  return api
    .post('/query/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}

// ── History ──
export const getHistory = (params) =>
  api.get('/history/', { params }).then((r) => r.data)
export const deleteHistory = (id) =>
  api.delete(`/history/${id}`).then((r) => r.data)
export const clearHistory = () =>
  api.delete('/history/').then((r) => r.data)
export const submitFeedback = (id, rating, comment) =>
  api.post(`/query/${id}/feedback`, { rating, comment }).then((r) => r.data)

// ── Eval ──
export const createEval = (data) =>
  api.post('/eval/', data).then((r) => r.data)
export const listEvals = () =>
  api.get('/eval/').then((r) => r.data)
export const getEval = (id) =>
  api.get(`/eval/${id}`).then((r) => r.data)
export const getEvalDashboard = () =>
  api.get('/eval/dashboard/stats').then((r) => r.data)

// ── Export ──
export const exportAnswers = (queryIds, format) =>
  api.post('/export/', { query_ids: queryIds, format }, { responseType: 'blob' })

// ── Models ──
export const listModels = () =>
  api.get('/models').then((r) => r.data)

// ── Health ──
export const checkHealth = () =>
  api.get('/health').then((r) => r.data)

// ── SSE streaming helper ──
export function streamQuery(payload, onToken, onSources, onDone, onError) {
  const stored = JSON.parse(localStorage.getItem('ragnarok-store') || '{}')
  const token = stored?.state?.token

  const evtSource = new EventSource(
    `/api/query/stream?_t=${Date.now()}`,
    { withCredentials: false }
  )

  // EventSource doesn't support POST natively — use fetch + ReadableStream
  evtSource.close()

  const controller = new AbortController()

  fetch('/api/query/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') onToken(data.token)
            else if (data.type === 'sources') onSources(data.sources)
            else if (data.type === 'done') onDone(data.query_id)
          } catch {}
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err)
  })

  return () => controller.abort()
}
