import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router'
import { requestsAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { isChatExpired } from '../utils/rideTime'

export default function RideCard({ ride, showActions = true, onDelete }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [requesting, setRequesting] = useState(false)
  const [requestStatus, setRequestStatus] = useState(null)
  const [chatExpired, setChatExpired] = useState(false)

  const isOwner = user?.id === ride.createdBy?.id
  const isFull = ride.availableSeats === 0

  useEffect(() => {
    if (user && !isOwner) {
      fetchRequestStatus()
    }
  }, [user, ride.id, isOwner])

  const fetchRequestStatus = async () => {
    try {
      const res = await requestsAPI.getAll()
      const d = res.data.data || res.data
      const sent = d.sent || []
      
      const userRequest = sent.find(req => req.rideId === ride.id)
      if (userRequest) {
        setRequestStatus(userRequest.status)
        
        // Check if chat is expired (2 hours after ride time)
        if (userRequest.status === 'ACCEPTED') {
          setChatExpired(isChatExpired(ride.date, ride.time))
        }
      }
    } catch (err) {
      console.error('Failed to fetch request status:', err)
    }
  }

  const handleRequest = async () => {
    if (!user) { navigate('/login'); return }
    try {
      setRequesting(true)
      await requestsAPI.create(ride.id)
      setRequestStatus('PENDING')
      toast.success('Ride request sent!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request')
    } finally {
      setRequesting(false)
    }
  }

  const handleChat = () => {
    if (!user) { navigate('/login'); return }
    navigate('/chat', { state: { requestId: requestStatus ? null : ride.id } })
  }

  const formattedDate = ride.date ? format(new Date(ride.date), 'dd/MM/yyyy') : 'N/A'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden">
      {/* Card header */}
      <div className="px-5 pt-4 pb-2 flex justify-between items-center border-b border-gray-50">
        <div>
          {isFull && (
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
              FULL
            </span>
          )}
        </div>
        <span className="text-xs text-muted font-mono font-semibold">
          ID: {ride.createdBy?.rollNo || '—'}
        </span>
      </div>

      {/* Info grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div className="info-pair">
          <span className="label-text">Journey Date</span>
          <span className="value-text">{formattedDate}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">Journey Time</span>
          <span className="value-text">{ride.time || 'N/A'}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">To</span>
          <span className="value-text">{ride.to}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">From</span>
          <span className="value-text">{ride.from}</span>
        </div>
        {ride.vehicleType && (
          <div className="info-pair">
            <span className="label-text">Vehicle</span>
            <span className="value-text capitalize">{ride.vehicleType}</span>
          </div>
        )}
        <div className="info-pair">
          <span className="label-text">Seats Available</span>
          <span className={`value-text ${isFull ? 'text-red-500' : 'text-green-600'}`}>
            {ride.availableSeats}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 pt-2">
        {showActions && !isOwner && (
          <div className="flex gap-3">
            {!requestStatus ? (
              <button
                onClick={handleRequest}
                disabled={isFull || requesting}
                className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting ? 'Sending...' : 'REQUEST RIDE'}
              </button>
            ) : requestStatus === 'PENDING' ? (
              <button
                disabled
                className="btn-primary flex-1 text-sm py-2.5 opacity-60 cursor-not-allowed"
              >
                REQUESTED
              </button>
            ) : requestStatus === 'ACCEPTED' ? (
              chatExpired ? (
                <button
                  disabled
                  className="btn-primary flex-1 text-sm py-2.5 opacity-60 cursor-not-allowed bg-red-500"
                >
                  CHAT EXPIRED
                </button>
              ) : (
                <button
                  onClick={handleChat}
                  className="btn-primary flex-1 text-sm py-2.5"
                >
                  JOIN CHAT
                </button>
              )
            ) : requestStatus === 'REJECTED' ? (
              <button
                disabled
                className="btn-primary flex-1 text-sm py-2.5 opacity-60 cursor-not-allowed bg-red-500"
              >
                REJECTED
              </button>
            ) : null}
          </div>
        )}

        {isOwner && onDelete && (
          <div className="flex items-center justify-between">
            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
              Your Ride
            </span>
            <button
              onClick={() => onDelete(ride.id)}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        )}

        {isOwner && !onDelete && (
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
            Your Ride
          </span>
        )}
      </div>
    </div>
  )
}
