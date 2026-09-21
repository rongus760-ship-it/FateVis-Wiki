<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// The hero of the home page: a fastfetch panel in the style of Fate's GitHub profile banner.
// The art is the same figlet face (delta_corps_priest_1) drawn as rects, so it needs no font.
const ART = 'M3 1h1v1h-1zM4 0h8v2h-8zM16 1h1v1h-1zM17 0h8v2h-8zM30 0h3v2h-3zM41 1h1v1h-1zM42 0h8v2h-8zM52 1h1v1h-1zM53 0h1v2h-1zM58 0h1v2h-1zM59 1h1v1h-1zM63 1h1v1h-1zM64 0h1v2h-1zM70 1h1v1h-1zM71 0h8v2h-8zM2 2h3v2h-3zM9 2h3v2h-3zM15 2h3v2h-3zM22 2h3v2h-3zM26 2h1v1h-1zM27 2h9v2h-9zM36 3h1v1h-1zM40 2h3v2h-3zM47 2h3v2h-3zM51 2h3v2h-3zM58 2h3v2h-3zM62 2h3v2h-3zM69 2h3v2h-3zM76 2h3v2h-3zM2 4h3v2h-3zM9 4h1v2h-1zM10 4h1v1h-1zM15 4h3v2h-3zM22 4h3v2h-3zM29 4h1v1h-1zM30 4h3v2h-3zM33 4h2v1h-2zM35 4h2v2h-2zM40 4h3v2h-3zM47 4h1v2h-1zM48 4h1v1h-1zM51 4h3v2h-3zM58 4h3v2h-3zM62 4h3v2h-3zM65 4h.5v2h-.5zM69 4h3v2h-3zM76 4h1v2h-1zM77 4h1v1h-1zM1 7h1v1h-1zM2 6h3v2h-3zM5 7h3v1h-3zM15 6h3v2h-3zM22 6h3v2h-3zM30 6h3v2h-3zM36 6h1v1h-1zM39 7h1v1h-1zM40 6h3v2h-3zM43 7h3v1h-3zM51 6h3v2h-3zM58 6h3v2h-3zM62 6h3v2h-3zM65 6h.5v2h-.5zM69 6h3v2h-3zM0 8h2v1h-2zM2 8h3v2h-3zM5 8h3v1h-3zM13 8h1v1h-1zM14 8h11v2h-11zM30 8h3v2h-3zM38 8h2v1h-2zM40 8h3v2h-3zM43 8h3v1h-3zM51 8h3v2h-3zM58 8h3v2h-3zM62 8h3v2h-3zM65 8h.5v2h-.5zM67 8h1v1h-1zM68 8h11v2h-11zM2 10h3v2h-3zM15 10h3v2h-3zM22 10h3v2h-3zM30 10h3v2h-3zM40 10h3v2h-3zM47 10h1v2h-1zM48 11h1v1h-1zM51 10h3v2h-3zM58 10h3v2h-3zM62 10h3v2h-3zM76 10h3v2h-3zM2 12h3v2h-3zM15 12h3v2h-3zM22 12h3v2h-3zM30 12h3v2h-3zM40 12h3v2h-3zM47 12h3v2h-3zM51 12h3v2h-3zM58 12h3v2h-3zM62 12h3v2h-3zM70 13h1v1h-1zM71 12h1v2h-1zM76 12h3v2h-3zM2 14h3v2h-3zM15 14h3v2h-3zM22 14h1v2h-1zM23 14h1v1h-1zM29 15h1v1h-1zM30 14h4v2h-4zM34 14h1v1h-1zM40 14h10v2h-10zM52 14h1v1h-1zM53 14h6v2h-6zM59 14h1v1h-1zM62 14h1v2h-1zM63 14h1v1h-1zM68 15h1v1h-1zM69 14h8v2h-8zM77 14h1v1h-1z'
const W = 79
const H = 16

const { lang } = useData()
const ru = computed(() => lang.value.startsWith('ru'))
const rows = computed(() => ru.value
  ? [
      ['Проект', 'FateVis 0.1.0'],
      ['Моды', 'fv-ui, fv-menu, fv-hud'],
      ['Движок', 'Servo 0.5.0'],
      ['Игра', 'Minecraft 1.21.1'],
      ['Загрузчик', 'NeoForge 21.1'],
      ['Пакеты', 'cargo, gradle, npm'],
      ['Лицензия', 'MIT'],
    ]
  : [
      ['Project', 'FateVis 0.1.0'],
      ['Mods', 'fv-ui, fv-menu, fv-hud'],
      ['Engine', 'Servo 0.5.0'],
      ['Game', 'Minecraft 1.21.1'],
      ['Loader', 'NeoForge 21.1'],
      ['Packages', 'cargo, gradle, npm'],
      ['License', 'MIT'],
    ])
const root = computed(() => (ru.value ? '/ru/' : '/en/'))
</script>

<template>
  <section class="fetch" aria-label="FateVis">
    <div class="fetch-panel">
      <div class="fetch-art">
        <svg :viewBox="`-1 -1 ${W + 3} ${H + 3}`" role="img" aria-label="FateVis" shape-rendering="crispEdges">
          <defs>
            <linearGradient id="fetch-face" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="var(--fv-purple)" />
              <stop offset="1" stop-color="var(--fv-lavender)" />
            </linearGradient>
          </defs>
          <path :d="ART" fill="var(--fv-shadow)" transform="translate(.57 .66)" />
          <path :d="ART" fill="var(--fv-shadow)" transform="translate(.38 .44)" />
          <path :d="ART" fill="var(--fv-shadow)" transform="translate(.19 .22)" />
          <path :d="ART" fill="url(#fetch-face)" />
        </svg>
        <p class="fetch-prompt"><span class="fetch-user">fate</span>@wiki <span class="fetch-dim">~</span> $ <span>{{ ru ? 'главное меню — это веб-страница' : 'the main menu is a web page' }}</span><i class="fetch-cursor" aria-hidden="true"></i></p>
      </div>
      <dl class="fetch-info">
        <div class="fetch-title"><span class="fetch-user">fatevis</span>@<span class="fetch-user">wiki</span></div>
        <div class="fetch-rule" aria-hidden="true">--------------</div>
        <div v-for="[k, v] in rows" :key="k" class="fetch-row"><dt>{{ k }}:</dt><dd>{{ v }}</dd></div>
      </dl>
    </div>
    <div class="fetch-actions">
      <a class="fetch-btn is-main" :href="withBase(root + 'guide/what-is-fatevis')">{{ ru ? 'Что это такое' : 'What is FateVis' }}</a>
      <a class="fetch-btn" :href="withBase(root + 'guide/install')">{{ ru ? 'Установка' : 'Install' }}</a>
      <a class="fetch-btn" :href="withBase(root + 'fv-ui/quick-start')">{{ ru ? 'Сделать пак' : 'Make a pack' }}</a>
      <a class="fetch-btn" href="https://github.com/rongus760-ship-it" rel="noopener">GitHub</a>
    </div>
  </section>
</template>
