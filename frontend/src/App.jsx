import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import IngestPage from './pages/IngestPage'
import HistoryPage from './pages/HistoryPage'
import EvalPage from './pages/EvalPage'
import CollectionsPage from './pages/CollectionsPage'
import SettingsPage from './pages/SettingsPage'
import DocumentViewerPage from './pages/DocumentViewerPage'

function ProtectedRoute({ children }) {
  const token = useStore((state) => state.token)
  if (!token) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const darkMode = useStore((state) => state.darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <Routes>
      <Route path="/auth" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/ingest" element={<IngestPage />} />
                <Route path="/library" element={<DocumentsPage />} />
                <Route path="/documents" element={<Navigate to="/library" replace />} />
                <Route path="/documents/:id" element={<DocumentViewerPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/evals" element={<EvalPage />} />
                <Route path="/eval" element={<Navigate to="/evals" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
