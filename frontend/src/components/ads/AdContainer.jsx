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
 * @param {string}  format     Ad format ("auto" default).
 * @param {boolean} responsive Full-width responsive flag (default true).
 * @param {string}  className  Extra classes added to the wrapper.
 * @param {object}  style      Extra inline styles for the wrapper.
 * @param {boolean} enabled    Per-instance opt-out (default true).
 */
export default function AdContainer({
  adSlot,
  format = 'auto',
  responsive = true,
  className = '',
  style,
  enabled = true,
}) {
  return (
    <div
      className={`w-full overflow-hidden my-4 ${className}`.trim()}
      style={style}
    >
      <GoogleAd adSlot={adSlot} format={format} responsive={responsive} enabled={enabled} />
    </div>
  )
}
