import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Theme ──
      darkMode: false,
      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        document.documentElement.classList.toggle('dark', next)
      },

      // ── Auth ──
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),

      // ── Active collection ──
      activeCollection: null,
      setActiveCollection: (col) => set({ activeCollection: col }),

      // ── Active model ──
      activeModel: 'llama3',
      setActiveModel: (m) => set({ activeModel: m }),

      // ── Chat sessions ──
      chatSessions: [],
      activeChatId: null,
      addChatSession: (session) =>
        set((s) => ({ chatSessions: [session, ...s.chatSessions] })),
      setActiveChatId: (id) => set({ activeChatId: id }),
      updateChatSession: (id, updates) =>
        set((s) => ({
          chatSessions: s.chatSessions.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      removeChatSession: (id) =>
        set((s) => ({
          chatSessions: s.chatSessions.filter((c) => c.id !== id),
          activeChatId: s.activeChatId === id ? null : s.activeChatId,
        })),

      // ── Sidebar ──
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      // ── Focus Mode ──
      focusMode: false,
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

      // ── Upload queue ──
      uploadQueue: [],
      addToUploadQueue: (item) =>
        set((s) => ({ uploadQueue: [...s.uploadQueue, item] })),
      updateUploadItem: (id, updates) =>
        set((s) => ({
          uploadQueue: s.uploadQueue.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      clearUploadQueue: () => set({ uploadQueue: [] }),
    }),
    {
      name: 'ragnarok-store',
      partialize: (s) => ({
        darkMode: s.darkMode,
        token: s.token,
        user: s.user,
        activeModel: s.activeModel,
        activeCollection: s.activeCollection,
      }),
    }
  )
)

// Initialize dark mode on load
const stored = JSON.parse(localStorage.getItem('ragnarok-store') || '{}')
if (stored?.state?.darkMode) {
  document.documentElement.classList.add('dark')
}
