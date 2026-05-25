'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, FeedbackMessage } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Thread = {
  user_id: string
  lastMessage: string
  lastTime: string
  unread: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  } catch { return '' }
}

function formatBubbleTime(iso: string) {
  try {
    const d = new Date(iso.slice(0, 19))
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [allMessages, setAllMessages] = useState<FeedbackMessage[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<FeedbackMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch all messages ────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const { data } = await supabase
      .from('feedback_messages')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) {
      setAllMessages(data)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 4000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // ── Build thread list from all messages ───────────────────────────────────
  useEffect(() => {
    const map = new Map<string, Thread>()
    for (const msg of allMessages) {
      const existing = map.get(msg.user_id)
      const isNewer = !existing || msg.created_at > existing.lastTime
      if (isNewer) {
        map.set(msg.user_id, {
          user_id: msg.user_id,
          lastMessage: msg.message,
          lastTime: msg.created_at,
          unread: 0,
        })
      }
    }
    // count unread (user messages with no dev reply after them)
    for (const [uid, thread] of map) {
      const userMsgs = allMessages.filter(m => m.user_id === uid && !m.is_developer)
      const devMsgs = allMessages.filter(m => m.user_id === uid && m.is_developer)
      const lastDevTime = devMsgs.length ? devMsgs[devMsgs.length - 1].created_at : ''
      const unread = userMsgs.filter(m => m.created_at > lastDevTime).length
      map.set(uid, { ...thread, unread })
    }
    const sorted = Array.from(map.values()).sort((a, b) =>
      b.lastTime.localeCompare(a.lastTime)
    )
    setThreads(sorted)
  }, [allMessages])

  // ── Update chat panel when selected user changes ──────────────────────────
  useEffect(() => {
    if (!selectedUser) return
    const msgs = allMessages.filter(m => m.user_id === selectedUser)
    setChatMessages(msgs)
  }, [selectedUser, allMessages])

  // ── Scroll to bottom when chat updates ───────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Send a reply ──────────────────────────────────────────────────────────
  async function sendReply() {
    const text = inputText.trim()
    if (!text || !selectedUser || sending) return
    setSending(true)
    setInputText('')
    await supabase.from('feedback_messages').insert({
      user_id: selectedUser,
      message: text,
      is_developer: true,
    })
    await fetchAll()
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendReply()
    }
  }

  const filteredThreads = threads.filter(t =>
    search === '' || t.user_id.toLowerCase().includes(search.toLowerCase()) ||
    t.lastMessage.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0)

  return (
    <div style={S.root}>
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div style={S.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{ ...S.sidebar, ...(sidebarOpen ? S.sidebarOpen : {}) }}>
        {/* Logo */}
        <div style={S.logoArea}>
          <span style={S.logoIcon}>🐧</span>
          <div>
            <div style={S.logoTitle}>ESKWELA</div>
            <div style={S.logoSub}>Developer Console</div>
          </div>
          {totalUnread > 0 && (
            <span style={S.totalBadge}>{totalUnread}</span>
          )}
        </div>

        {/* Search */}
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>🔍</span>
          <input
            style={S.searchInput}
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Stats row */}
        <div style={S.statsRow}>
          <div style={S.statPill}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>{threads.length}</span>
            <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>users</span>
          </div>
          <div style={S.statPill}>
            <span style={{ color: '#4db6ac', fontWeight: 600 }}>{allMessages.length}</span>
            <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>messages</span>
          </div>
        </div>

        {/* Thread list */}
        <div style={S.threadList}>
          {loading ? (
            <div style={S.emptyState}>Loading…</div>
          ) : filteredThreads.length === 0 ? (
            <div style={S.emptyState}>No conversations yet.</div>
          ) : (
            filteredThreads.map(thread => (
              <button
                key={thread.user_id}
                style={{
                  ...S.threadItem,
                  ...(selectedUser === thread.user_id ? S.threadItemActive : {}),
                }}
                onClick={() => {
                  setSelectedUser(thread.user_id)
                  setSidebarOpen(false)
                }}
              >
                <div style={S.threadAvatar}>
                  {shortId(thread.user_id).slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.threadTop}>
                    <span style={S.threadName}>User {shortId(thread.user_id)}</span>
                    <span style={S.threadTime}>{formatTime(thread.lastTime)}</span>
                  </div>
                  <div style={S.threadPreview}>{thread.lastMessage}</div>
                </div>
                {thread.unread > 0 && (
                  <span style={S.unreadBadge}>{thread.unread}</span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ──────────────────────────────────────────────── */}
      <main style={S.main}>
        {!selectedUser ? (
          // ── Empty state ────────────────────────────────────────────────
          <div style={S.emptyChat}>
            <div style={S.emptyChatIcon}>🛠️</div>
            <div style={S.emptyChatTitle}>Select a conversation</div>
            <div style={S.emptyChatSub}>
              Choose a user from the sidebar to start replying.
            </div>
            <button style={S.mobileOpenBtn} onClick={() => setSidebarOpen(true)}>
              View conversations
            </button>
          </div>
        ) : (
          <>
            {/* ── Chat header ──────────────────────────────────────────── */}
            <header style={S.chatHeader}>
              <button style={S.backBtn} onClick={() => setSidebarOpen(true)}>
                ←
              </button>
              <div style={S.chatHeaderAvatar}>
                {shortId(selectedUser).slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.chatHeaderName}>User {shortId(selectedUser)}</div>
                <div style={S.chatHeaderId}>{selectedUser}</div>
              </div>
              <div style={S.onlineChip}>
                <span style={S.onlineDot} />
                Active
              </div>
            </header>

            {/* ── Messages ─────────────────────────────────────────────── */}
            <div style={S.messageArea}>
              {chatMessages.length === 0 ? (
                <div style={S.noMessages}>No messages yet in this thread.</div>
              ) : (
                chatMessages.map(msg => {
                  const isDev = msg.is_developer
                  return (
                    <div
                      key={msg.id}
                      style={{
                        ...S.bubbleRow,
                        justifyContent: isDev ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!isDev && (
                        <div style={S.bubbleAvatar}>
                          {shortId(msg.user_id).slice(0, 2)}
                        </div>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        {!isDev && (
                          <div style={S.bubbleName}>
                            User {shortId(msg.user_id)}
                          </div>
                        )}
                        <div
                          style={{
                            ...S.bubble,
                            ...(isDev ? S.bubbleDev : S.bubbleUser),
                          }}
                        >
                          {msg.message}
                        </div>
                        <div
                          style={{
                            ...S.bubbleTime,
                            textAlign: isDev ? 'right' : 'left',
                          }}
                        >
                          {isDev && <span style={{ color: 'var(--blue-light)', marginRight: 4 }}>You ·</span>}
                          {formatBubbleTime(msg.created_at)}
                        </div>
                      </div>
                      {isDev && (
                        <div style={{ ...S.bubbleAvatar, background: 'var(--blue-brand)' }}>
                          🛠
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ────────────────────────────────────────────── */}
            <div style={S.inputBar}>
              <div style={S.inputWrap}>
                <textarea
                  ref={inputRef}
                  style={S.textarea}
                  placeholder="Reply as developer…"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <div style={S.inputHint}>Enter to send · Shift+Enter for new line</div>
              </div>
              <button
                style={{
                  ...S.sendBtn,
                  opacity: inputText.trim() ? 1 : 0.4,
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                }}
                onClick={sendReply}
                disabled={!inputText.trim() || sending}
              >
                {sending ? '…' : '↑'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--navy-deepest)',
    position: 'relative',
  },

  // Sidebar
  overlay: {
    display: 'none',
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 9,
    // shown via media query in CSS (we use a hidden class trick below)
  },
  sidebar: {
    width: 'var(--sidebar-w)',
    minWidth: 'var(--sidebar-w)',
    height: '100vh',
    background: 'var(--navy-deep)',
    borderRight: '1px solid var(--navy-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarOpen: {
    position: 'fixed',
    top: 0, left: 0,
    zIndex: 10,
    height: '100vh',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '22px 18px 16px',
    borderBottom: '1px solid var(--navy-border)',
  },
  logoIcon: { fontSize: 28 },
  logoTitle: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: '0.12em',
    color: 'var(--white)',
  },
  logoSub: {
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: '0.04em',
  },
  totalBadge: {
    marginLeft: 'auto',
    background: 'var(--blue-brand)',
    color: 'var(--white)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '12px 14px 8px',
    background: 'var(--navy-mid)',
    borderRadius: 10,
    padding: '8px 12px',
    border: '1px solid var(--navy-border)',
  },
  searchIcon: { fontSize: 13, opacity: 0.5 },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--white)',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    padding: '0 14px 10px',
  },
  statPill: {
    background: 'var(--navy-mid)',
    borderRadius: 8,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--navy-border)',
  },
  threadList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    padding: '40px 20px',
    fontSize: 13,
  },
  threadItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 10,
    padding: '10px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--white)',
    transition: 'background 0.15s',
    marginBottom: 2,
  },
  threadItemActive: {
    background: 'var(--navy-card)',
    borderLeft: '3px solid var(--blue-brand)',
    paddingLeft: 7,
  },
  threadAvatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'var(--navy-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.05em',
    flexShrink: 0,
    color: 'var(--white-60)',
  },
  threadTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  threadName: { fontWeight: 600, fontSize: 13, color: 'var(--white)' },
  threadTime: { fontSize: 11, color: 'var(--text-dim)' },
  threadPreview: {
    fontSize: 12,
    color: 'var(--text-dim)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 170,
  },
  unreadBadge: {
    background: 'var(--blue-brand)',
    color: 'var(--white)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 7px',
    flexShrink: 0,
  },

  // Main area
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--navy-deepest)',
  },

  // Empty state
  emptyChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  emptyChatIcon: { fontSize: 52 },
  emptyChatTitle: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: 20,
    color: 'var(--white)',
  },
  emptyChatSub: {
    fontSize: 14,
    color: 'var(--text-dim)',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 1.7,
  },
  mobileOpenBtn: {
    marginTop: 8,
    background: 'var(--blue-brand)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--white)',
    padding: '10px 24px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    display: 'none', // shown via media query approach — JS fallback: always show
  },

  // Chat header
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid var(--navy-border)',
    background: 'var(--navy-deep)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'var(--white-08)',
    border: 'none',
    borderRadius: 8,
    color: 'var(--white)',
    fontSize: 18,
    width: 34,
    height: 34,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--navy-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--white-60)',
    flexShrink: 0,
  },
  chatHeaderName: {
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--white)',
    fontFamily: 'Syne, sans-serif',
  },
  chatHeaderId: {
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  onlineChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(76,175,80,0.15)',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    color: 'var(--green)',
    fontWeight: 600,
    flexShrink: 0,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--green)',
    display: 'inline-block',
  },

  // Messages
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  noMessages: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    marginTop: 60,
    fontSize: 13,
  },
  bubbleRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--navy-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--white-60)',
    flexShrink: 0,
  },
  bubbleName: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginBottom: 3,
    paddingLeft: 4,
    fontWeight: 600,
  },
  bubble: {
    borderRadius: 16,
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  bubbleUser: {
    background: 'var(--navy-card)',
    color: 'var(--white)',
    borderTopLeftRadius: 4,
  },
  bubbleDev: {
    background: 'var(--blue-brand)',
    color: 'var(--white)',
    borderTopRightRadius: 4,
  },
  bubbleTime: {
    fontSize: 10,
    color: 'var(--text-dim)',
    marginTop: 3,
    paddingLeft: 4,
    paddingRight: 4,
  },

  // Input
  inputBar: {
    display: 'flex',
    gap: 10,
    padding: '12px 16px',
    borderTop: '1px solid var(--navy-border)',
    background: 'var(--navy-deep)',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  inputWrap: {
    flex: 1,
    background: 'var(--navy-mid)',
    borderRadius: 14,
    border: '1px solid var(--navy-border)',
    padding: '10px 14px 6px',
  },
  textarea: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--white)',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: 1.5,
    maxHeight: 120,
    overflowY: 'auto',
  },
  inputHint: {
    fontSize: 10,
    color: 'var(--text-dim)',
    marginTop: 3,
    opacity: 0.6,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--blue-brand)',
    border: 'none',
    color: 'var(--white)',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    transition: 'opacity 0.2s, transform 0.1s',
    flexShrink: 0,
  },
}
