import { Link, NavLink, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
    setMenuOpen(false)
  }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About Us' },
    { to: '/create-ride', label: 'Create Ride' },
    { to: '/chat', label: 'Chat' },
    { to: '/request', label: 'Request' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-amber-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `nav-link text-sm ${isActive ? 'nav-link-active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `nav-link text-sm ${isActive ? 'nav-link-active' : ''}`
                }
              >
                Profile
              </NavLink>
            )}
          </div>

          {/* Logo (center on mobile, right on desktop) */}
          <Link to="/" className="md:hidden flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
            <span className="font-display font-bold text-lg text-charcoal">RideShare</span>
          </Link>

          {/* Auth button */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted font-medium">{user.name?.split(' ')[0]}</span>
                <button onClick={handleLogout} className="btn-primary text-sm py-2 px-5">
                  Log Out
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-sm py-2 px-6 font-bold">
                LOG IN
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-amber-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className={`w-5 h-0.5 bg-charcoal transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 bg-charcoal my-1 ${menuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 bg-charcoal transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-amber-100 mt-2 pt-4 flex flex-col gap-3 animate-slide-in">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? 'text-primary bg-amber-50' : 'text-charcoal hover:text-primary hover:bg-amber-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? 'text-primary bg-amber-50' : 'text-charcoal hover:text-primary'
                  }`
                }
              >
                Profile
              </NavLink>
            )}
            <div className="pt-1">
              {user ? (
                <button onClick={handleLogout} className="btn-primary text-sm w-full">
                  Log Out
                </button>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary text-sm text-center block font-bold">
                  LOG IN
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
