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
import ZoomLayer from './components/ZoomLayer.vue'
import DemoCaps from './components/DemoCaps.vue'
import DemoHearts from './components/DemoHearts.vue'
import DemoTheme from './components/DemoTheme.vue'
import DemoLint from './components/DemoLint.vue'
import DemoLoading from './components/DemoLoading.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    // the fastfetch panel replaces the stock hero on pages with `layout: home`
    'home-hero-before': () => h(FetchBanner),
    // the "open in full" buttons on tables and diagrams, and the dialog they open
    'layout-bottom': () => h(ZoomLayer),
  }),
  // small interactive examples, used from markdown as <DemoCaps /> and so on
  enhanceApp({ app }) {
    for (const [name, c] of Object.entries({ DemoCaps, DemoHearts, DemoTheme, DemoLint, DemoLoading })) app.component(name, c)
  },
} satisfies Theme
