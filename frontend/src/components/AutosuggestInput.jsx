import { useEffect, useRef, useState, useCallback } from 'react'
import { geocodeAPI } from '../services/api'

/**
 * A text input with Mappls autosuggest dropdown. Unlike LocationPicker,
 * this allows free-typed text (it's for filtering/searching, not strict
 * location picking). Suggestions appear as the user types; selecting one
 * fills the input with that label.
 */
export default function AutosuggestInput({ value, onChange, placeholder, className = '' }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const runSearch = useCallback((q) => {
    if (q.trim().length < 3) { setSuggestions([]); setLoading(false); return }
    setLoading(true)
    const id = ++reqIdRef.current
    geocodeAPI.search(q)
      .then(res => { if (id === reqIdRef.current) setSuggestions(res.data.data?.results || []) })
      .catch(() => { if (id === reqIdRef.current) setSuggestions([]) })
      .finally(() => { if (id === reqIdRef.current) setLoading(false) })
  }, [])

  const handleChange = (e) => {
    const q = e.target.value
    onChange(q)
    setShowDropdown(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 200)
  }

  const pickSuggestion = (s) => {
    onChange(s.label)
    setShowDropdown(false)
    setSuggestions([])
  }

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => setShowDropdown(true)}
        className={`px-4 py-3 rounded-lg border border-gray-300 bg-white/90 backdrop-blur flex-1 focus:outline-none focus:ring-2 focus:ring-primary/40 font-body text-sm ${className}`}
        autoComplete="off"
      />
      {showDropdown && (loading || suggestions.length > 0) && (
        <ul className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 max-h-56 overflow-auto">
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
  )
}