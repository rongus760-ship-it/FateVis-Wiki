<script setup lang="ts">
import { computed, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'

// A cut-down copy of the limitations lint: a dozen rules of the table on this page, matched per
// line. The real one is tools/check-quirks.mjs and the in-game code panel.
const RULES: [string, 'error' | 'warn', RegExp, string][] = [
  ['css.has', 'error', /:has\(/, 'stylo 0.20 drops the whole rule containing :has(), not only the selector'],
  ['css.container', 'error', /@container/, 'container queries are off in servo 0.5: @container never matches'],
  ['css.border-image', 'error', /border-image/, 'border-image draws nothing: a nine slice is a sprite at an integer scale'],
  ['css.backdrop-filter', 'warn', /backdrop-filter/, 'no backdrop-filter: bake the blur or let the Java pass draw it'],
  ['css.text-overflow', 'warn', /text-overflow/, 'no text-overflow: clip with overflow hidden or a character budget'],
  ['css.mask', 'warn', /\bmask(-[a-z]+)?\s*:/, 'the mask-* family is unimplemented: use a pre-cut sprite'],
  ['css.clip-path', 'warn', /clip-path/, 'clip-path parses and is never applied: crop the asset'],
  ['css.appearance', 'warn', /appearance\s*:/, 'appearance does nothing: style a div instead of a native control'],
  ['css.user-select', 'warn', /user-select/, 'user-select does nothing: use draggable="false" and a selectstart handler'],
  ['css.auto-fill', 'warn', /auto-fill/, 'auto-fill minmax tracks are mis-sized: use flex-wrap'],
  ['js.waapi', 'error', /\.animate\(/, 'no Web Animations API: use CSS keyframes or a transition'],
  ['js.mouseenter', 'warn', /mouseenter/, 'mouseenter does not fire for the synthetic pointer: use mouseover'],
]
const source = ref(`.card:has(img) { border: 1px solid; }
.title { text-overflow: ellipsis; overflow: hidden; }
.panel { backdrop-filter: blur(8px); }
.grid { display: grid; gap: 8px; }
row.addEventListener('mouseenter', show)`)
const found = computed(() => source.value.split('\n').flatMap((line, i) =>
  RULES.filter(([, , re]) => re.test(line)).map(([id, level, , text]) => ({ line: i + 1, id, level, text }))))
</script>

<template>
  <DemoFrame en="Paste CSS or JS: what Servo 0.5 will silently ignore" ru="Вставьте CSS или JS: что Servo 0.5 молча проигнорирует" v-slot="{ ru }">
    <div class="lint">
      <textarea v-model="source" rows="6" spellcheck="false" :aria-label="ru ? 'Код для проверки' : 'Code to check'"></textarea>
      <ul class="lint-rows" aria-live="polite">
        <li v-if="!found.length" class="is-clean">{{ ru ? 'ни одно из двенадцати правил не сработало' : 'none of the twelve rules matched' }}</li>
        <li v-for="(f, i) in found" :key="i" :class="'is-' + f.level">
          <span class="lint-line">{{ ru ? 'стр.' : 'line' }} {{ f.line }}</span><code>{{ f.id }}</code><span>{{ f.level }}: {{ f.text }}</span>
        </li>
      </ul>
      <p class="fv-demo-note">{{ ru ? 'Упрощённая копия: двенадцать правил из таблицы ниже. Настоящий линтер — tools/check-quirks.mjs и панель кода в игре.' : 'A cut-down copy: twelve rules of the table below. The real lint is tools/check-quirks.mjs and the in-game code panel.' }}</p>
    </div>
  </DemoFrame>
</template>
