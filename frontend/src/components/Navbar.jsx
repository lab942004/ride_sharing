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
          {/* Desktop brand + nav links */}
          <div className="hidden md:flex items-center gap-7">
            <Link to="/" className="flex items-center shrink-0" aria-label="RideShare home">
              <img src="/logo.png" alt="RideShare logo" className="w-10 h-10 rounded-lg object-cover" />
            </Link>
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
          <Link to="/" className="md:hidden flex items-center group" aria-label="RideShare home">
            <img src="/logo.png" alt="RideShare logo" className="w-10 h-10 rounded-lg object-cover" />
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
