import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { Agent } from 'node:https'

// Some local networks advertise IPv6 routes that these providers cannot reach.
const locationProxyAgent = new Agent({ family: 4, keepAlive: true })

// Check for local SSL certificate (enables secure context for mobile GPS)
const certKeyPath = path.resolve(__dirname, 'cert.key')
const certCrtPath = path.resolve(__dirname, 'cert.crt')
const hasCert = fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath)
const httpsConfig = hasCert ? {
  key: fs.readFileSync(certKeyPath),
  cert: fs.readFileSync(certCrtPath)
} : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'WorkNest App',
        short_name: 'WorkNest',
        description: 'WorkNest Location-based Service',
        theme_color: '#a855f7',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://ui-avatars.com/api/?name=WN&background=a855f7&color=fff&size=192',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://ui-avatars.com/api/?name=WN&background=a855f7&color=fff&size=512',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    allowedHosts: true,
    proxy: {
      '/_map/style': {
        agent: locationProxyAgent,
        target: 'https://tile.openstreetmap.de',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_map\/style/, ''),
      },
      '/_geo/route': {
        agent: locationProxyAgent,
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        headers: { 'User-Agent': 'WorkNest-LocalDev/1.0', 'Referer': 'http://localhost:5173/' },
        rewrite: path => path.replace(/^\/_geo\/route/, ''),
      },
      '/_map/tiles': {
        agent: locationProxyAgent,
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_map\/tiles/, ''),
      },
      '/_map/fallback': {
        agent: locationProxyAgent,
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_map\/fallback/, '/rastertiles/voyager'),
      },
      '/_geo/photon': {
        agent: locationProxyAgent,
        target: 'https://photon.komoot.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_geo\/photon/, ''),
      },
      '/_geo/nominatim': {
        agent: locationProxyAgent,
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_geo\/nominatim/, ''),
      },
      '/_geo/meteo': {
        agent: locationProxyAgent,
        target: 'https://geocoding-api.open-meteo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/_geo\/meteo/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      },
      // Proxy IP geolocation APIs through same origin (avoids CORS / self-signed cert issues on mobile)
      '/_geo/ipwho': {
        target: 'https://ipwho.is',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/',
      },
      '/_geo/geojs': {
        target: 'https://get.geojs.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/v1/ip/geo.json',
      },
      '/_geo/ipapi': {
        target: 'http://ip-api.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => '/json/?fields=status,city,regionName,country,lat,lon',
      }
    }
  }
})
