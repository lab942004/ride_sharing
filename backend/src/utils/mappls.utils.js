/**
 * Thin client for Mappls (MapmyIndia) autosuggest API.
 *
 * Requires MAPPLS_API_KEY — see backend/.env.example for how to get one.
 * The key is passed as the `access_token` query parameter (Mappls'
 * "static/REST key" auth model — no OAuth token exchange needed).
 *
 * Endpoint: Autosuggest (`/search/places/autosuggest/json`) — free-text
 * query -> a list of candidate places with human-readable labels.
 *
 * NOTE: On the standard (free) sign-up key, the autosuggest response does
 * NOT include lat/lng — the "Location Coordinates" subtemplate of the
 * Place Details API is a PREMIUM offering. This client therefore returns
 * suggestions with just their label (no coordinates), which is all the
 * ride form needs for the same-place-name rejection.
 *
 * Getting a key: https://about.mappls.com/api/ → sign up → Console →
 * create a project/credential → copy the REST API key. Full docs:
 * https://developer.mappls.com/documentation/sdk/rest-apis/
 */
const SEARCH_BASE = 'https://search.mappls.com/search/places/autosuggest/json';
const API_KEY = process.env.MAPPLS_API_KEY;
const REQUEST_TIMEOUT_MS = 5000;

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Mappls responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const suggestionToLabel = (s) =>
  s?.placeName ? `${s.placeName}, ${s.placeAddress || ''}`.replace(/,\s*$/, '') : s?.placeAddress;

/**
 * Forward search / autocomplete against Mappls.
 * `viewbox` (minLng,minLat,maxLng,maxLat) is translated into a center-point
 * `location` bias, which is the form Mappls' autosuggest accepts.
 */
const mapplsSearch = async (query, { limit = 6, viewbox } = {}) => {
  if (!API_KEY) {
    console.error('[mappls] MAPPLS_API_KEY is not set — see backend/.env.example');
    return [];
  }

  const params = new URLSearchParams({ query, access_token: API_KEY });

  if (viewbox) {
    const parts = viewbox.split(',').map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      params.set('location', `${(minLat + maxLat) / 2},${(minLng + maxLng) / 2}`);
    }
  }

  try {
    const data = await fetchWithTimeout(`${SEARCH_BASE}?${params.toString()}`);
    const candidates = (data.suggestedLocations || []).slice(0, limit);

    return candidates
      .map((s) => {
        const label = suggestionToLabel(s);
        return label ? { label } : null;
      })
      .filter(Boolean);
  } catch (err) {
    // Fail open — a Mappls outage/quota exhaustion should degrade to
    // "no results", not break search entirely.
    console.error('[mappls] search failed:', err.message);
    return [];
  }
};

module.exports = { mapplsSearch };