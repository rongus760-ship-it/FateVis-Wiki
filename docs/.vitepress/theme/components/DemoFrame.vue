<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

// The shared shell of the small interactive examples: a quiet panel with a one-line caption.
defineProps<{ en: string; ru: string }>()
const { lang } = useData()
const isRu = computed(() => lang.value.startsWith('ru'))
</script>

<template>
  <figure class="fv-demo">
    <figcaption>
      <span class="fv-demo-tag">{{ isRu ? 'можно потрогать' : 'try it' }}</span>
      <span>{{ isRu ? ru : en }}</span>
    </figcaption>
    <div class="fv-demo-body"><slot :ru="isRu" /></div>
  </figure>
</template>
