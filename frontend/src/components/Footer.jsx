import { Link } from 'react-router'

export default function Footer() {
  return (
    <footer className="bg-gray-600 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Address */}
          <div>
            <p className="font-semibold text-base">Ride share, Admin Block</p>
            <p className="text-gray-300 text-sm mt-1">NIT Kurukshetra</p>
            <p className="text-gray-300 text-sm">Haryana - 136119</p>
            <p className="text-gray-300 text-sm mt-3">
              Email:{' '}
              <a href="mailto:lab.942004@gmail.com" className="hover:text-primary transition-colors">
                lab.942004@gmail.com
              </a>
            </p>
            <p className="text-gray-300 text-sm mt-1">Phone: +91 9534623781</p>
          </div>

          {/* Quick links */}
          <div>
            <p className="font-semibold text-base underline underline-offset-4 decoration-primary mb-3">
              Quick links
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { to: '/', label: 'Home' },
                { to: '/about', label: 'About Us' },
                { to: '/create-ride', label: 'Create Ride' },
                { to: '/chat', label: 'Chat' },
                { to: '/request', label: 'Request' },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-gray-300 hover:text-primary text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-500 mt-8 pt-5 text-center text-gray-400 text-xs">
          © {new Date().getFullYear()} CloudOne+. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
