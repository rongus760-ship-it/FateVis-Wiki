---
layout: page
title: FateVis
sidebar: false
---

<script setup>
import { onMounted } from 'vue'
import { withBase } from 'vitepress'

// No root locale: send the reader to the language their browser asks for.
onMounted(() => {
  const ru = /^(ru|uk|be|kk)/i.test(navigator.language || '')
  window.location.replace(withBase(ru ? '/ru/' : '/en/'))
})
</script>

<p style="padding: 48px 24px; font-family: var(--vp-font-family-mono)">
  <a href="./en/">English</a> / <a href="./ru/">Русский</a>
</p>
