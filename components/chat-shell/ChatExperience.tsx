"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { HARD_CODED_USERS } from '@/lib/constants/users'
import type { AiAssistantProfile, AzureChatCredentials, ChatThreadMode, PresenceStatus } from '@/lib/types/chat'

import ConversationSurface from './ConversationSurface'
import SidebarPanel, { type ContactListItem } from './SidebarPanel'
import { initials, presenceColor } from './uiHelpers'

const AUTH_STORAGE_KEY = 'mesh.dm.user'
const ASSISTANT_ACCENT = '#F472B6'
const CHAT_CONFIG_CACHE_TTL_MS = 15 * 60 * 1000

type SerializableUser = {
  id: string
  displayName: string
  role: 'human' | 'assistant'
  accentColor: string
  externalId?: string
  presence: PresenceStatus
  createdAt: string
  lastSeenAt: string
}

type SerializableThread = {
  id: string
  acsThreadId: string
  mode: ChatThreadMode
  topic: string
  participantIds: string[]
  createdAt: string
  lastActivityAt: string
  lastMessagePreview?: string
  unreadCount?: number
}

type Props = {
  initialUsers: SerializableUser[]
  assistant: AiAssistantProfile
}

export default function ChatExperience({ initialUsers, assistant }: Props) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [threads, setThreads] = useState<SerializableThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [chatConfig, setChatConfig] = useState<AzureChatCredentials | null>(null)
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedContactId, setFocusedContactId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopView, setIsDesktopView] = useState(false)
  const configCacheRef = useRef(new Map<string, { config: AzureChatCredentials; fetchedAt: number }>())

  const rememberConfig = useCallback((threadId: string, config: AzureChatCredentials) => {
    configCacheRef.current.set(threadId, { config, fetchedAt: Date.now() })
  }, [])

  const clearConfigCache = useCallback(() => {
    configCacheRef.current.clear()
  }, [])

  const activeUserProfile = useMemo(
    () => initialUsers.find((user) => user.id === activeUserId) ?? null,
    [initialUsers, activeUserId]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored && initialUsers.some((user) => user.id === stored)) {
      setActiveUserId(stored)
    }
    setAuthBootstrapped(true)
  }, [initialUsers])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = () => {
      const desktop = mediaQuery.matches
      setIsDesktopView(desktop)
      if (desktop) {
        setSidebarOpen((current) => (current ? current : true))
      } else {
        setSidebarOpen(false)
      }
    }
    syncSidebar()
    mediaQuery.addEventListener('change', syncSidebar)
    return () => mediaQuery.removeEventListener('change', syncSidebar)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => !current)
  }, [])

  const closeSidebarOnMobile = useCallback(() => {
    if (!isDesktopView) {
      setSidebarOpen(false)
    }
  }, [isDesktopView])

  const handleThreadSelection = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    setError(null)
    if (!threadId) {
      setChatConfig(null)
      setLoadingConfig(false)
      return
    }
    const cached = configCacheRef.current.get(threadId)
    if (cached && Date.now() - cached.fetchedAt < CHAT_CONFIG_CACHE_TTL_MS) {
      setChatConfig(cached.config)
      setLoadingConfig(false)
      return
    }
    setChatConfig(null)
    setLoadingConfig(true)
  }, [])

  useEffect(() => {
    if (!activeUserId) {
      setThreads([])
      setSelectedThreadId(null)
      setChatConfig(null)
      setFocusedContactId(null)
      setLoadingThreads(false)
      return
    }

    setLoadingThreads(true)
    const controller = new AbortController()

    fetch(`/api/users/${activeUserId}/threads`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load threads')
        }
        const payload = (await response.json()) as { threads: SerializableThread[] }
        setThreads(payload.threads)
        if (!payload.threads.length) {
          handleThreadSelection(null)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to load conversations')
        setThreads([])
        handleThreadSelection(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingThreads(false)
        }
      })

    return () => controller.abort()
  }, [activeUserId, handleThreadSelection])

  useEffect(() => {
    if (!activeUserId || !selectedThreadId) {
      return
    }

    const cached = configCacheRef.current.get(selectedThreadId)
    if (cached && Date.now() - cached.fetchedAt < CHAT_CONFIG_CACHE_TTL_MS) {
      return
    }

    const controller = new AbortController()
    const targetThreadId = selectedThreadId

    fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activeUserId, threadId: targetThreadId }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Unable to initialize chat adapter')
        }
        const payload = (await response.json()) as { config: AzureChatCredentials }
        rememberConfig(targetThreadId, payload.config)
        setChatConfig(payload.config)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to initialize chat adapter')
        setChatConfig(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingConfig(false)
        }
      })

    return () => controller.abort()
  }, [activeUserId, selectedThreadId, rememberConfig])

  useEffect(() => {
    if (!selectedThreadId || !activeUserId) return
    const thread = threads.find((item) => item.id === selectedThreadId)
    if (!thread) return
    const peerId = thread.participantIds.find((id) => id !== activeUserId) ?? assistant.id
    setFocusedContactId(peerId)
  }, [selectedThreadId, threads, activeUserId, assistant.id])

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  )

  const contactThreadLookup = useMemo(() => {
    const map = new Map<string, SerializableThread>()
    if (!activeUserId) return map
    threads.forEach((thread) => {
      if (!thread.participantIds.includes(activeUserId)) return
      const peerId = thread.participantIds.find((id) => id !== activeUserId)
      if (peerId) {
        map.set(peerId, thread)
      }
    })
    return map
  }, [threads, activeUserId])

  const contactDirectory = useMemo(
    () => initialUsers.filter((user) => user.role === 'human'),
    [initialUsers]
  )

  const contacts = useMemo<ContactListItem[]>(() => {
    const aiThread = contactThreadLookup.get(assistant.id)
    const aiContact: ContactListItem = {
      id: assistant.id,
      displayName: assistant.displayName,
      description: assistant.tagline,
      accentColor: ASSISTANT_ACCENT,
      presence: 'online',
      role: 'assistant',
      lastMessagePreview: aiThread?.lastMessagePreview,
      lastActivityAt: aiThread?.lastActivityAt,
      unreadCount: aiThread?.unreadCount ?? 0
    }

    const humanContacts = contactDirectory.map((user) => {
      const thread = contactThreadLookup.get(user.id)
      return {
        id: user.id,
        displayName: user.displayName,
        description: user.id === 'guest' ? 'Shared profile' : 'Mesh member',
        accentColor: user.accentColor,
        presence: user.presence,
        role: 'human' as const,
        disabled: user.id === activeUserId,
        isSelf: user.id === activeUserId,
        lastMessagePreview: thread?.lastMessagePreview,
        lastActivityAt: thread?.lastActivityAt,
        unreadCount: thread?.unreadCount ?? 0
      }
    })

    return [aiContact, ...humanContacts]
  }, [assistant, contactDirectory, contactThreadLookup, activeUserId])

  const upsertThread = useCallback((thread: SerializableThread) => {
    setThreads((current) => {
      const index = current.findIndex((item) => item.id === thread.id)
      if (index >= 0) {
        const clone = current.slice()
        clone[index] = thread
        return clone
      }
      return [thread, ...current]
    })
    setLoadingThreads(false)
  }, [])

  const handleContactPress = useCallback(
    async (contactId: string, role: 'assistant' | 'human') => {
      if (!activeUserId) return
      if (role === 'human' && contactId === activeUserId) return
      setFocusedContactId(contactId)
      setError(null)
      setLoadingThreads(true)
      try {
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            role === 'assistant'
              ? { initiatorId: activeUserId, mode: 'ai' }
              : { initiatorId: activeUserId, peerId: contactId, mode: 'user' }
          )
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Unable to start conversation')
        }
        const payload = (await response.json()) as { thread: SerializableThread; config?: AzureChatCredentials }
        upsertThread(payload.thread)
        if (payload.config) {
          rememberConfig(payload.thread.id, payload.config)
        }
        handleThreadSelection(payload.thread.id)
        closeSidebarOnMobile()
      } catch (err) {
        setFocusedContactId(null)
        setError(err instanceof Error ? err.message : 'Unable to start conversation')
        setLoadingThreads(false)
      }
    },
    [activeUserId, closeSidebarOnMobile, handleThreadSelection, rememberConfig, upsertThread]
  )

  const handleSignOut = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
    clearConfigCache()
    setActiveUserId(null)
    setThreads([])
    setSelectedThreadId(null)
    setChatConfig(null)
    setFocusedContactId(null)
    setLoadingConfig(false)
  }, [clearConfigCache])

  const handleProfileSelect = useCallback(
    async (userId: string) => {
      const match = HARD_CODED_USERS.find((user) => user.id === userId)
      if (!match) {
        throw new Error('Profile not found')
      }
      clearConfigCache()
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_STORAGE_KEY, match.id)
      }
      setActiveUserId(match.id)
      setLoadingThreads(true)
    },
    [clearConfigCache]
  )

  const showAuthModal = authBootstrapped && !activeUserId

  return (
    <>
      <AuthModal open={showAuthModal} onSelectUser={handleProfileSelect} />
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 lg:right-8 lg:top-6">
        <button
          type="button"
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? 'Hide contacts panel' : 'Show contacts panel'}
          onClick={toggleSidebar}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-100 shadow-xl backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            {sidebarOpen ? (
              <path d="M7 6h4v12H7zM13 6h4v12h-4z" fill="currentColor" opacity="0.9" />
            ) : (
              <path
                d="M6 7h5v10H6zM13 7h5v10h-5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
        <span
          className={`hidden rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white shadow-lg transition duration-200 lg:inline-flex ${
            sidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
          }`}
        >
          {sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        </span>
      </div>
      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6">
        <SidebarPanel
          open={sidebarOpen}
          activeProfile={activeUserProfile}
          contacts={contacts}
          focusedContactId={focusedContactId}
          contactsDisabled={!activeUserId || loadingThreads}
          loadingThreads={loadingThreads}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onContactPress={handleContactPress}
          onThreadSelect={(threadId) => {
            handleThreadSelection(threadId)
            closeSidebarOnMobile()
          }}
          onSignOut={handleSignOut}
          onCloseMobile={closeSidebarOnMobile}
        />
        <div className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col gap-4 overflow-hidden rounded-3xl bg-slate-950/50 p-4 shadow-2xl ring-1 ring-slate-900/40 sm:p-6">
          {error ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          {activeThread && chatConfig && activeUserId ? (
            <ConversationSurface
              config={chatConfig}
              threadId={activeThread.id}
              mode={activeThread.mode}
              userId={activeUserId}
              phoneNumber={activeUserProfile?.externalId ?? null}
            />
          ) : (
            <EmptyState loggedIn={Boolean(activeUserId)} loading={loadingThreads || loadingConfig} />
          )}
        </div>
      </section>
    </>
  )
}

type EmptyStateProps = {
  loggedIn: boolean
  loading: boolean
}

function EmptyState({ loggedIn, loading }: EmptyStateProps) {
  if (!loggedIn) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/70 text-center">
        <p className="text-lg font-semibold text-white">Sign in to start chatting</p>
        <p className="mt-2 text-sm text-slate-400">Use one of the pilot profiles to unlock the contact list.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-800/70 text-center text-slate-300">
        <p className="text-base font-semibold">Preparing your conversation…</p>
        <p className="text-sm text-slate-500">ACS chat adapter is initializing.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/70 text-center text-slate-300">
      <p className="text-base font-semibold">No thread selected</p>
      <p className="mt-2 text-sm text-slate-500">Tap a contact or recent chat to open the message view.</p>
    </div>
  )
}

type AuthModalProps = {
  open: boolean
  onSelectUser: (userId: string) => Promise<void> | void
}

function AuthModal({ open, onSelectUser }: AuthModalProps) {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (userId: string) => {
    if (pendingUserId) {
      return
    }
    setError(null)
    setPendingUserId(userId)
    try {
      await onSelectUser(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
      setPendingUserId(null)
      return
    }
    setPendingUserId(null)
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-white">Choose your profile</h1>
        <p className="mt-2 text-sm text-slate-400">Pick one of the demo accounts to jump right into the chat experience.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {HARD_CODED_USERS.map((user) => {
            const isPending = pendingUserId === user.id
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                disabled={Boolean(pendingUserId) && !isPending}
                className={`flex flex-col gap-4 rounded-3xl border px-4 py-4 text-left transition ${
                  isPending ? 'border-white/70 bg-white/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                } disabled:opacity-60`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-semibold text-slate-950"
                    style={{ background: user.accentColor }}
                  >
                    {initials(user.displayName)}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{user.displayName}</p>
                    <p className="text-xs text-slate-400">
                      <span className={`mr-2 inline-flex h-2 w-2 rounded-full ${presenceColor(user.presence)}`} />
                      {user.id === 'guest' ? 'Guest access' : 'Mesh member'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>{user.id === 'guest' ? 'Shared device friendly' : 'Personal profile'}</span>
                  <span>{isPending ? 'Connecting…' : 'Sign in'}</span>
                </div>
              </button>
            )
          })}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <p className="mt-6 text-xs text-slate-500">You can switch accounts anytime from the sidebar.</p>
      </div>
    </div>
  )
}
