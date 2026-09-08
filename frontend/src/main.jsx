import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The Google AdSense (adsbygoogle.js) script is loaded exactly once in
// index.html — it is intentionally NOT added here to avoid duplicate script
// tags. Ad units are created by the reusable <GoogleAd> component.

// PWA — register the service worker once on load.
// Production only: in dev the service worker (which does offline caching)
// would fight the Vite HMR pipeline. usePushNotifications reuses this
// registration for Web Push (and bootstraps its own in dev).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
