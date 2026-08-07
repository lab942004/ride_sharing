import { useEffect, useRef, useState, useCallback } from 'react'
import { geocodeAPI } from '../services/api'

/**
 * A location field backed by the Mappls autosuggest dropdown. The user
 * picks a suggestion from the list; `onChange` fires with { label }.
 * There is no way to submit free-typed text alone.
 */
export default function LocationPicker({ label, placeholder, value, onChange, biasLocation }) {
  const [query, setQuery] = useState(value?.label || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const wrapperRef = useRef(null)

  // Build a ~50 km viewbox around a known location to bias search results
  const getViewbox = useCallback(() => {
    const loc = biasLocation || value
    if (!loc) return undefined
    const delta = 0.45 // ~50 km
    return `${(loc.lng - delta).toFixed(4)},${(loc.lat - delta).toFixed(4)},${(loc.lng + delta).toFixed(4)},${(loc.lat + delta).toFixed(4)}`
  }, [biasLocation, value])

  useEffect(() => { setQuery(value?.label || '') }, [value?.label])

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const runSearch = useCallback((q) => {
    if (q.trim().length < 3) { setSuggestions([]); setLoading(false); return }
    setLoading(true)
    const id = ++reqIdRef.current
    geocodeAPI.search(q, getViewbox())
      .then(res => { if (id === reqIdRef.current) setSuggestions(res.data.data?.results || []) })
      .catch(() => { if (id === reqIdRef.current) setSuggestions([]) })
      .finally(() => { if (id === reqIdRef.current) setLoading(false) })
  }, [])

  const handleInputChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setShowDropdown(true)
    if (value) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 200)
  }

  const pickSuggestion = (s) => {
    setQuery(s.label)
    setShowDropdown(false)
    setSuggestions([])
    onChange({ label: s.label })
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          className="w-full px-5 py-4 pr-24 bg-gray-100/80 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/40 text-charcoal font-body placeholder-gray-400 text-sm"
          autoComplete="off"
        />

        {value && (
          <span className="absolute -bottom-5 left-1 text-[11px] text-emerald-600 font-medium">
            ✓ Verified location
          </span>
        )}

        {showDropdown && (loading || suggestions.length > 0) && (
          <ul className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 max-h-56 overflow-auto">
            {loading && <li className="px-4 py-3 text-sm text-gray-400">Searching…</li>}
            {!loading && suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => pickSuggestion(s)}
                className="px-4 py-3 text-sm text-charcoal hover:bg-primary/5 cursor-pointer border-b border-gray-50 last:border-0"
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}