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
 *                             real <ins> unit this trims the surrounding chrome;
 *                             the actual box height is still pinned to 60px by a
 *                             CSS !important rule (see index.css), because
 *                             AdSense rewrites inline heights at runtime.
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
  // never creates horizontal overflow. The ad area defaults to 60px tall; this
  // inline value is a fallback, while the CSS `.adsbygoogle { height: 60px
  // !important }` rule (index.css) is what actually beats AdSense's runtime
  // override. Per-instance values passed via `style` are merged on top.
  const baseStyle = {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    height: '60px',
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

  // Production ad unit. Height is enforced by the CSS !important rule on
  // `.adsbygoogle` (index.css), since AdSense rewrites inline heights to match
  // the responsive creative it serves — without it this box would inflate to
  // hundreds of pixels tall.
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
