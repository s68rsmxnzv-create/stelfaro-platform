import type { Config } from 'tailwindcss';
import { stelfaroTheme } from '../../packages/ui/tailwind-theme.js';

export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    '../../packages/*/src/**/*.{vue,ts}'
  ],
  theme: {
    extend: {
      ...stelfaroTheme,
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
