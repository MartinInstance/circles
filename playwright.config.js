import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './screenshots/artifacts',
  use: {
    baseURL: 'http://localhost:5173',
    // iPhone 14 Pro viewport
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['list']],
})
