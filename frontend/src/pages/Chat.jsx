import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router'
import { chatAPI, requestsAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../services/socket'
import { format } from 'date-fns'
import { isChatExpired, hasChatDisappeared } from '../utils/rideTime'

function ChatBubble({ msg, isMe }) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={isMe ? 'chat-bubble-right' : 'chat-bubble-left'}>
        <p className="text-sm leading-relaxed">{msg.text}</p>
        <p className={`text-xs mt-1 ${isMe ? 'text-amber-200' : 'text-gray-400'}`}>
          {msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm') : ''}
        </p>
      </div>
    </div>
  )
}

// function ConversationItem({ req, active, onClick }) {
//   const ride = req.ride
//   const other = req.requester || req.rideCreator
//   return (
//     <button
//       onClick={onClick}
//       className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
//         active ? 'bg-amber-100 border border-amber-200' : 'hover:bg-amber-50'
//       }`}
//     >
//       <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0 text-sm">
//         {other?.name?.[0] || '?'}
//       </div>
//       <div className="min-w-0">
//         <p className="font-semibold text-sm text-charcoal truncate">{other?.name || 'Unknown'}</p>
//         <p className="text-xs text-muted truncate">{ride?.from} → {ride?.to}</p>
//       </div>
//     </button>
//   )
// }

function ConversationItem({ req, active, onClick, currentUser }) {
  const ride = req.ride

  const other =
    req.requester?.id === currentUser?.id
      ? req.rideCreator
      : req.requester

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
        active ? 'bg-amber-100 border border-amber-200' : 'hover:bg-amber-50'
      }`}
    >
      {other?.profilePic ? (
        <img
          src={other.profilePic}
          alt={other?.name || 'Avatar'}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0 text-sm">
          {other?.name?.[0] || '?'}
        </div>
      )}

      <div className="min-w-0">
        <p className="font-semibold text-sm text-charcoal truncate">
          {other?.name || 'Unknown'}
        </p>

        <p className="text-xs text-muted truncate">
          {ride?.from} → {ride?.to}
        </p>
      </div>
    </button>
  )
}

export default function Chat() {
  const location = useLocation()
  const [acceptedRequests, setAcceptedRequests] = useState([])
  const [activeReqId, setActiveReqId] = useState(location.state?.requestId || null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sharingPhone, setSharingPhone] = useState(false)
  const [phoneShared, setPhoneShared] = useState(false)
  const [otherUserPhone, setOtherUserPhone] = useState(null)
  const [chatExpired, setChatExpired] = useState(false)
  const [mobileMode, setMobileMode] = useState(location.state?.requestId ? 'chat' : 'list')
  const [deletingChat, setDeletingChat] = useState(false)
  const messagesEndRef = useRef(null)
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => { fetchAcceptedRequests() }, [])

  useEffect(() => {
    if (!activeReqId) return
    fetchMessages(activeReqId)
    setupSocket(activeReqId)
    checkChatExpiry(activeReqId)
    return () => {
      try {
        const sock = getSocket()
        // sock.emit('leave_chat', `chat_${activeReqId}`)
        // sock.off('new_message')

        sock.emit('leave_chat', { requestId: activeReqId })
        sock.off('new_message')

      } catch {}
    }
  }, [activeReqId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchAcceptedRequests = async () => {
    try {
      setLoading(true)
      const res = await requestsAPI.getAll()
      const d = res.data.data || res.data
      const inc = d.received || []
      const out = d.sent || []
      // The backend already excludes requests whose chat has disappeared
      // (5+ days past ride departure), but we filter again here too in case
      // this list is showing slightly stale data from before that cutoff.
      const notDisappeared = r => !r.ride || !hasChatDisappeared(r.ride.date, r.ride.time)
      const accepted = [
        ...inc.filter(r => (r.status === 'ACCEPTED' || r.status === 'accepted') && notDisappeared(r)),
        ...out.filter(r => (r.status === 'ACCEPTED' || r.status === 'accepted') && notDisappeared(r)),
      ]
      setAcceptedRequests(accepted)
      // Set first if no active, or navigate from request page
      if (!activeReqId && accepted.length > 0) {
        setActiveReqId(accepted[0].id)
      }
      if (location.state?.requestId && accepted.find(r => r.id === location.state.requestId)) {
        setActiveReqId(location.state.requestId)
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setMobileMode('chat')
        }
      }
    } catch {
      toast.error('Failed to load chats')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (requestId) => {
    try {
      const res = await chatAPI.getMessages(requestId)
      const d = res.data.data || res.data
      setMessages(d.messages || [])
    } catch (err) {
      if (err.response?.status !== 403) toast.error('Failed to load messages')
      setMessages([])
    }
  }

  // const setupSocket = useCallback((requestId) => {
  //   try {
  //     const sock = getSocket()
  //     sock.emit('join_chat', `chat_${requestId}`)
  //     sock.off('new_message')
  //     sock.on('new_message', (msg) => {
  //       setMessages(prev => [...prev, msg])
  //     })
  //   } catch {}
  // }, [])

  const setupSocket = useCallback((requestId) => {
  try {
    const sock = getSocket()

    sock.emit('join_chat', { requestId })

    sock.off('new_message')

    sock.on('new_message', (msg) => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === msg.id)
        if (exists) return prev
        return [...prev, msg]
      })
    })
  } catch (error) {
    console.error('Socket setup failed:', error)
  }
}, [])

  const checkChatExpiry = (requestId) => {
    const req = acceptedRequests.find(r => r.id === requestId)
    if (!req || !req.ride) return

    setChatExpired(isChatExpired(req.ride.date, req.ride.time))
    setPhoneShared(req.phoneShared || false)
  }

  const handlePhoneShare = async () => {
    if (!activeReqId) return
    try {
      setSharingPhone(true)
      const res = await requestsAPI.sharePhone(activeReqId)
      const data = res.data.data || res.data

      if (data.bothConfirmed && data.phones) {
        setOtherUserPhone(data.phones)
        setPhoneShared(true)
        toast.success('Phone numbers shared!')
      } else {
        toast.info(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share phone')
    } finally {
      setSharingPhone(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!activeReqId) return
    const confirm = window.confirm('Delete this chat and remove the request? This cannot be undone.')
    if (!confirm) return
    try {
      setDeletingChat(true)
      await requestsAPI.delete(activeReqId)
      const remaining = acceptedRequests.filter(r => r.id !== activeReqId)
      setAcceptedRequests(remaining)
      setActiveReqId(remaining.length > 0 ? remaining[0].id : null)
      if (remaining.length > 0) {
        setMobileMode('chat')
      } else {
        setMobileMode('list')
      }
      toast.success('Chat deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete chat')
    } finally {
      setDeletingChat(false)
    }
  }

  // const handleSend = async (e) => {
  //   e.preventDefault()
  //   if (!newMsg.trim() || !activeReqId) return
  //   try {
  //     setSending(true)
  //     const res = await chatAPI.sendMessage(activeReqId, newMsg.trim())
  //     const d = res.data.data || res.data
  //     // Optimistically add or wait for socket
  //     setMessages(prev => [...prev, d.message || { text: newMsg.trim(), senderId: user?.id, createdAt: new Date() }])
  //     setNewMsg('')
  //   } catch {
  //     toast.error('Failed to send message')
  //   } finally {
  //     setSending(false)
  //   }
  // }

  const handleSend = async (e) => {
  e.preventDefault()

  if (!newMsg.trim() || !activeReqId) return

  try {
    setSending(true)

    const sock = getSocket()

    sock.emit('send_message', {
      requestId: activeReqId,
      text: newMsg.trim(),
    })

    setNewMsg('')
  } catch {
    toast.error('Failed to send message')
  } finally {
    setSending(false)
  }
}

  const activeReq = acceptedRequests.find(r => r.id === activeReqId)

  const getOtherParticipant = (req) => {
    if (!req) return null
    // If current user is the requester, show the ride creator
    if (req.requester?.id === user?.id) {
      return req.rideCreator || req.ride?.createdBy
    }
    // If current user is the ride creator, show the requester
    return req.requester
  }

  const otherParticipant = getOtherParticipant(activeReq)

  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="page-hero relative overflow-hidden py-8 px-4 md:py-14 md:px-6">
        {/* Background illustration */}
        <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 1200 500" className="absolute right-0 top-0 h-full w-2/3" fill="none">
            <circle cx="900" cy="160" r="75" fill="#6EE7B7" opacity="0.22"/>
            <rect x="580" y="310" width="360" height="105" rx="22" fill="#E8C87A" opacity="0.38"/>
            <rect x="620" y="250" width="280" height="80" rx="16" fill="#F5D687" opacity="0.42"/>
            <circle cx="628" cy="425" r="40" fill="#374151" opacity="0.22"/>
            <circle cx="888" cy="425" r="40" fill="#374151" opacity="0.22"/>
            <circle cx="960" cy="215" r="26" fill="#FDE68A" opacity="0.45"/>
            <rect x="949" y="241" width="22" height="60" rx="10" fill="#86EFAC" opacity="0.38"/>
            <rect x="1050" y="40" width="8" height="360" rx="4" fill="#92400E" opacity="0.28"/>
            <ellipse cx="1054" cy="40" rx="20" ry="12" fill="#FCD34D" opacity="0.42"/>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="hidden md:block">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-tight max-w-2xl">
              Chat with your college mates, coordinate rides, and make your journey{' '}
              <span className="text-primary">smooth and social.</span>
            </h1>
          </div>
          <div className="md:hidden mb-4">
            <h1 className="text-2xl font-bold text-charcoal">Your Rideshare Chats</h1>
            <p className="text-sm text-muted mt-1">Tap a chat to start messaging</p>
          </div>

          {/* ── Chat UI ── */}
          <div className="mt-6 w-full max-w-full md:max-w-4xl mx-auto bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-96">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : acceptedRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-muted">
                <div className="text-5xl mb-4">💬</div>
                <p className="font-display text-lg text-charcoal">No conversations yet</p>
                <p className="text-sm mt-1">Accept a ride request to start chatting</p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row min-h-[calc(100vh-220px)] md:h-[560px] md:max-h-[560px]">
                {/* Sidebar / chat list */}
                <div className={`w-full md:w-64 h-full border-b border-gray-100 md:border-b-0 md:border-r overflow-y-auto p-3 flex-shrink-0 bg-amber-50/95 shadow-none md:shadow-none ${mobileMode === 'list' ? 'block' : 'hidden md:block'}`}>
                  <div className="flex items-center justify-between mb-3 md:hidden">
                    <p className="text-sm font-semibold text-charcoal uppercase tracking-wide">Chats</p>
                    <button
                      onClick={() => setMobileMode('chat')}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="hidden md:block text-xs text-muted uppercase tracking-wider font-semibold px-2 mb-3">Chats</p>
                  {acceptedRequests.map(req => (
                    <ConversationItem
                      key={req.id}
                      req={req}
                      active={activeReqId === req.id}
                      onClick={() => {
                        setActiveReqId(req.id)
                        setMobileMode('chat')
                      }}
                      currentUser={user}
                    />
                  ))}
                </div>

                {/* Messages panel */}
                <div className={`flex-1 flex flex-col min-w-0 relative md:z-10 ${mobileMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
                  {/* Chat header */}
                  {activeReq && (
                    <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/40">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <button 
                          onClick={() => setMobileMode('list')}
                          className="md:hidden inline-flex items-center gap-2 px-3 py-2 bg-white/90 border border-amber-200 rounded-lg shadow-sm text-sm font-semibold text-charcoal hover:bg-amber-100 transition-colors"
                          title="View conversations"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Chats
                        </button>
                        {otherParticipant?.profilePic && (
                          <img
                            src={otherParticipant.profilePic}
                            alt={otherParticipant?.name || 'Partner'}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-charcoal truncate">
                            {otherParticipant?.name || 'Partner'}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {activeReq.ride?.from} → {activeReq.ride?.to}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {chatExpired && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded whitespace-nowrap">
                              Expired
                            </span>
                          )}
                          <button
                            onClick={handleDeleteChat}
                            disabled={deletingChat}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
                          >
                            {deletingChat ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      {/* Phone Sharing UI */}
                      {!chatExpired && (
                        <div className="mt-2 flex flex-col gap-2">
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={phoneShared}
                              onChange={handlePhoneShare}
                              disabled={sharingPhone}
                              className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-gray-700">
                              {sharingPhone ? 'Sharing...' : 'Share Phone Number'}
                            </span>
                          </label>
                          {otherUserPhone && phoneShared && (
                            <div className="bg-green-100 rounded p-2 space-y-1 break-words">
                              <p className="text-xs text-green-700 font-semibold break-words">
                                📱 {otherUserPhone.creatorName}: {otherUserPhone.creatorPhone}
                              </p>
                              <p className="text-xs text-green-700 font-semibold break-words">
                                📱 {otherUserPhone.requesterName}: {otherUserPhone.requesterPhone}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages */}
                  <div
                    className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-2 md:gap-3 touch-pan-y max-h-full"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted text-sm">
                        Say hello! 👋
                      </div>
                    ) : (
                      messages.map((msg, i) => (
                        <ChatBubble
                          key={msg.id || i}
                          msg={msg}
                          isMe={msg.senderId === user?.id || msg.sender?.id === user?.id}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  {chatExpired ? (
                    <div className="p-3 md:p-4 border-t border-gray-100 bg-red-50 text-center text-sm text-red-600 font-medium flex items-center justify-center gap-3">
                      <span>Chat window has expired (2 hours after ride time)</span>
                      <button
                        onClick={handleDeleteChat}
                        disabled={deletingChat}
                        className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                      >
                        {deletingChat ? 'Deleting...' : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4l1 4H9l1-4z" />
                            </svg>
                            Delete Chat
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSend}
                      className="p-3 md:p-4 border-t border-gray-100 flex gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        placeholder="Chatting ..."
                        className="flex-1 px-3 md:px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-body"
                      />
                      <button
                        type="submit"
                        disabled={sending || !newMsg.trim()}
                        className="w-10 h-10 bg-primary hover:bg-primary-dark rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}