import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://detent.arshadshah.com',
  integrations: [
    starlight({
      title: '@arshad-shah/detent',
      // The lockup carries the word, so the header does not repeat it.
      logo: {
        light: './src/assets/lockup.svg',
        dark: './src/assets/lockup-inverse.svg',
        replacesTitle: true,
      },
      description:
        'Drag, reorder and resize for the web. 6.7 KB gzipped, no dependencies, ' +
        'one input path for mouse, touch and pen.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/arshad-shah/detent' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/detent' },
      ],
      editLink: {
        baseUrl: 'https://github.com/arshad-shah/detent/edit/main/apps/docs/',
      },
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: '/icon-180.png' },
        },
        // The brand faces: Bricolage Grotesque for interface, JetBrains Mono
        // for code and measurements.
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href:
              'https://fonts.googleapis.com/css2?' +
              'family=Bricolage+Grotesque:opsz,wght@12..96,300..800&' +
              'family=JetBrains+Mono:wght@400;600&display=swap',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://detent.arshadshah.com/og-image.png',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
      ],
      customCss: ['@arshad-shah/detent/styles.css', './src/styles/custom.css'],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting started', slug: 'guides/getting-started' },
            { label: 'Styling', slug: 'guides/styling' },
            { label: 'Limitations', slug: 'guides/limitations' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'draggable', slug: 'api/draggable' },
            { label: 'sortable', slug: 'api/sortable' },
            { label: 'resizable', slug: 'api/resizable' },
          ],
        },
        {
          label: 'Frameworks',
          items: [
            { label: 'React', slug: 'frameworks/react' },
            { label: 'Svelte', slug: 'frameworks/svelte' },
            { label: 'Web Components', slug: 'frameworks/web-components' },
          ],
        },
      ],
    }),
  ],
});
