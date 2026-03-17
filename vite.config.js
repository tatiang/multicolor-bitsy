import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let lastCommitTime
try {
  lastCommitTime = execSync('git log -1 --format=%cI').toString().trim()
} catch {
  lastCommitTime = new Date().toISOString()
}

export default defineConfig({
  plugins: [react()],
  base: '/multicolor-bitsy/',
  define: {
    __BUILD_TIME__: JSON.stringify(lastCommitTime),
  },
})
