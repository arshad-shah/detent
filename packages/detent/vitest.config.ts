import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/unit/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
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
