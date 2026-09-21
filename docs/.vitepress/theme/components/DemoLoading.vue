<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'

// The five phases on one clock, the way ?demo=loading&phase=all plays them: boot 14 s, datapack
// 2 s, connect 3 s, level 6 s, terrain 2 s. Played four times faster here, never on its own.
const PHASES = [
  { id: 'boot', s: 14, bar: true, stage: 'Preparing resources' },
  { id: 'datapack', s: 2, bar: false, stage: 'Loading data packs' },
  { id: 'connect', s: 3, bar: false, stage: 'Connecting to the server', cancel: true },
  { id: 'level', s: 6, bar: true, stage: 'Loading world' },
  { id: 'terrain', s: 2, bar: false, stage: 'Loading terrain' },
]
const TOTAL = PHASES.reduce((n, p) => n + p.s, 0)
const t = ref(0)
const playing = ref(false)
let raf = 0, last = 0

const now = computed(() => {
  let at = t.value
  for (const p of PHASES) { if (at < p.s || p === PHASES[PHASES.length - 1]) return { p, f: Math.min(1, at / p.s) }; at -= p.s }
  return { p: PHASES[0], f: 0 }
})
const progress = computed(() => (now.value.p.bar ? Math.round(now.value.f * 100) / 100 : 0))
function tick(ms: number) {
  t.value = Math.min(TOTAL, t.value + ((ms - last) / 1000) * 4)   // animate against elapsed time, not per frame
  last = ms
  if (t.value >= TOTAL) { playing.value = false; return }
  raf = requestAnimationFrame(tick)
}
function toggle() {
  if (playing.value) { playing.value = false; cancelAnimationFrame(raf); return }
  if (t.value >= TOTAL) t.value = 0
  playing.value = true; last = performance.now(); raf = requestAnimationFrame(tick)
}
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <DemoFrame en="One stream, five phases" ru="Один поток, пять фаз" v-slot="{ ru }">
    <div class="loading">
      <ol class="loading-phases">
        <li v-for="p in PHASES" :key="p.id" :class="{ 'is-on': p === now.p }"><code>{{ p.id }}</code></li>
      </ol>
      <div class="loading-stage">
        <p class="loading-title">{{ now.p.stage }}</p>
        <div class="loading-bar" :class="{ 'is-indeterminate': !now.p.bar }"><i :style="{ width: now.p.bar ? progress * 100 + '%' : '100%' }"></i></div>
        <p class="loading-pct">{{ now.p.bar ? Math.round(progress * 100) + ' %' : (ru ? 'без процентов' : 'indeterminate') }}<span v-if="now.p.cancel"> · actions: ["cancel"]</span></p>
      </div>
      <div class="fv-demo-row">
        <button type="button" class="fv-demo-btn" @click="toggle">{{ playing ? (ru ? 'пауза' : 'pause') : (ru ? 'играть' : 'play') }}</button>
        <input v-model.number="t" type="range" min="0" :max="TOTAL" step="0.1" :aria-label="ru ? 'Перемотка, секунды' : 'Scrub, seconds'" @input="playing && toggle()">
        <output>t={{ t.toFixed(1) }}</output>
      </div>
      <pre class="fv-demo-json"><span class="k">loading.info</span> { phase: <b>"{{ now.p.id }}"</b>, … }
<span class="k">loading.progress</span> { progress: <b>{{ progress }}</b>, indeterminate: <b>{{ !now.p.bar }}</b>, stage: <b>"{{ now.p.stage }}"</b>, done: <b>{{ now.f >= 1 }}</b> }</pre>
    </div>
  </DemoFrame>
</template>
