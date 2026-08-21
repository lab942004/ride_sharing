import { ADSENSE } from '../../config/adsense'
import AdContainer from './AdContainer'

/**
 * Desktop sidebar advertisement unit.
 *
 * NOTE: The current site layout is a single-column layout with no desktop
 * sidebar, so this component is intentionally NOT wired into any page today.
 * It is provided as a ready-to-use, reusable building block: drop it inside a
 * sidebar column and it will render the SIDEBAR_SLOT unit on md+ screens and
 * hide itself on small screens so it never causes horizontal scrolling or an
 * over-wide sidebar.
 *
 * To use it: place <DesktopSidebarAd /> inside an aside/sidebar column. Width
 * limits are applied by the container so the sidebar never becomes too wide.
 */
export default function DesktopSidebarAd({ enabled = true }) {
  if (!ADSENSE.ENABLED || !enabled) {
    return null
  }

  return (
    <div className="hidden md:block w-full max-w-xs mx-auto">
      <AdContainer adSlot={ADSENSE.SIDEBAR_SLOT} />
    </div>
  )
}
