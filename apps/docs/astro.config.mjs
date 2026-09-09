import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://detent.arshadshah.com',
  integrations: [
    starlight({
      title: 'detent',
      description:
        'Tiny zero-dependency drag, reorder and resize for the web. ' +
        'Pointer-based, touch-ready, framework-free.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/arshad-shah/detent' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/detent' },
      ],
      editLink: {
        baseUrl: 'https://github.com/arshad-shah/detent/edit/main/apps/docs/',
      },
      customCss: ['detent/styles.css', './src/styles/custom.css'],
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
