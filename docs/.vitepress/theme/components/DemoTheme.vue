<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'

// The same tokens the shipped pages read. Values are the shipped presets (theme/tokens.css,
// vanilla.css, hc.css) and packs/example/theme.css.
const PRESETS: Record<string, Record<string, string>> = {
  default: { '--ink': '12, 11, 10', '--panel': '30, 26, 18', '--paper': '#efe8d8', '--dim': '#a39d90', '--glow': '#f2b53e', '--sans': "'Geologica', sans-serif" },
  vanilla: { '--ink': '38, 38, 38', '--panel': '58, 58, 58', '--paper': '#ffffff', '--dim': '#b4b4b4', '--glow': '#ffe95c', '--sans': "'JetBrains Mono', monospace" },
  'high-contrast': { '--ink': '5, 5, 5', '--panel': '14, 12, 8', '--paper': '#ffffff', '--dim': '#e7e2d6', '--glow': '#ffc85a', '--sans': "'Geologica', sans-serif" },
  example: { '--ink': '18, 20, 26', '--panel': '30, 34, 44', '--paper': '#f2efe6', '--dim': '#9aa0ad', '--glow': '#ffb347', '--sans': "'Geologica', sans-serif" },
}
const preset = ref('default')
const glow = ref<string | null>(null)
const vars = computed(() => ({ ...PRESETS[preset.value], ...(glow.value ? { '--glow': glow.value } : {}) }))
const css = computed(() => {
  const own = preset.value === 'example' || glow.value
  if (!own) return `/* preset=${preset.value}: shipped inside fv-menu.jar, no theme.css needed */`
  const v = vars.value
  const keys = preset.value === 'example' ? ['--ink', '--panel', '--paper', '--dim', '--glow'] : ['--glow']
  return `:root {\n${keys.map((k) => `  ${k}: ${v[k]};`).join('\n')}\n}`
})
function pick(p: string) { preset.value = p; glow.value = null }
</script>

<template>
  <DemoFrame en="One theme.css repaints the shipped screens" ru="Один theme.css перекрашивает штатные экраны" v-slot="{ ru }">
    <div class="theme">
      <div class="theme-controls">
        <button v-for="(_, p) in PRESETS" :key="p" type="button" class="fv-demo-btn" :aria-pressed="preset === p" @click="pick(p as string)">{{ p }}</button>
        <label class="theme-glow"><code>--glow</code><input type="color" :value="vars['--glow']" @input="glow = ($event.target as HTMLInputElement).value"></label>
      </div>
      <div class="theme-stage" :style="vars" aria-hidden="true">
        <p class="theme-ver">Java Edition 1.21.1</p>
        <p class="theme-mark">Minecraft</p>
        <p class="theme-splash">Also try Terraria!</p>
        <div class="theme-cols">
          <ul class="theme-rows"><li class="is-on">Singleplayer</li><li>Multiplayer</li><li>Options</li></ul>
          <div class="theme-card"><span>Northern Reach<small>Survival, 2 h ago</small></span><b>Play</b></div>
        </div>
      </div>
      <pre class="fv-demo-json">{{ css }}</pre>
      <p class="fv-demo-note">{{ ru ? 'Значения пресетов взяты из штатного пака; экран — упрощённый набросок, не скриншот.' : 'Preset values are the shipped ones; the screen is a simplified sketch, not a screenshot.' }}</p>
    </div>
  </DemoFrame>
</template>
