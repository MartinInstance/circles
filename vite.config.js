import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))
const [major, minor] = version.split('.')
const build = execSync('git rev-list --count HEAD').toString().trim()
const fullVersion = `${major}.${minor}.${build}`

export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(fullVersion),
  },
  build: {
    outDir: 'dist',
    target: 'es2020'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    }
  }
})
