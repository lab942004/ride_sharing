import { useState, useEffect } from 'react'
import { requestsAPI, chatAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router'
import { format } from 'date-fns'
import { hasChatDisappeared } from '../utils/rideTime'
import AdContainer from '../components/ads/AdContainer'
import { ADSENSE } from '../config/adsense'

function RequestCard({ request, onAccept, onReject, viewType }) {
  const navigate = useNavigate()
  const toast = useToast()
  const ride = request.ride
  const requester = request.requester
  const isIncoming = viewType === 'incoming'
  const isPending = request.status === 'PENDING' || request.status === 'pending'
  const isAccepted = request.status === 'ACCEPTED' || request.status === 'accepted'
  const chatDisappeared = ride && hasChatDisappeared(ride.date, ride.time)

  const formattedDate = ride?.date ? format(new Date(ride.date), 'dd/MM/yyyy') : 'N/A'

  const handleChatNav = () => navigate('/chat', { state: { requestId: request.id } })

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
      {/* Card header with ID */}
      <div className="px-5 pt-4 pb-2 flex justify-between items-center border-b border-gray-50">
        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
          isAccepted ? 'bg-green-100 text-green-700' :
          (request.status === 'REJECTED' || request.status === 'rejected') ? 'bg-red-100 text-red-600' :
          'bg-amber-100 text-amber-700'
        }`}>
          {(request.status || 'pending').toUpperCase()}
        </span>
        <span className="text-xs text-muted font-mono font-semibold">
          ID: {requester?.rollNo || ride?.createdBy?.rollNo || '—'}
        </span>
      </div>

      {/* Ride info grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div className="info-pair">
          <span className="label-text">Journey Date</span>
          <span className="value-text">{formattedDate}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">Journey Time</span>
          <span className="value-text">{ride?.time || 'N/A'}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">To</span>
          <span className="value-text">{ride?.to || '—'}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">From</span>
          <span className="value-text">{ride?.from || '—'}</span>
        </div>
      </div>

      {/* Requester info (incoming) */}
      {isIncoming && (
        <div className="px-5 pb-2 text-xs text-muted border-t border-gray-50 pt-2">
          Requested by:{' '}
          <span className="font-semibold text-charcoal">{requester?.name}</span>
          {requester?.rollNo && <span> · {requester.rollNo}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 pt-2 flex gap-3">
        {isIncoming && isPending && (
          <>
            <button
              onClick={() => onAccept(request.id)}
              className="btn-primary flex-1 text-sm py-2.5"
            >
              Accept
            </button>
            <button
              onClick={() => onReject(request.id)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Reject
            </button>
          </>
        )}
        {isAccepted && !chatDisappeared && (
          <button
            onClick={handleChatNav}
            className="btn-primary flex-1 text-sm py-2.5"
          >
            💬 Open Chat
          </button>
        )}
        {isAccepted && chatDisappeared && (
          <span className="text-sm text-muted italic">Chat no longer available</span>
        )}
        {!isIncoming && isPending && (
          <span className="text-sm text-muted italic">Awaiting response...</span>
        )}
      </div>
    </div>
  )
}

export default function Request() {
  const [tab, setTab] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const res = await requestsAPI.getAll()
      const d = res.data.data || res.data
      setIncoming(d.received || [])
      setOutgoing(d.sent || [])
    } catch {
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id) => {
    try {
      await requestsAPI.updateStatus(id, 'ACCEPTED')
      toast.success('Request accepted!')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept')
    }
  }

  const handleReject = async (id) => {
    try {
      await requestsAPI.updateStatus(id, 'REJECTED')
      toast.info('Request rejected')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject')
    }
  }

  const displayList = tab === 'incoming' ? incoming : outgoing

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="page-hero relative overflow-hidden py-16 px-6">
        {/* Background illustration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 1200 500" className="absolute right-0 top-0 h-full w-3/5" fill="none">
            <circle cx="900" cy="180" r="80" fill="#6EE7B7" opacity="0.25"/>
            <rect cx="1050" cy="50" width="10" height="400" rx="5" fill="#92400E" opacity="0.3"/>
            <rect x="600" y="300" width="380" height="110" rx="22" fill="#E8C87A" opacity="0.4"/>
            <rect x="640" y="240" width="300" height="85" rx="16" fill="#F5D687" opacity="0.45"/>
            <circle cx="640" cy="420" r="42" fill="#374151" opacity="0.25"/>
            <circle cx="920" cy="420" r="42" fill="#374151" opacity="0.25"/>
            <circle cx="1000" cy="225" r="28" fill="#FDE68A" opacity="0.5"/>
            <rect x="988" y="253" width="24" height="65" rx="10" fill="#86EFAC" opacity="0.4"/>
            <rect x="1060" y="50" width="8" height="380" rx="4" fill="#92400E" opacity="0.3"/>
            <ellipse cx="1064" cy="50" rx="22" ry="14" fill="#FCD34D" opacity="0.45"/>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-tight max-w-2xl">
            Traveling from campus? Post your ride request and connect with college mates going the same way —{' '}
            <span className="text-primary">safe, affordable, and convenient.</span>
          </h1>

          {/* Tab toggle */}
          <div className="flex gap-3 mt-10">
            {[
              { key: 'incoming', label: `Incoming (${incoming.length})` },
              { key: 'outgoing', label: `My Requests (${outgoing.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  tab === t.key
                    ? 'bg-primary text-white shadow-btn'
                    : 'bg-white text-charcoal hover:bg-amber-50 border border-amber-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request cards ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <div className="text-5xl mb-4">📋</div>
            <p className="font-display text-xl text-charcoal">No requests yet</p>
            <p className="text-sm mt-2">
              {tab === 'incoming' ? "No one has requested your rides yet." : "You haven't requested any rides yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayList.map((req, i) => (
              <div
                key={req.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
              >
                <RequestCard
                  request={req}
                  viewType={tab}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── RIDE DETAILS ADVERTISEMENT ─────────────────────────── */}
        {/* Placed after the ride/request cards (the booking section) and
            before the footer ("additional information"), so it never covers
            the Accept / Reject / Chat buttons or ride information. */}
        <AdContainer adSlot={ADSENSE.RIDE_DETAILS_SLOT} className="mt-10" />
      </section>
    </div>
  )
}
