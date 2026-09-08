// Site-wide configuration shared by all frontend components.
// The support email is shown in the footer and referenced by the signup
// flow when a user's organization domain isn't registered yet.
export const SITE_NAME = 'RideShare'
export const SITE_TAGLINE = 'Share rides. Split costs. Travel together.'
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'lab.942004@gmail.com'