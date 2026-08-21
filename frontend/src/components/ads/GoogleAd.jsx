import { useEffect, useRef } from 'react'
import { ADSENSE, ADSENSE_READY } from '../../config/adsense'

/**
 * Reusable, policy-safe Google AdSense display unit.
 *
 * Behaviour:
 *  - Renders nothing when ads are globally disabled (VITE_ENABLE_ADS=false)
 *    or when this instance is opted out via `enabled={false}`.
 *  - Renders a labelled placeholder during local development (import.meta.env.DEV)
 *    so you can see exactly where an ad will appear, without requesting real
 *    advertisements from localhost.
 *  - Renders the standard `<ins class="adsbygoogle" ...>` unit in production
 *    and safely queues it with `(window.adsbygoogle || []).push({})`.
 *  - Never throws and never crashes the app, no matter what AdSense does
 *    (script missing, blocked, invalid slot, duplicate init, load errors).
 *
 * @param {string}  adSlot     Slot id from ADSENSE (e.g. ADSENSE.HOME_SLOT).
 * @param {string}  format     data-ad-format (default "auto").
 * @param {boolean} responsive data-full-width-responsive (default true).
 * @param {string}  className  Extra classes for the <ins> element.
 * @param {object}  style      Extra inline styles merged over display:block.
 * @param {boolean} compact    Slim chrome for sticky/narrow placements. For the
 *                             real <ins> unit this ONLY trims the surrounding
 *                             placeholder/padding — it never forces a fixed or
 *                             clipped height. Google's responsive "auto" format
 *                             keeps choosing the correct size, so a larger ad
 *                             served by Google is preserved (policy-safe).
 * @param {boolean} enabled    Per-instance opt-out (default true).
 */
export default function GoogleAd({
  // Defaults to the exact "ride_sharing" ad unit (slot 9364054937) so the real
  // ad is used even if a caller omits the slot.
  adSlot = ADSENSE.HOME_SLOT,
  format = 'auto',
  responsive = true,
  className = '',
  style,
  compact = false,
  enabled = true,
}) {
  const insRef = useRef(null)
  const pushedRef = useRef(false)

  // Base style for the real <ins> ad unit. Width is kept to 100%/max 100% so it
  // never creates horizontal overflow. When compact, a small min-height reserves
  // a visible slot without ever clipping a larger ad AdSense serves (min-height
  // only guarantees a floor — a taller responsive creative still grows).
  const baseStyle = {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
  }
  if (compact) {
    baseStyle.minHeight = '50px'
  }
  const mergedStyle = { ...baseStyle, ...(style || {}) }

  // Whether we should render the real production ad unit in this render.
  const showReal = ADSENSE.ENABLED && enabled && !import.meta.env.DEV && ADSENSE_READY && !!adSlot

  // idempotent initialisation. The `pushedRef` guard protects against React
  // StrictMode's double-invoked effects (dev-only) so the same <ins> element
  // is never pushed to AdSense twice.
  useEffect(() => {
    if (!showReal) return
    if (pushedRef.current) return
    if (typeof window === 'undefined') return

    const push = () => {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {
        /* never let AdSense break the app */
      }
      pushedRef.current = true
    }

    if (window.adsbygoogle) {
      // AdSense script already loaded → initialise immediately.
      push()
    } else {
      // Script may still be parsing; queue a short retry after mount.
      const timer = setTimeout(push, 250)
      return () => clearTimeout(timer)
    }
  }, [showReal, adSlot, insRef])

  // Global switch off, or this instance opted out → render nothing at all.
  if (!ADSENSE.ENABLED || !enabled) {
    return null
  }

  // Local development → clear, labelled placeholder. In compact mode the strip
  // is visibly slimmer (small min-height, single line) so it previews the exact
  // compact footprint seen on a phone without requesting production ads.
  if (import.meta.env.DEV) {
    return (
      <div
        className={[
          'ad-placeholder',
          compact ? 'ad-placeholder--compact' : '',
          className,
        ].join(' ').trim()}
        style={style}
        data-ad-slot={adSlot}
      >
        <span className="ad-placeholder-title">ADVERTISEMENT</span>
        {!compact && <span className="ad-placeholder-sub">AdSense Preview</span>}
      </div>
    )
  }

  // Production but misconfigured (no publisher id / invalid) → render nothing.
  if (!ADSENSE_READY || !adSlot) {
    return null
  }

  // Production ad unit. Note: compact intentionally does NOT set a fixed or
  // clipped height here. Google's "auto" responsive engine picks the right
  // creative for the viewport, and hard-capping it would distort/hide a real ad
  // AdSense serves. The compact strip trims chrome (see MobileBottomAd) while
  // AdSense remains fully in control of the actual ad box height.
  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`.trim()}
      style={mergedStyle}
      data-ad-client={ADSENSE.CLIENT_ID}
      data-ad-slot={adSlot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  )
}
