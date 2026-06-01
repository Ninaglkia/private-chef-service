// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  site: 'https://ninos-privatechefs.com',
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind(), sitemap()],
});
