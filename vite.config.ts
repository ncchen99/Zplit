import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'

// 不預先快取的檔案（只給社群分享預覽用的大圖）
const PRECACHE_EXCLUDE = new Set(['sw.js', 'index.html', 'cover.webp'])

/**
 * Build 完成後，把 dist 內所有檔案清單與內容 hash 注入 dist/sw.js，
 * 讓 Service Worker 能預先快取整個 App（含延遲載入的頁面）以支援離線使用，
 * 並在每次部署時更換快取版本。
 */
function swPrecache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'zplit-sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return

      const files = (fs.readdirSync(outDir, { recursive: true }) as string[])
        .map((f) => f.split(path.sep).join('/'))
        .filter((f) => fs.statSync(path.join(outDir, f)).isFile())
        .filter((f) => !PRECACHE_EXCLUDE.has(f) && !f.endsWith('.map'))
        .sort()

      const hash = createHash('sha256')
      for (const f of [...files, 'index.html']) {
        hash.update(f)
        hash.update(fs.readFileSync(path.join(outDir, f)))
      }

      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace(
          /const PRECACHE_MANIFEST = \[\];.*$/m,
          `const PRECACHE_MANIFEST = ${JSON.stringify(files.map((f) => `/${f}`))};`,
        )
        .replace(
          /const CACHE_VERSION = 'dev';.*$/m,
          `const CACHE_VERSION = '${hash.digest('hex').slice(0, 12)}';`,
        )
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swPrecache()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Split rarely-changing vendor code into its own long-cached chunks
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/]@?firebase/ },
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
