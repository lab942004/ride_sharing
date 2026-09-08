import { useEffect } from 'react'

// ============================================================================
// Per-page SEO metadata manager for the SPA.
//
// Every page in the app calls `usePageMeta(...)` with its own title,
// description, keywords and route path. The hook keeps <title>, meta
// description/keywords, canonical URL and Open Graph tags in sync with the
// current route — the static index.html provides the defaults, and each page
// refines them. This is what makes each route indexable with unique,
// keyword-rich snippets instead of every route sharing the same title tag.
// ============================================================================

const SITE_NAME = 'RideShare'

const upsertMeta = (attr, name, content) => {
  const selector = attr === 'name' ? `meta[name="${name}"]` : `meta[property="${name}"]`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  if (content) el.setAttribute('content', content)
}

export function usePageMeta({ title, description, keywords, path = '/' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    document.title = fullTitle

    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
      upsertMeta('name', 'twitter:description', description)
    }
    if (keywords) upsertMeta('name', 'keywords', keywords)
    if (title) {
      upsertMeta('property', 'og:title', fullTitle)
      upsertMeta('name', 'twitter:title', fullTitle)
    }

    // Canonical + og:url — always the absolute URL for the CURRENT route.
    const canonicalUrl = new URL(path, window.location.origin).href
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)
    upsertMeta('property', 'og:url', canonicalUrl)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE_NAME)
  }, [title, description, keywords, path])
}

export default usePageMeta