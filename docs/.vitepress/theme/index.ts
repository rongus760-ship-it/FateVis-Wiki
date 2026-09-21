import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'

import '@fontsource/geologica/latin-400.css'
import '@fontsource/geologica/latin-500.css'
import '@fontsource/geologica/latin-700.css'
import '@fontsource/geologica/cyrillic-400.css'
import '@fontsource/geologica/cyrillic-500.css'
import '@fontsource/geologica/cyrillic-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/jetbrains-mono/cyrillic-400.css'
import '@fontsource/jetbrains-mono/cyrillic-700.css'

import FetchBanner from './components/FetchBanner.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    // the fastfetch panel replaces the stock hero on pages with `layout: home`
    'home-hero-before': () => h(FetchBanner),
  }),
} satisfies Theme
