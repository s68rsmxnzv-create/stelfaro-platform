import type { Config } from 'tailwindcss';
import { stelfaroTheme } from '../../packages/ui/tailwind-theme.js';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    '../../packages/billing/src/**/*.{vue,ts}',
    '../../packages/ui/src/**/*.{vue,ts}'
  ],
  theme: {
    extend: stelfaroTheme
  },
  plugins: []
} satisfies Config;
