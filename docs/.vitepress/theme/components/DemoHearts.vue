<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'

// A slider plays the game and pushes hud.player; the hearts subscribe. The critical threshold
// (health <= 4) and the heartbeat (scale 1.11, two steps, faster at 2) are the shipped page's.
const SHAPE = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000']
const half = (side: 'l' | 'r') => SHAPE.map((row, y) => [...row].map((on, x) =>
  on === '1' && (side === 'l' ? x <= 4 : x > 4) ? `M${x} ${y}h1v1h-1z` : '').join('')).join('')
const LEFT = half('l'), RIGHT = half('r')

const health = ref(13)
const low = computed(() => health.value <= 20 / 3)
const critical = computed(() => health.value > 0 && health.value <= 4)
</script>

<template>
  <DemoFrame en="The slider is the game, the hearts are the page" ru="Ползунок — это игра, сердца — это страница" v-slot="{ ru }">
    <div class="hearts" :class="{ 'is-low': low, 'is-critical': critical, 'is-faster': health <= 2 }">
      <div class="hearts-stage">
        <div class="hearts-edge" aria-hidden="true"></div>
        <div class="hearts-row" role="img" :aria-label="`${health} / 20`">
          <svg v-for="i in 10" :key="i" viewBox="0 0 9 8" shape-rendering="crispEdges">
            <path :d="LEFT" :fill="health >= (i - 1) * 2 + 1 ? '#e06a50' : '#2a2a33'" />
            <path :d="RIGHT" :fill="health >= (i - 1) * 2 + 2 ? '#e06a50' : '#2a2a33'" />
          </svg>
        </div>
      </div>
      <label class="fv-demo-row">
        <span>{{ ru ? 'Здоровье' : 'Health' }}</span>
        <input v-model.number="health" type="range" min="0" max="20" step="1">
        <output>{{ health }} / 20</output>
      </label>
      <pre class="fv-demo-json"><span class="k">hud.player</span> { health: <b>{{ health }}</b>, maxHealth: <b>20</b>, hunger: <b>7</b>, armor: <b>13</b>, … }
<span class="k">hud.status</span> { lowHealth: <b>{{ low }}</b>, critical: <b>{{ critical }}</b>, … }</pre>
    </div>
  </DemoFrame>
</template>
