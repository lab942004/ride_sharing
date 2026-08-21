import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The Google AdSense (adsbygoogle.js) script is loaded exactly once in
// index.html — it is intentionally NOT added here to avoid duplicate script
// tags. Ad units are created by the reusable <GoogleAd> component.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
