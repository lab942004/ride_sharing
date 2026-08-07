import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ridesAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import LocationPicker from '../components/LocationPicker'

export default function CreateRide() {
  const [form, setForm] = useState({
    date: '', time: '', vehicleType: '', availableSeats: ''
  })
  const [fromLocation, setFromLocation] = useState(null) // { label, lat, lng } | null
  const [toLocation, setToLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fromLocation || !toLocation) {
      toast.error('Please pick both a pickup and destination from the search results — typed text alone isn\'t accepted')
      return
    }
    if (!form.date || !form.time || !form.availableSeats) {
      toast.error('Please fill all required fields')
      return
    }
    if (parseInt(form.availableSeats) <= 0) {
      toast.error('Available seats must be greater than 0')
      return
    }
    try {
      setLoading(true)
      await ridesAPI.create({
        ...form,
        from: fromLocation.label,
        to: toLocation.label,
        availableSeats: parseInt(form.availableSeats),
      })
      toast.success('Ride created successfully!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ride')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-5 py-4 bg-gray-100/80 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/40 text-charcoal font-body placeholder-gray-400 text-sm"

  return (
    <div>
      <section className="page-hero relative min-h-screen overflow-hidden">
        {/* Illustrated background */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 1200 800" className="absolute inset-0 w-full h-full" fill="none">
            {/* Trees */}
            <circle cx="1050" cy="200" r="70" fill="#6EE7B7" opacity="0.25"/>
            <circle cx="1110" cy="160" r="50" fill="#A7F3D0" opacity="0.2"/>
            {/* Lamp post */}
            <rect x="1080" y="50" width="10" height="400" rx="5" fill="#92400E" opacity="0.35"/>
            <ellipse cx="1085" cy="50" rx="25" ry="15" fill="#FCD34D" opacity="0.5"/>
            {/* Car */}
            <rect x="600" y="560" width="380" height="120" rx="24" fill="#E8C87A" opacity="0.45"/>
            <rect x="640" y="490" width="300" height="95" rx="18" fill="#F5D687" opacity="0.5"/>
            <circle cx="650" cy="690" r="45" fill="#374151" opacity="0.3"/>
            <circle cx="930" cy="690" r="45" fill="#374151" opacity="0.3"/>
            {/* Person */}
            <circle cx="1000" cy="460" r="30" fill="#FDE68A" opacity="0.6"/>
            <rect x="985" y="490" width="30" height="70" rx="12" fill="#86EFAC" opacity="0.5"/>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
          {/* Headline */}
          <div className="max-w-xl mb-10">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-tight">
              Enter your trip details and connect with passengers traveling your way —{' '}
              <span className="text-primary">simple, safe, and efficient.</span>
            </h1>
          </div>

          {/* Form card — matches Figma */}
          <div className="max-w-lg bg-white/85 backdrop-blur-sm rounded-2xl shadow-card border border-amber-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <LocationPicker
                label="Pickup"
                placeholder="From (search for a location)"
                value={fromLocation}
                onChange={setFromLocation}
                biasLocation={toLocation}
              />

              <LocationPicker
                label="Destination"
                placeholder="To (search for a location)"
                value={toLocation}
                onChange={setToLocation}
                biasLocation={fromLocation}
              />

              <input
                name="date"
                type="date"
                placeholder="Date"
                value={form.date}
                onChange={handleChange}
                className={inputCls}
                min={today}
                max={maxDate}
                required
              />
              <input
                name="time"
                type="time"
                placeholder="Time"
                value={form.time}
                onChange={handleChange}
                className={inputCls}
                required
              />
              <select
                name="vehicleType"
                value={form.vehicleType}
                onChange={handleChange}
                className={inputCls}
              >
                <option value="">Type of vehicle</option>
                <option value="Car">Car</option>
                <option value="Bike">Bike</option>
                <option value="Auto">Auto</option>
                <option value="Cab">Cab</option>
                <option value="Bus">Bus</option>
                <option value="Other">Other</option>
              </select>
              <input
                name="availableSeats"
                type="number"
                placeholder="Available seat"
                value={form.availableSeats}
                onChange={handleChange}
                className={inputCls}
                min={1}
                max={4}
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-base mt-2 disabled:opacity-60"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
