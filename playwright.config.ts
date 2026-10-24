import { defineConfig, devices } from '@playwright/test'

// End-to-end tests: the built app in a simulated phone, with the backend answered by e2e/backend.ts
// (nothing reaches the real Supabase). PW_CHROMIUM points at a preinstalled Chromium when there is one.
export default defineConfig({
  testDir: 'e2e',
  // the monkey test (e2e/macaco.monkey.ts) runs only when asked: npm run macaco
  testMatch: process.env.MACACO ? '*.monkey.ts' : '*.e2e.ts',
  fullyParallel: true,
  // the monkey runs once: a retry would be another random run, not the same one
  retries: process.env.CI && !process.env.MACACO ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
