import { ADSENSE } from '../../config/adsense'
import GoogleAd from './GoogleAd'

/**
 * Sticky mobile-only advertisement pinned to the bottom edge of the viewport.
 *
 * - Only rendered on mobile/tablet widths (hidden on md+ screens).
 * - `compact` (default true) uses a short horizontal slot so the fixed strip
 *   stays banner-sized instead of allowing an auto-format ad to become tall.
 * - A matching bottom spacer is reserved in MainLayout (pb-[55px] on mobile)
 *   so this ad never covers content, buttons, chat controls, or bottom
 *   navigation, and never blocks scrolling.
 * - Renders nothing when ads are globally disabled.
 */
export default function MobileBottomAd({ enabled = true, compact = true }) {
  if (!ADSENSE.ENABLED || !enabled) {
    return null
  }

  return (
    <div
      className={[
        'md:hidden fixed bottom-0 inset-x-0 z-40',
        'bg-cream/95',
        'border-t border-amber-100',
        // Keep the ad clear of the iPhone home-indicator safe area.
        'pb-safe',
        // Compact strip: no drop shadow and zero vertical padding so the bar is
        // only as tall as the ad itself. Non-compact keeps a subtle shadow.
        compact
          ? 'shadow-none'
          : 'shadow-[0_-2px_16px_rgba(0,0,0,0.08)]',
      ].join(' ')}
    >
      <div
        className={[
          'w-full max-w-full mx-auto overflow-hidden overflow-x-hidden',
          compact ? 'px-1 py-0' : 'px-2 py-1.5',
        ].join(' ')}
      >
        <GoogleAd
          adSlot={ADSENSE.MOBILE_BOTTOM_SLOT}
          format={compact ? 'horizontal' : 'auto'}
          compact={compact}
          style={compact ? { height: '50px', minHeight: '50px' } : undefined}
        />
      </div>
    </div>
  )
}
