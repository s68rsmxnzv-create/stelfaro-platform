import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    '../../packages/ui/src/**/*.{vue,ts}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
