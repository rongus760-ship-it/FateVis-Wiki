# Bridge

`window.fvui` is the whole page side API. The game serves the script, the page loads it before
anything else:

```html
<script src="fvui://bridge/bridge.js"></script>
```

It is a classic script, not a module: `window.fvui` exists on the next line. Loading it twice is a
no-op.

## Surface

```js
fvui.native                 true in game, the mark of a real bridge
fvui.call(method, args)     one bridge call, returns a Promise
fvui.on(name, cb)           ordered events, returns an unsubscribe function
fvui.state(key, cb)         topic value plus every later push, returns an unsubscribe function
fvui.snapshot()             every topic value this page has seen, an object, for devtools
```

`fvui.state` calls back at once when the key already has a value, so a late subscriber needs no
round trip. `fvui._emit` and `fvui._state` are what the game calls into, not a page API.

## Transport

JS to Java is a `fetch` of `fvui://bridge/call?m=<method>&a=<json args>` with `cache: "no-store"`,
answered asynchronously by the native protocol handler. Java to JS is `evaluate_javascript`
calling `fvui._emit` (ordered events) or `fvui._state` (coalesced last value wins state).

Handlers run on the render thread inside `Engine.pump`, in the middle of a frame. A call is never
held open across a screen, so nothing times out; a rejected call is answered immediately and the
page tries again later.

State pushes are coalesced: at most one `fvui._state({...})` per view per engine spin, latest value
per key. A drag pushing a widget list every frame costs one eval per frame, not one per push.

## Methods

Three are registered on every view by `FvUiApi.attach`:

| method | args | result |
|---|---|---|
| `state.sub` | `{topics: [id, ...]}` | object of the topics that already have a value |
| `state.unsub` | `{topics: [id, ...]}` | `true` |
| `act` | `{id, args}` | whatever the action returns |

`state.sub` both answers with the current values and pushes them. Both paths are needed: a page
subscribes during its own load, and the state channel drops pushes into a document that is not
loaded yet, while the call answer still reaches it. Subscriptions are counted, so two parts of a
page subscribing to one topic keep it alive until both released.

Extra methods the menu view registers: `skin.act` and `menu.rects` ([Surfaces](/en/fv-menu/surfaces)), `loading.act`
([Loading page](/en/fv-menu/loading)), plus `loading.hold` and `loading.shown` while the early window copy is on screen. Every game action goes
through `act`, see [Topics and actions](/en/fv-ui/topics-actions).

A page loses its subscriptions on a document load. The game re-arms nothing for it: after a
`view.load` the page subscribes again from its own startup code.

## Errors

A failed call rejects with an `Error` carrying `code`:

```js
try {
  await fvui.call('act', { id: 'quit' });
} catch (e) {
  console.log(e.code, e.message);
}
```

On the wire that is `{"ok": false, "error": {"code": ..., "message": ...}}`.

| code | when |
|---|---|
| `unknown-method` | no bridge method of that name on this view |
| `unknown-action` | `act` with an id no mod registered |
| `capability` | the action needs consent the pack does not have, see [Capabilities](/en/fv-ui/capabilities) |
| `limit` | a pack store write over a limit, see [Pack format](/en/fv-ui/packs) |
| `bad-args` | missing or malformed arguments |
| `unknown-sound` | `sound.play` with an id that is not in the sound registry |
| `unknown-pack` | `pack.activate` with an unknown id |
| `origin` | the bridge is not reachable from this document, see below |
| `dropped` | the engine stopped while the call was open |
| `error` | anything a handler threw without a code |

## Origin check

A bridge call is answered only when the calling view has a recorded document url with scheme
`fvui:` or an origin on the allowlist. Anything else gets HTTP 403 with `{"code": "origin"}`, no
call reaches Java, and one warn line per view and origin lands in the game log.

The escape hatch for a dev server is a system property:

```sh
./gradlew :menu:runClient -Dfvui.bridge.origin=http://localhost:5173
```

Known gap: a cross-origin iframe inside an `fvui://` page passes the check. Its blast radius is the
pack's own grants.

## Events

`mode` is the only ordered event today. It carries the surface the host switched to:

```js
fvui.on('mode', (e) => {
  // e.mode is "loading", "title" or "skin", e.gen counts switches, e.data is per mode
  document.body.dataset.mode = e.mode;
});
```

Everything else is a topic, see [Topics and actions](/en/fv-ui/topics-actions).

## Outside the game

Loading `fvui://bridge/bridge.js` from a normal browser fails, so a page meant to be developed
outside the game installs a mock on `window.fvui` when it is missing. `native` is the flag to
branch on. The SDK ships one, see [Quick start](/en/fv-ui/quick-start); `packs/example/index.html` has no mock and only runs
in game or in the harness ([Dev workflow](/en/fv-ui/dev-workflow)).
