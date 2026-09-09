import { defineConfig, devices } from '@playwright/test';

/**
 * The hostile fixture is a tall page. The viewport is sized to fit it whole so
 * no target ever sits below the fold — engines disagree about whether a mouse
 * event dispatched past the viewport bottom is delivered or clamped, and that
 * difference is the harness's problem, not the library's.
 */
const viewport = { width: 1280, height: 1400 };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: './node_modules/.bin/vite --port 5174 --strictPort',
    port: 5174,
    // Always start a fresh server. Reusing one means silently testing
    // whatever an unrelated dev server happens to be serving on this port,
    // which fails in ways that look like library bugs.
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
  ],
});
