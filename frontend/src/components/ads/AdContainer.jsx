import GoogleAd from './GoogleAd'

/**
 * Full-width, overflow-safe wrapper around a GoogleAd unit.
 *
 * Guarantees:
 *  - Full responsive width that never causes horizontal scrolling.
 *  - Never overlaps surrounding content, buttons, or navigation (it lives in
 *    normal document flow with its own vertical spacing).
 *  - Matches the existing Tailwind spacing rhythm (my-4) and theme.
 *
 * @param {string}  adSlot     Slot id from ADSENSE.
 * @param {string}  format     Ad format ("horizontal" default — smallest
 *                             compact responsive banner; overridable).
 * @param {boolean} responsive Full-width responsive flag (default true).
 * @param {string}  className  Extra classes added to the wrapper.
 * @param {object}  style      Extra inline styles for the wrapper.
 * @param {boolean} enabled    Per-instance opt-out (default true).
 */
export default function AdContainer({
  adSlot,
  // Default to a horizontal (leaderboard-style) responsive banner. This is the
  // smallest appropriate compact banner AdSense supports, sized to fit the fixed
  // ~60–70px reserved strip. It prevents the responsive "auto" engine from
  // serving/expanding a tall creative that would blow up the reserved area.
  format = 'horizontal',
  responsive = true,
  className = '',
  style,
  enabled = true,
}) {
  return (
    <div
      className={`ad-container ${className}`.trim()}
      style={style}
    >
      <GoogleAd adSlot={adSlot} format={format} responsive={responsive} enabled={enabled} />
    </div>
  )
}
