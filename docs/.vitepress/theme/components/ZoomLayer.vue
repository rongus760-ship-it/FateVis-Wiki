<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

// "Open in full" for diagrams and tables: a button next to each one, and one dialog in the middle
// of the screen with zoom (buttons, wheel, pinch, + and -) and pan (drag, arrows).
//
// The page content belongs to Vue, so nothing in it is moved or wrapped: the button is a sibling
// put in front of the table or the diagram, and the dialog shows a clone.

const { lang } = useData()
const route = useRoute()
const ru = computed(() => lang.value.startsWith('ru'))
const L = computed(() => ru.value
  ? { open: 'Развернуть', table: 'Таблица', diagram: 'Диаграмма', close: 'Закрыть', zin: 'Приблизить', zout: 'Отдалить', fit: 'Вписать', one: '1:1',
      hint: 'колесо или щипок — масштаб, перетаскивание — сдвиг, Esc — закрыть' }
  : { open: 'Open in full', table: 'Table', diagram: 'Diagram', close: 'Close', zin: 'Zoom in', zout: 'Zoom out', fit: 'Fit', one: '1:1',
      hint: 'wheel or pinch to zoom, drag to pan, Esc to close' })

const open = ref(false)
const kind = ref<'table' | 'diagram'>('table')
const stage = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLElement | null>(null)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
let natural = { w: 0, h: 0 }
let opener: HTMLElement | null = null
const MIN = 0.25, MAX = 6

/* ---------------- the buttons in the page ---------------- */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>'
function decorate() {
  const doc = document.querySelector('.VPDoc .vp-doc, .VPHome .vp-doc')
  if (!doc) return
  const targets = [...doc.querySelectorAll<HTMLElement>('table, .mermaid')]
  for (const el of targets) {
    if (el.closest('.fv-demo') || el.closest('.fv-zoom') || el.dataset.fvZoom) continue
    // the diagram component may swap its element: the bar in front of it is still ours
    if (el.previousElementSibling?.classList.contains('fv-zoom-bar')) { el.dataset.fvZoom = '1'; continue }
    const isTable = el.tagName === 'TABLE'
    if (!isTable && !el.querySelector('svg')) continue            // mermaid has not drawn yet, the observer comes back
    // a small table that fits is left alone: the button is for the ones worth opening
    if (isTable && el.querySelectorAll('tr').length < 6 && el.scrollWidth <= el.clientWidth + 1) continue
    el.dataset.fvZoom = '1'
    const bar = document.createElement('div')
    bar.className = 'fv-zoom-bar ' + (isTable ? 'is-table' : 'is-diagram')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'fv-zoom-btn'
    b.innerHTML = ICON + '<span></span>'
    // resolve the target on click, not now: what stands after the bar is what the reader sees
    b.addEventListener('click', () => { const t = bar.nextElementSibling as HTMLElement | null; if (t) show(t, isTable ? 'table' : 'diagram', b) })
    bar.appendChild(b)
    el.parentNode!.insertBefore(bar, el)
  }
  label()
}
function label() {
  for (const b of document.querySelectorAll<HTMLElement>('.fv-zoom-btn')) {
    b.setAttribute('aria-label', L.value.open); b.title = L.value.open
    b.querySelector('span')!.textContent = L.value.open
  }
}

/* ---------------- the dialog ---------------- */
async function show(el: HTMLElement, k: 'table' | 'diagram', from: HTMLElement) {
  // clone first, before anything is awaited: the diagram component redraws itself when it likes
  let node: HTMLElement
  if (k === 'table') {
    node = el.cloneNode(true) as HTMLElement
    delete node.dataset.fvZoom
  } else {
    const src = el.querySelector('svg')
    if (!src) return
    const svg = src.cloneNode(true) as SVGSVGElement
    const vb = svg.viewBox.baseVal
    if (vb && vb.width) { svg.setAttribute('width', String(vb.width)); svg.setAttribute('height', String(vb.height)) }
    svg.style.maxWidth = 'none'; svg.style.minWidth = '0'
    node = document.createElement('div'); node.className = 'mermaid'
    node.appendChild(svg)
  }
  kind.value = k; opener = from; open.value = true
  // the scroll lock goes on <body>: the diagram plugin watches <html> for a theme change and
  // would redraw every diagram on the page if a class moved there
  document.body.style.overflow = 'hidden'
  await nextTick()
  const host = content.value!
  host.innerHTML = ''
  host.appendChild(node)
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  natural = { w: Math.max(1, host.offsetWidth), h: Math.max(1, host.offsetHeight) }
  fit()
  closeBtn.value?.focus()
}
function hide() {
  if (!open.value) return
  open.value = false
  document.body.style.overflow = ''
  if (content.value) content.value.innerHTML = ''
  opener?.focus(); opener = null
}
function place(s: number, x: number, y: number) { scale.value = Math.min(MAX, Math.max(MIN, s)); tx.value = x; ty.value = y }
function fit() {
  const st = stage.value!; const pad = 24
  const f = Math.min((st.clientWidth - pad * 2) / natural.w, (st.clientHeight - pad * 2) / natural.h)
  // a diagram fills the screen; a table is text, so it is never blown up and never shrunk into dust
  const s = kind.value === 'diagram' ? Math.min(3, f) : Math.min(1, Math.max(0.55, f))
  place(s, (st.clientWidth - natural.w * s) / 2, Math.max(pad, (st.clientHeight - natural.h * s) / 2))
}
function actual() { const st = stage.value!; place(1, Math.max(24, (st.clientWidth - natural.w) / 2), 24) }
function zoomAt(factor: number, cx?: number, cy?: number) {
  const st = stage.value!; const r = st.getBoundingClientRect()
  const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top
  const s = Math.min(MAX, Math.max(MIN, scale.value * factor)); const k = s / scale.value
  place(s, px - (px - tx.value) * k, py - (py - ty.value) * k)       // the point under the cursor stays put
}
function onWheel(e: WheelEvent) { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY) }

const pointers = new Map<number, { x: number; y: number }>()
let pinch = 0, moved = false
function onDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('a') && e.pointerType === 'mouse') return   // a link stays a link
  stage.value!.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) }
}
function onMove(e: PointerEvent) {
  const p = pointers.get(e.pointerId); if (!p) return
  if (pointers.size === 1) { tx.value += e.clientX - p.x; ty.value += e.clientY - p.y; moved = true }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2)
    pinch = d
  }
}
function onUp(e: PointerEvent) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0 }
function onKey(e: KeyboardEvent) {
  if (!open.value) return
  const step = 60
  if (e.key === 'Escape') hide()
  else if (e.key === '+' || e.key === '=') zoomAt(1.25)
  else if (e.key === '-' || e.key === '_') zoomAt(0.8)
  else if (e.key === '0') fit()
  else if (e.key === '1') actual()
  else if (e.key === 'ArrowLeft') tx.value += step
  else if (e.key === 'ArrowRight') tx.value -= step
  else if (e.key === 'ArrowUp') ty.value += step
  else if (e.key === 'ArrowDown') ty.value -= step
  else if (e.key === 'Tab') {                                        // keep the focus inside the dialog
    const f = [...document.querySelectorAll<HTMLElement>('.fv-zoom-bar-top button')]
    const i = f.indexOf(document.activeElement as HTMLElement)
    e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus()
    return
  } else return
  e.preventDefault()
}

let observer: MutationObserver | null = null
let timer = 0
const later = () => { clearTimeout(timer); timer = window.setTimeout(decorate, 120) }
onMounted(() => {
  decorate()
  observer = new MutationObserver(later)                             // mermaid draws after the page is up
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', later)
})
onBeforeUnmount(() => {
  observer?.disconnect(); clearTimeout(timer)
  window.removeEventListener('keydown', onKey); window.removeEventListener('resize', later)
  document.body.style.overflow = ''
})
watch(() => route.path, () => { hide(); nextTick(later) })
watch(ru, () => nextTick(label))
</script>

<template>
  <div v-if="open" class="fv-zoom" role="dialog" aria-modal="true" :aria-label="kind === 'table' ? L.table : L.diagram">
    <div class="fv-zoom-bar-top">
      <span class="fv-zoom-title">{{ kind === 'table' ? L.table : L.diagram }}</span>
      <span class="fv-zoom-hint">{{ L.hint }}</span>
      <button type="button" :aria-label="L.zout" :title="L.zout" @click="zoomAt(0.8)">−</button>
      <output aria-live="off">{{ Math.round(scale * 100) }}%</output>
      <button type="button" :aria-label="L.zin" :title="L.zin" @click="zoomAt(1.25)">+</button>
      <button type="button" class="is-text" @click="fit">{{ L.fit }}</button>
      <button type="button" class="is-text" @click="actual">{{ L.one }}</button>
      <button ref="closeBtn" type="button" class="is-close" :aria-label="L.close" :title="L.close" @click="hide">✕</button>
    </div>
    <div ref="stage" class="fv-zoom-stage" @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove"
         @pointerup="onUp" @pointercancel="onUp" @dblclick="zoomAt(1.6, $event.clientX, $event.clientY)">
      <div ref="content" class="fv-zoom-content vp-doc" :style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"></div>
    </div>
  </div>
</template>
