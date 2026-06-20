import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    '../../packages/billing/src/**/*.{vue,ts}',
    '../../packages/ui/src/**/*.{vue,ts}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
