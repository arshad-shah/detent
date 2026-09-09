import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts', 'test/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
