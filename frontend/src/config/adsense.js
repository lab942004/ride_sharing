// ============================================================================
// Centralized Google AdSense configuration.
//
// Uses the exact Publisher ID and Ad Unit ID provided. All placements share the
// single "ride_sharing" responsive ad unit (slot 9364054937).
//
//   Publisher ID : ca-pub-9837776506614641
//   Ad Slot      : 9364054937
//   Ad Unit Name : ride_sharing
//   Ad Format    : auto
//   Responsive   : true
//
// These are used as defaults so the real ad unit is used everywhere without
// any extra configuration. They can still be overridden via VITE_* env vars if
// you ever need to swap accounts without editing code.
//
//   VITE_ENABLE_ADS=true   → global master switch for all ads
// ============================================================================

// Exact values provided by the AdSense dashboard.
const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID
const SLOT = import.meta.env.VITE_ADSENSE_HOME_SLOT

export const ADSENSE = {
  CLIENT_ID: import.meta.env.VITE_ADSENSE_CLIENT_ID || CLIENT_ID,
  HOME_SLOT: import.meta.env.VITE_ADSENSE_HOME_SLOT || SLOT,
  RIDE_LIST_SLOT: import.meta.env.VITE_ADSENSE_RIDE_LIST_SLOT || SLOT,
  RIDE_DETAILS_SLOT: import.meta.env.VITE_ADSENSE_RIDE_DETAILS_SLOT || SLOT,
  SIDEBAR_SLOT: import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT || SLOT,
  MOBILE_BOTTOM_SLOT: import.meta.env.VITE_ADSENSE_MOBILE_BOTTOM_SLOT || SLOT,
  ENABLED: import.meta.env.VITE_ENABLE_ADS === 'true',
}

// True only when ads are turned on AND a valid publisher id is configured.
export const ADSENSE_READY =
  ADSENSE.ENABLED &&
  !!ADSENSE.CLIENT_ID &&
  String(ADSENSE.CLIENT_ID).startsWith('ca-pub-')

