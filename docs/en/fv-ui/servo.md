# Servo support matrix

Pages run on Servo 0.5.0, not on Chromium. It is a modern engine with holes in specific places, and
the holes are silent: an unimplemented property parses and does nothing. This chapter is the rule
set; `docs/prototype-servo.md` stays the engine record.

`isSecureContext` is true, `structuredClone`, `queueMicrotask`, `MessageChannel` and `MessagePort`,
custom elements, shadow DOM, `MutationObserver`, `ResizeObserver` and `IntersectionObserver` all
work. ES2022 syntax, `fetch` of `fvui://` urls and `@font-face` work.

## Prefs the engine turns on

Off in servo 0.5 by default, set in `native/src/engine.rs`:

```txt
layout_grid_enabled            CSS grid
dom_intersection_observer_enabled
dom_fontface_enabled           @font-face
dom_webgl2_enabled
dom_webgpu_enabled             only in a build with the webgpu feature
```

`FVUI_SERVO_PREFS=name=true,other=12` overrides prefs for an experiment, and
`-PservoPrefs=` passes it to a dev run. That is for trying things out, not for shipping: a pack
cannot set a pref.

## Selectors

| works | does not |
|---|---|
| `:is()`, `:where()`, `&` nesting | `:has()` |

`parse_has` returns false in stylo's servo parser, so a rule containing `:has()` is dropped whole,
including everything in the same rule. There is no partial application and no error.

Container queries are off (`layout_container_queries_enabled` defaults to false and is not set), so
`@container` never matches. Media queries work.

## Unimplemented properties

These parse and are ignored (`servo_pref = "layout.unimplemented"` in stylo 0.20). The ones that
bite a UI:

```txt
appearance, -moz-default-appearance
user-select
text-overflow
scrollbar-width, scrollbar-color
scroll-behavior
overscroll-behavior-x / -y / -block / -inline
backdrop-filter
mask-image, mask-clip, mask-composite, mask-mode, mask-origin,
mask-position-x, mask-position-y, mask-repeat, mask-size, mask-type
contain
counter-increment, counter-reset
color-scheme, forced-color-adjust
touch-action
zoom
font-size-adjust
text-underline-offset, text-underline-position, text-decoration-inset, text-orientation
animation-timeline, animation-composition, animation-range-start, animation-range-end
offset-path
view-transition-name, view-transition-class
position-area, position-try-fallbacks
corner-*-shape, math-depth, math-style
```

Consequences worth saying out loud:

- truncation is a character budget in JS or `overflow: hidden`, never an ellipsis.
- a numbered list built from CSS counters renders without numbers. Number in the markup.
- form controls keep their default look; `appearance: none` does nothing, so style a `div` instead
  of fighting a native control.
- `user-select` does not stop a drag from selecting text. Use `draggable="false"` and a
  `selectstart` handler if it matters.
- anchor positioning, view transitions and scroll driven animation are out.

`clip-path` parses but is not applied either.

## Layout

- grid `repeat(auto-fill, minmax(min(...), 1fr))` tracks are mis-sized. Use flex-wrap.
- a percentage width inside a flex row can collapse. Use fixed px.
- a scroll container inside a column flexbox is not stretched. Set `width: 100%`.
- `display: grid` or `display: flex` on a `<button>` is ignored. Use `div role="button"` with a
  keydown handler.

## Animation and effects

| works | does not |
|---|---|
| CSS keyframes and CSS transitions | Web Animations API, absent on purpose |
| framework transition components (Vue `Transition` and friends) | SMIL, SVG animated inside `<img>` |
| CSS animation of a whole `<svg>` element or its wrapper | inline SVG updated after insertion, by CSS, class, attribute or `setAttribute` |
| replacing a whole `<svg>` node, it is re-rasterized | `canvas` `shadowBlur` |
| canvas 2D, GSAP, lottie canvas renderer | lottie svg renderer, any library detecting WAAPI |
| CSS `filter`, `mix-blend-mode` | `backdrop-filter`, `mask-image` |

`dom_web_animations_enabled` stays off deliberately. With it on the API exists and does nothing, so
a library that feature detects it hands values to a stub and nothing moves at all. Do not use
`motion/mini` or anything else that is WAAPI only.

`filter: blur()` on animated content is re-blurred every frame, about eight times the frame cost
for a drifting backdrop. Bake blurred images instead.

Canvas 2D: `setTransform`, `drawImage` with source sub-rects, `imageSmoothingEnabled = false`,
composite operations including multiply and destination-in, and radial gradients all work.

Four canvas traps, all found building the M15 server cards and all with a one line workaround:

| trap | what happens | do this instead |
|---|---|---|
| `clearRect(x, y, w, h)` | clears the **whole** canvas whatever rect it is given, so a painted face is wiped by a corner cut | `globalCompositeOperation = 'destination-out'` and `fillRect` |
| a second `getContext('2d')` | answers a blank context, so a painted canvas read through a fresh handle comes back empty | keep the one context the first call gave you |
| canvas as a WebGPU texture source | `copyExternalImageToTexture` leaves the texture at zero and logs nothing; a `data:` backed `<img>` behaves the same, `createImageBitmap` and `toBlob` never call back | `getImageData` into a `DataTexture`, which uploads correctly |
| `DataTexture` in three | never uploads at all | set `texture.needsUpdate = true`; only `CanvasTexture` flags itself |

A texture from an `<img>` on a real URL uploads normally.

## Timing and input

- `requestAnimationFrame` runs at a fixed 125 Hz, not at the host frame rate. A page draws about
  four frames per game frame at 60 fps. Animate against elapsed time, never by a per frame step.
- `mouseenter` does not fire for the synthetic pointer moves the game sends. Use `mouseover`.
- Printable keys arrive as `charTyped`; a key press only carries named keys.
- Hiding a view presents a transparent frame immediately, which is why the host keeps the view
  visible across screen switches.

## Media

`<video>` and `<audio>` play only in a native built with `--features media`. That build links 12
more shared libraries (9 GStreamer, 3 GLib) and needs the GStreamer runtime with its plugins on the
player's machine, so it ships as its own optional jar and never as the default: `fv-ui-media`,
installed **instead of** `fv-ui`, Linux only for now. A `media` marker file beside the library is
what `ServoNative.media()` reads; `-Dfvui.media=true` answers for a hand built one.

Without that build every `canPlayType` answers `""`, which is the detection: `@fvui/elements`
probes once, reports it through `media.probe`, and the `video` element draws its poster instead.
The whole answer, native side and page side, is the `media.available` topic
(`{native, probed, types, ok}`), so a pack or the editor can say "install fv-ui-media" instead of
drawing a black box.

Audio in a media build goes to the GStreamer sink and not through OpenAL, so no game volume slider
touches it by itself. The `video` element therefore reads `options.read` on mount and scales its own
volume by the music and master sliders; that is a scale at start and not a live follow, and page
sounds that have to obey the sliders belong in `sound.play`.

Measured on this machine (GStreamer 1.28.5): a VP9 webm with an Opus track plays, `video/webm;
codecs="vp9"` answers `probably` and `video/mp4` answers `""` without an H.264 plugin. One risk that
belongs to the media build and not to us: GStreamer scans the system plugin directory in the game
process, and a plugin that crashes there takes the game with it (seen once with
`/usr/lib/gstreamer-1.0/libgstnvcodec.so`, exit 139 during the registry rebuild). One more reason
the media native is opt in.

## WebGPU and WebGL

| API | state | needs |
|---|---|---|
| WebGPU | supported, on by default | nothing |
| three.js `WebGPURenderer` | supported, cheapest 3D path | nothing |
| WebGL1 and WebGL2 | work, not supported | `__GLVND_DISALLOW_PATCHING=1` in the launcher environment on NVIDIA |
| three.js `WebGLRenderer` | works with a defect | same, and PBR materials render white |

WebGPU needs a secure context and a host to key its thread on, which a custom scheme does not get
by itself; `native/patches/servo-url` gives `fvui://` a real tuple origin, so `navigator.gpu` is
present and `requestAdapter()` answers. Nothing has to be switched on from a page.

WebGL paints into surfman surfaces the game's GL context cannot import, so every frame is read back
and re-uploaded: about +3.4 ms per game frame at 1600x900 with a full screen canvas, and nothing
measurable without one. On NVIDIA the surfman EGL context cannot be created next to the game's GLX
context unless `__GLVND_DISALLOW_PATCHING=1` was in the environment before libGL initialised.
Nothing inside the game is early enough, so it stays a launcher setting and WebGL fails cleanly
without it: `getContext("webgl")` returns null and the log says

```txt
fvui: WebGL disabled: surfman context creation panicked
```

A page that wants 3D therefore prefers WebGPU and treats WebGL as the fallback. `WebGPURenderer`
falls back to WebGL2 silently when `navigator.gpu` is missing, so log the backend:

```js
const renderer = new THREE.WebGPURenderer();
await renderer.init();
fvui.call('dev.log', 'backend webgpu=' + renderer.backend.isWebGPUBackend);
```

Three.js `MeshStandardMaterial` renders blown white on `WebGLRenderer` and correct on
`WebGPURenderer` with the same scene. Avoid PBR materials on the WebGL path.

Swapping the menu page for a 3D page costs +45 to +105 MB RSS. There is no per pack memory budget
yet, so subset fonts and keep one backdrop.

## Checklist before picking a library

- does it use `:has()` anywhere in its stylesheet? The whole rule is dropped.
- does it animate with the Web Animations API, or feature detect it?
- does it rely on `appearance`, `text-overflow` or `scrollbar-*` for its look?
- does it need container queries?
- does it ship its own CSS reset with `color-scheme` or `touch-action`? Harmless, but it will not
  do what the author expected.

The shipped pack and the templates ship no component library on purpose.

## The limitations lint

Every constraint above is also one rule of a table the in-game code panel marks lines with and
`tools/check-quirks.mjs` runs headless, so a pack built outside the game gets the same rows. The
table below is printed from that source (`node tools/check-quirks.mjs --table`) and
`--check-doc` fails when the two drift. **error** means it renders nothing or the call is refused,
**warn** means it renders differently. Neither blocks a save.

```sh
node tools/check-quirks.mjs src/Title.svelte      one file
node tools/check-quirks.mjs                       every pack source in the tree
```

<!-- quirks:begin -->
| rule | where | what | chapter |
|---|---|---|---|
| `css.has` | css | error: stylo 0.20 drops the whole rule containing :has(), not only the selector | [#selectors](#selectors) |
| `css.text-overflow` | css | warn: no text-overflow: clip with overflow hidden or a character budget | [#unimplemented-properties](#unimplemented-properties) |
| `css.backdrop-filter` | css | warn: no backdrop-filter: bake the blur or let the Java pass draw it | [#animation-and-effects](#animation-and-effects) |
| `css.mask` | css | warn: the mask-* family is unimplemented: use a pre-cut sprite | [#unimplemented-properties](#unimplemented-properties) |
| `css.clip-path` | css | warn: clip-path parses and is never applied: crop the asset | [#unimplemented-properties](#unimplemented-properties) |
| `css.appearance` | css | warn: appearance does nothing: style a div instead of a native control | [#unimplemented-properties](#unimplemented-properties) |
| `css.user-select` | css | warn: user-select does nothing: use draggable="false" and a selectstart handler | [#unimplemented-properties](#unimplemented-properties) |
| `css.unimplemented` | css | warn: on the [Servo support matrix](/en/fv-ui/servo) unimplemented list: it parses and is ignored | [#unimplemented-properties](#unimplemented-properties) |
| `css.border-image` | css | error: border-image draws nothing: a nine slice is a sprite at an integer scale | [#unimplemented-properties](#unimplemented-properties) |
| `css.container` | css | error: container queries are off in servo 0.5: @container never matches | [#selectors](#selectors) |
| `css.mix-blend-mode` | css | warn: mix-blend-mode is listed as working but is unverified at GUI scale: check a frame | [#animation-and-effects](#animation-and-effects) |
| `css.blur-anim` | css | warn: blur on animated content re-blurs every frame, about eight times the cost | [#animation-and-effects](#animation-and-effects) |
| `css.auto-fill` | css | warn: auto-fill minmax tracks are mis-sized: use flex-wrap | [#layout](#layout) |
| `css.flex-percent` | css | warn: a percentage width inside a flex row can collapse: use fixed px | [#layout](#layout) |
| `css.button-display` | css | warn: flex and grid on a &lt;button> are ignored: use div role="button" | [#layout](#layout) |
| `js.waapi` | js | error: no Web Animations API: use CSS keyframes or a transition | [#animation-and-effects](#animation-and-effects) |
| `js.motion-mini` | js | error: WAAPI-only and svg-renderer libraries do nothing here: use the canvas renderer | [#animation-and-effects](#animation-and-effects) |
| `js.mouseenter` | js, html | warn: mouseenter does not fire for the synthetic pointer: use mouseover | [#timing-and-input](#timing-and-input) |
| `js.clipboard` | js | error: no clipboard API: the editor path is editor.clipboard.get and editor.clipboard.set | [#timing-and-input](#timing-and-input) |
| `js.exec-command` | js | error: document.execCommand does not exist in servo 0.5 | [#timing-and-input](#timing-and-input) |
| `js.composition` | js, html | warn: no IME composition events: CJK text is typed outside the game | [#timing-and-input](#timing-and-input) |
| `js.idle` | js | error: requestIdleCallback is missing: use a timeout | [#timing-and-input](#timing-and-input) |
| `js.caret-point` | js | error: no pixel to text offset API: a caret cannot be placed from a click by hand | [#timing-and-input](#timing-and-input) |
| `js.range-rects` | js | warn: a sub-node Range returns an empty rect list: measure the whole element | [#timing-and-input](#timing-and-input) |
| `js.worker` | js | warn: the Worker constructor exists but end to end is unproved: keep a main thread path | [#timing-and-input](#timing-and-input) |
| `js.raf-counter` | js | warn: rAF runs at a fixed 125 Hz: animate against elapsed time, never per frame | [#timing-and-input](#timing-and-input) |
| `js.net` | js | error: net:fetch and net:ws are on the NEVER set: read game data as topics | [#checklist-before-picking-a-library](#checklist-before-picking-a-library) |
| `js.svg-attr` | js | warn: an inline &lt;svg> does not update after insertion: replace the whole node | [#animation-and-effects](#animation-and-effects) |
| `html.video` | html | warn: &lt;video> plays only in the media native: give it a poster for the default one | [#media](#media) |
| `html.button-layout` | html | warn: a flex or grid class on a &lt;button> is ignored: use div role="button" | [#layout](#layout) |
| `html.form-control` | html | warn: a native form control keeps its default look: appearance does nothing | [#unimplemented-properties](#unimplemented-properties) |
<!-- quirks:end -->
