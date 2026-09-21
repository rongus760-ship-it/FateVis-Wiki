<script setup lang="ts">
import { ref } from 'vue'
import DemoFrame from './DemoFrame.vue'

// What a gated call looks like from the page: refused at once, a consent screen the game draws,
// and the next press goes through. The rules are the ones of the Capabilities chapter.
type Tier = 'always' | 'ask'
const ACTIONS: { id: string; tier: Tier; declared: boolean; args: string }[] = [
  { id: 'open', tier: 'always', declared: true, args: "{ screen: 'options' }" },
  { id: 'quit', tier: 'ask', declared: true, args: '' },
  { id: 'link.open', tier: 'ask', declared: false, args: "{ url: '…' }" },
]
const grants = ref<Record<string, 'allow' | 'deny' | 'always'>>({})
const asking = ref<string | null>(null)
const log = ref<{ kind: 'page' | 'game' | 'ok' | 'bad'; text: string }[]>([])
const say = (kind: 'page' | 'game' | 'ok' | 'bad', text: string) => { log.value = [...log.value, { kind, text }].slice(-7) }

function press(a: (typeof ACTIONS)[number]) {
  say('page', `fvui.call('act', { id: '${a.id}'${a.args ? ', args: ' + a.args : ''} })`)
  if (a.tier === 'always') return say('ok', '→ true')
  if (!a.declared) {
    say('bad', "→ rejected { code: 'capability' }")
    return say('game', `fvui: pack example asked for ${a.id}, which is not declared in its manifest`)
  }
  const g = grants.value[a.id]
  if (g === 'allow' || g === 'always') return say('ok', '→ true')
  say('bad', "→ rejected { code: 'capability' }")
  if (g === 'deny') return
  say('game', `fvui[menu]: ${a.id} needs consent from example`)
  asking.value = a.id
}
function answer(v: 'allow' | 'deny' | 'always') {
  if (!asking.value) return
  grants.value = { ...grants.value, [asking.value]: v }
  say('game', v === 'always' ? 'grant written to fvui/packs.json' : `${v}, for this session`)
  asking.value = null
}
function reset() { grants.value = {}; asking.value = null; log.value = [] }
</script>

<template>
  <DemoFrame en="A pack page calling three actions" ru="Страница пака вызывает три действия" v-slot="{ ru }">
    <div class="caps">
      <div class="caps-page">
        <p class="caps-manifest">"capabilities": ["state.sub", "open", "quit"]</p>
        <div class="caps-buttons">
          <button v-for="a in ACTIONS" :key="a.id" type="button" class="fv-demo-btn" :disabled="!!asking" @click="press(a)">
            {{ a.id }} <small>{{ a.tier }}{{ a.declared ? '' : (ru ? ', не объявлено' : ', undeclared') }}</small>
          </button>
          <button type="button" class="fv-demo-btn is-quiet" @click="reset">{{ ru ? 'сброс' : 'reset' }}</button>
        </div>
        <div v-if="asking" class="caps-consent" role="dialog" :aria-label="ru ? 'Экран согласия' : 'Consent screen'">
          <p class="caps-consent-who">Example Pack (example) {{ ru ? 'хочет:' : 'wants to:' }}</p>
          <p class="caps-consent-what">{{ ru ? 'выйти из игры' : 'quit the game' }}<br><code>{{ asking }}</code></p>
          <div class="caps-buttons">
            <button type="button" class="fv-demo-btn" @click="answer('allow')">Allow</button>
            <button type="button" class="fv-demo-btn" @click="answer('deny')">Deny</button>
            <button type="button" class="fv-demo-btn" @click="answer('always')">Always allow</button>
          </div>
          <p class="caps-note">{{ ru ? 'Этот экран рисует игра, а не страница. Страница тем временем продолжает работать.' : 'The game draws this screen, not the page. The page keeps running meanwhile.' }}</p>
        </div>
      </div>
      <ol class="fv-demo-log" aria-live="polite">
        <li v-if="!log.length" class="is-empty">{{ ru ? 'нажмите кнопку — здесь появится ответ моста и лог игры' : 'press a button: the bridge answer and the game log show up here' }}</li>
        <li v-for="(l, i) in log" :key="i" :class="'is-' + l.kind">{{ l.text }}</li>
      </ol>
    </div>
  </DemoFrame>
</template>
