// In-memory access-token store for the admin panel.
//
// SECURITY: previously both the access token AND the long-lived (7-day)
// refresh token were stored together in localStorage under 'adminAuth' —
// readable by any JS on the page. For an admin panel (full data access,
// ability to create more admins, delete users/rides/chats) that's a
// full-account-takeover-via-XSS risk. The access token now lives only in
// this module-scoped variable (gone on reload), and the refresh token is an
// httpOnly cookie the browser manages automatically and JS can never read.
let _accessToken = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (token) => { _accessToken = token; };
export const clearAccessToken = () => { _accessToken = null; };
