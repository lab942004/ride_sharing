import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// dist output lives next to this config file
const root = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(root, 'dist')

// Generates robots.txt + sitemap.xml into the build output so search engines
// can discover and index every page of the SPA. Uses VITE_APP_URL (see
// frontend/.env.example) for the site's absolute base URL.
function seoStaticFiles(appUrl) {
  return {
    name: 'seo-static-files',
    apply: 'build',
    closeBundle() {
      mkdirSync(distDir, { recursive: true })

      const routes = [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/about', priority: '0.8', changefreq: 'monthly' },
        { path: '/login', priority: '0.4', changefreq: 'monthly' },
        { path: '/register', priority: '0.6', changefreq: 'monthly' },
        { path: '/forgot-password', priority: '0.2', changefreq: 'yearly' },
        { path: '/create-ride', priority: '0.7', changefreq: 'weekly' },
        { path: '/request', priority: '0.5', changefreq: 'weekly' },
        { path: '/chat', priority: '0.5', changefreq: 'weekly' },
        { path: '/profile', priority: '0.3', changefreq: 'monthly' },
      ]

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${appUrl}${r.path === '/' ? '/' : r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

      const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Block nothing user-facing — everything should be indexed.
Sitemap: ${appUrl}/sitemap.xml
`

      writeFileSync(resolve(distDir, 'robots.txt'), robots)
      writeFileSync(resolve(distDir, 'sitemap.xml'), sitemap)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_APP_URL is the canonical site URL for SEO output. If unset we fall
  // back to localhost so local builds never break — and we inject it into
  // process.env so Vite's HTML %VITE_APP_URL% replacement in index.html works
  // even without a frontend/.env file present.
  const appUrl = (env.VITE_APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
  if (!process.env.VITE_APP_URL) {
    process.env.VITE_APP_URL = appUrl
  }

  return {
    plugins: [react(), seoStaticFiles(appUrl)],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true,
        },
      },
    },
  }
})
