import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ridesAPI } from '../services/api'
import RideCard from '../components/RideCard'
import AutosuggestInput from '../components/AutosuggestInput'
import { useAuth } from '../context/AuthContext'

const testimonials = [
  {
    text: "Looking for a ride from [Hostel/College] to [Destination] at [Time]. Prefer college mates. Will share cost.",
    emoji: '👩',
    side: 'right',
  },
  {
    text: "Hi! I'm driving from [Pickup] to [Destination] at [Time]. Have seats available—happy to share the ride and cost",
    emoji: '🚗',
    side: 'left',
  },
  {
    text: "Looking for a ride from NIT Kurukshetra to Delhi at 5 PM. Will share fuel cost and travel comfortably.",
    emoji: '🛺',
    side: 'right',
  },
]

export default function Home() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({ to: '', from: '', date: '' })
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) fetchRides()
  }, [user])

  const fetchRides = async (params = {}) => {
    try {
      setLoading(true)
      const res = await ridesAPI.getAll(params)
      const d = res.data.data || res.data
      setRides(d.rides || [])
    } catch {
      setRides([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const p = {}
    if (filter.to) p.to = filter.to
    if (filter.from) p.from = filter.from
    if (filter.date) p.date = filter.date
    fetchRides(p)
  }

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="page-hero relative min-h-[420px] flex flex-col justify-center overflow-hidden">
        {/* Illustrated background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 h-full w-1/2 hidden md:block">
            <svg viewBox="0 0 600 420" className="h-full w-full" fill="none">
              {/* Trees */}
              <circle cx="380" cy="120" r="55" fill="#6EE7B7" opacity="0.35"/>
              <circle cx="430" cy="95" r="40" fill="#A7F3D0" opacity="0.3"/>
              <circle cx="510" cy="140" r="45" fill="#6EE7B7" opacity="0.25"/>
              {/* Lamp post */}
              <rect x="520" y="60" width="8" height="280" rx="4" fill="#92400E" opacity="0.5"/>
              <ellipse cx="524" cy="60" rx="20" ry="12" fill="#FCD34D" opacity="0.6"/>
              {/* Car body */}
              <rect x="160" y="280" width="280" height="90" rx="22" fill="#E8C87A" opacity="0.7"/>
              <rect x="200" y="225" width="220" height="80" rx="16" fill="#F5D687" opacity="0.8"/>
              {/* Windows */}
              <rect x="215" y="233" width="80" height="55" rx="10" fill="#BFDBFE" opacity="0.5"/>
              <rect x="308" y="233" width="80" height="55" rx="10" fill="#BFDBFE" opacity="0.5"/>
              {/* Wheels */}
              <circle cx="215" cy="375" r="35" fill="#374151" opacity="0.5"/>
              <circle cx="385" cy="375" r="35" fill="#374151" opacity="0.5"/>
              <circle cx="215" cy="375" r="18" fill="#6B7280" opacity="0.4"/>
              <circle cx="385" cy="375" r="18" fill="#6B7280" opacity="0.4"/>
              {/* Person */}
              <circle cx="440" cy="230" r="22" fill="#FDE68A" opacity="0.8"/>
              <rect x="427" y="252" width="26" height="55" rx="10" fill="#86EFAC" opacity="0.7"/>
              <rect x="420" y="252" width="12" height="35" rx="6" fill="#A3E635" opacity="0.6"/>
              <rect x="448" y="252" width="12" height="35" rx="6" fill="#A3E635" opacity="0.6"/>
            </svg>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16 w-full relative z-10">
          <div className="max-w-xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-tight">
              Welcome! Connect with your college community, share rides, and travel together —{' '}
              <span className="text-primary">smarter, safer, and more affordable.</span>
            </h1>

            {!user && (
              <button
                onClick={() => navigate('/register')}
                className="btn-primary mt-8 text-base px-10 py-3"
              >
                Get Started
              </button>
            )}
          </div>

          {/* Search bar for logged-in users */}
          {user && (
            <form onSubmit={handleSearch} className="mt-10 flex flex-col sm:flex-row gap-3 max-w-2xl">
              <AutosuggestInput
                placeholder="To"
                value={filter.to}
                onChange={v => setFilter(p => ({ ...p, to: v }))}
              />
              <AutosuggestInput
                placeholder="From"
                value={filter.from}
                onChange={v => setFilter(p => ({ ...p, from: v }))}
              />
              <input
                type="date"
                value={filter.date}
                onChange={e => setFilter(p => ({ ...p, date: e.target.value }))}
                className="px-4 py-3 rounded-lg border border-gray-300 bg-white/90 backdrop-blur flex-1 focus:outline-none focus:ring-2 focus:ring-primary/40 font-body text-sm"
              />
              <button type="submit" className="btn-primary px-8 whitespace-nowrap">
                Find Ride
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── RIDE LISTINGS ─────────────────────────────────────────── */}
      {user && (
        <section className="max-w-7xl mx-auto px-6 py-14">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <div className="text-5xl mb-4">🚗</div>
              <p className="font-display text-xl text-charcoal">No rides available</p>
              <p className="text-sm mt-2">Be the first to create a ride!</p>
              <button onClick={() => navigate('/create-ride')} className="btn-primary mt-6">
                Create Ride
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rides.map((ride, i) => (
                <div
                  key={ride.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
                >
                  <RideCard ride={ride} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── TESTIMONIALS (unauthenticated) ───────────────────────── */}
      {!user && (
        <section className="max-w-5xl mx-auto px-6 py-20">
          <div className="space-y-20">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`flex items-center gap-10 ${t.side === 'left' ? 'flex-row-reverse' : ''}`}
              >
                <div className="flex-1">
                  <p className="text-lg font-body text-charcoal leading-relaxed">{t.text}</p>
                </div>
                <div className="w-44 h-44 flex-shrink-0">
                  <div className="w-full h-full rounded-full bg-amber-100 flex items-center justify-center text-6xl shadow-inner">
                    {t.emoji}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
