# The JS SDK

`@fvui/sdk` is the bridge of [Bridge](/en/fv-ui/bridge) with types, a topic cache, ref counting and a browser mock
on top. Nothing in it is required: a pack can call `window.fvui` directly, as `packs/example/` does.
It exists so a framework page does not reimplement the subscription bookkeeping.

## Packages

| package | what | peer |
|---|---|---|
| `@fvui/sdk` | bridge, signals, topics, pack store, resources, sound, theme, mock | none |
| `@fvui/vue` | `useGame`, `useStore`, `useRes`, `useSignal`, `permissionNeeded` | vue ^3.5 |
| `@fvui/svelte` | `gameStore`, `packStore`, `resStore`, `toStore`, `permissionNeeded` | svelte ^5 |
| `@fvui/react` | `useGame`, `useStore`, `useRes`, `useSignal`, `usePermissionNeeded` | react ^18 or ^19 |

All four are ESM with `.d.ts`, built by tsup, and their version equals `mod_version` in
`mods/gradle.properties`. One number covers the mod, the manifest `fvui` range and the packages.

## Install

Not on npm in 0.1.0. Inside the fv-ui tree they are npm workspaces of `web/`; a pack outside it
takes them by path:

```txt
"dependencies": {
  "@fvui/sdk": "file:../../web/sdk/core",
  "@fvui/vue": "file:../../web/sdk/vue"
}
```

`npm run build` in `web/` has to have run once, because the packages are consumed as their build
output. Replace both with `"^0.1.0"` once they are published.

An adapter is a `file:` dependency of your pack but resolves its framework inside the SDK tree, so
the page can end up with two copies of the framework. Every template sets `resolve.dedupe` in its
Vite config for exactly that; the React one does not work without it.

## Signals

One primitive, wrapped by every adapter:

```txt
interface Signal<T> {
  get(): T
  subscribe(cb: (value: T) => void): () => void
}
```

`derive(signal, map)` is a read-only view of another one. The subscriber count of a topic signal is
the ref count the game sees: the first subscriber sends `state.sub`, the last sends `state.unsub`,
and a sub and an unsub of the same tick cancel out before the bridge call is made. A signal handed
out by `topic(id)` or `storeSignal(key)` is one cached cell per id and keeps its identity for the
life of the page, which is what `useSyncExternalStore` needs; `derive()` does not.

## Bridge

```txt
native                     true in game, false when the mock stands in
call(method, args)         raw bridge method
act(id, args)              game action, rejects with {code, message}
skinAct(action)            flow layout input replayed on the real widgets
loadingAct(action)         presses a button the loading screen already shows
trackIslands(m, measure)   measures island rects per frame and sends the batch when they move
islandRect(el, rest)       rounded bounds of an element, the unit island rects are in
sub(topics) / unsub(ids)   raw subscription, `topic()` is the typed way in
state(key, cb) / on(name, cb)
errorCode(error)           "capability", "limit", "error"
```

## Game data

```txt
topic(id)                  Signal of a topic, typed by the Topics map
setTopic(id, value)        fills a topic locally, for demo pages and mode switches
```

`Topics` in `topics.ts` is hand written, not generated. A mod adds its own with declaration
merging:

```txt
declare module '@fvui/sdk' {
  interface Topics { 'example.counter': number }
}
```

Core ids missing from the map are caught by `tools/check-dk.mjs`, not by a code generator: Gson
output shapes are not introspectable and third-party topics are unknown to us anyway.

An island rect's `kind` says what the game draws into it: `item`, `text`, `face` and `tooltip` on
the HUD view, `entity` and `grid` on the menu view. `text` is one wrapped row of chat or of the tab
list, `face` a player head, `tooltip` a tooltip component the page reserved a box for; see
[The HUD surface](/en/fv-hud/hud-surface).

The SDK also ships the vanilla tooltip as one element every surface mounts, so the frame geometry
exists once:

```js
import { mountTooltip } from '@fvui/sdk'
const off = mountTooltip(host, { unit: () => screen.unit })
```

## Pack store

```txt
storeReady()               resolves with the pack version that wrote the file
storeSignal(key)           Signal of one key, reads the whole file once
setStore(key, value)       writes through, updates the page at once
removeStore(key)
isLimitError(error)        true for a write over 16 KB per value, 256 KB per file or 512 keys
```

The whole file is one round trip, so a key is a plain lookup after the first read. `storeReady()`
is the cue for a page side migration: the version it resolves with is the one that last wrote.

## Capabilities

```txt
gated(id, args)            resolves null instead of rejecting when the grant is missing
isCapabilityError(error)
permissionNeeded           Signal of the id the game last refused, null while nothing is pending
```

The call is never held open across the native consent screen, so a page keeps working and the next
press simply goes through. [Capabilities](/en/fv-ui/capabilities) has the tiers.

## Resources, sound, theme

```txt
resUrl(path)               Signal of a fvui://res/ url, follows res.epoch
resUrls(paths)             res.need for paths the manifest does not list
sound.click(), sound.back(), sound.hover(), sound.music(id)
UI_SOUNDS                  the vanilla ids the sound bridge allows without sound.any
bootTheme(mount)           preset and pack theme from the page url, then mount
setPreset(name), applyTheme(state), PRESETS
```

`sound.hover()` is rate limited and off unless the store key `ui.hoverSound` is set: a sound on
every pointer move is a taste thing. `bootTheme` mounts after the theme file loaded, errored or one
second passed, so a host that never answers does not cost the page its first frame.

## The browser mock

`@fvui/sdk` installs a stand-in when `window.fvui` is missing, which is what makes `npm run dev`
work in a plain browser. It answers `state.sub`, `store.get`, `store.set`, `store.remove` and
`res.need`, and ships a fixture title state, worlds, servers and prefs.

```txt
installMock({ topics, actions })   topic values and action handlers of the page
mockPush(key, value)               push a topic to the page
mockEmit(name, payload)            fire an ordered event, e.g. a mode switch
```

A page tells the two apart with `native`, never by feature detection.

## Adapters

Vue:

```js
const state = useGame('title.state')          // ComputedRef, undefined until the first push
const worlds = useGame('worlds', [])          // with a fallback
const runs = useStore('example.runs', 0)
const url = useRes('minecraft/textures/block/dirt.png')
```

Svelte:

```js
const title = gameStore('title.state')        // readable, $title auto-subscribes in markup
const runs = packStore('example.runs', 0)     // writable, a write goes through store.set
const url = resStore('minecraft/textures/block/dirt.png')
```

React:

```js
const state = useGame('title.state')
const runs = useStore('example.runs', 0)
const url = useRes('minecraft/textures/block/dirt.png')
const needed = usePermissionNeeded()
```

Each adapter is about 30 lines and holds no game knowledge: the cache, the ref counting and the
batching live once in `@fvui/sdk`. Vue releases on `onScopeDispose`, Svelte on the last store
subscriber, React on unmount. The rule is the same in all three: subscribe in the component that
shows the data, not at the root, so the game stops sampling a topic nothing is watching.

## Tests

`npm test` in `web/` runs 26 vitest cases against the mock: ref counting and the cancelling
sub/unsub pair, `seed` filling only unseen topics, the store round trip and the limit rejection,
`gated` on a capability error, the `bootTheme` timeout path, and one subscription per topic in each
of the three adapters.
