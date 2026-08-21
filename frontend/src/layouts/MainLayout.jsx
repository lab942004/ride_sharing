import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import MobileBottomAd from '../components/ads/MobileBottomAd'
import { ADSENSE } from '../config/adsense'

export default function MainLayout() {
  // Reserve extra bottom padding on mobile only while the mobile bottom ad is
  // active, so the fixed (compact) ad never covers content, buttons, or
  // navigation. pb-[55px] keeps the strip clear while removing the large empty
  // gap that the old pb-20 (80px) left behind.
  const bottomPad = ADSENSE.ENABLED ? 'pb-[55px] md:pb-0' : ''

  return (
    <div className={`min-h-screen flex flex-col bg-cream ${bottomPad}`.trim()}>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomAd />
    </div>
  )
}
