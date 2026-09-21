# Layout document and codegen

A layout document is one JSON file describing a whole pack: its surfaces, its elements, where they
sit, what they read and what they do. `@fvui/codegen` turns it into a plain Svelte pack, and the
editor of M8b edits the same file. There is no runtime interpreter: the pack you ship is code, so
what the editor draws and what the game draws are the same components.

```txt
layout.json  --  fvui-codegen build  -->  a Svelte project whose dist/ is the pack
```

Three rules hold everywhere below:

- **`format` is the only compatibility gate.** An unknown one is refused, never guessed or migrated.
- **Nothing is unsupported.** A feature that has not landed is *later* and names the step that ships
  it, in the validator message and in the editor inspector. The generator still refuses to emit it,
  so a pack cannot ship a call that would fail silently at runtime.
- **The set is open.** Element types, action ids and expression calls all grow without a `format`
  bump, see "Growing the format" below.

## 1. The shape

```json
{
  "format": 1,
  "id": "my-pack", "version": "1.0.0", "name": "My Pack", "fvui": ">=0.1.0",
  "meta": { ... },                     editor state, carried through untouched
  "tokens": { "--glow": "#ffb347" },   become theme.css
  "presets": { "high-contrast": {...} },
  "assets": [{ "id": "plate", "file": "art/plate.png", "w": 148, "h": 248, "preload": true }],
  "res": ["minecraft/textures/gui/sprites/icon/language.png"],
  "sounds": { "menu": "sounds/menu.ogg" },
  "backdrop": { "loading": "art/loading-bg.png" },
  "fonts": ["@fontsource/geologica/latin-400.css"],
  "deps": { "@fontsource/geologica": "^5.3.0" },
  "vars": { "picked": "none" },
  "types": { "cobble:ball": { "from": "@cobble/elements", "component": "Ball", "props": ["species"] } },
  "prefabs": { "PlateButton": { "params": [...], "root": {...} } },
  "surfaces": { "title": { "canvas": {...}, "layouts": [...] } }
}
```

`id`, `version`, `name`, `authors`, `license`, `description` and `fvui` feed the generated manifest
verbatim, so the two cannot disagree. `assets[].preload` emits a `<link rel=preload as=image>` tag.
`meta` is the one place editor state lives, so generated code never carries any.

One surface per entry of `PackManifest.SURFACES`: `title`, `loading`, `skin`, `hud`, `editor`. Pause
is not a surface: it is a `skin` layout whose `target.screen` is `PauseScreen`.

## 2. Layouts, stacking and targeting

A surface holds a list of layouts.

```txt
"title": {
  "canvas": { "mode": "fit", "baseW": 1920, "baseH": 1057, "unit": 2 },
  "layouts": [
    { "id": "main", "stack": true, "index": 0, "backgrounds": [...], "focus": {...}, "root": {...} },
    { "id": "april", "requires": "month() == 4 && day() == 1", "priority": 10, "root": {...} }
  ]
}
```

| field | what it does |
|---|---|
| `stack` | the layout draws *together with* the other stacked ones, ordered by `index`, lowest first |
| `index` | stacking order, the layout index of the original |
| `priority` | between exclusive layouts (not stacked): the first match by priority wins |
| `requires` | the layout-wide requirement, the grammar of section 6 |
| `enabled` | a layout switched off stays in the document; `editor.layout.set` flips it (later, M8b step 12) |
| `random` | `{group, oncePerSession}`, one of a group is picked per menu load (later, M12) |
| `target` | which screen the layout answers |
| `timelines` | layout-wide animators, one track set over several elements, section 8 |
| `canvas` | overrides the surface canvas |
| `backgrounds` | the background stack, bottom up |
| `focus` | `{order: [<element id>...], wrap: true}` |
| `title` | custom screen title |
| `root` | the one element whose children are the tree |

Stacked roots become sibling subtrees under one `<Root>` in document order, so a `native` element can
sit between two of ours: "render custom elements behind vanilla" is not a flag here, it is where you
put the element.

`target` is `{screen, id, class, superclass, mod, titleKey, layout, inGame, phase, include, exclude,
custom, replace}`. Every field given has to match.

| field | matches |
|---|---|
| `screen` | the class name the game reports, `PauseScreen`. The original's one string, still accepted |
| `id` | the full class name |
| `class` | a class-name pattern with `*` for anything, `net.minecraft.*.OptionsScreen` |
| `superclass` | any class of the screen's chain, so `OptionsSubScreen` answers a whole family |
| `mod` | mod id of the screen class, by package: `minecraft`, `neoforge` or the vendor's second segment |
| `titleKey` | translation key of the screen title |
| `phase` | one of the five loading phases |
| `include` / `exclude` | universal whitelist and blacklist, exclude wins |
| `replace` | draws instead of that screen, the override behind the advanced toggle |
| `custom` | this layout is a screen of the pack's own, below |

`class`, `superclass` and `mod` read the `classes` and `mod` fields of `SkinScreen`, which the skin
model reports next to the id. A rule naming none of them is the plain class-name form and costs nothing.

### Custom screens

```txt
"target": { "custom": { "id": "credits", "title": "Credits", "allowEsc": true,
                        "pauseGame": false, "popup": true, "worldBackground": false,
                        "overlay": 0.6 } }
```

A custom screen is a layout of the **skin** surface, because a screen is what the skin surface
answers. It is opened by `{ "open": "custom:credits" }`, and the generator puts the six settings into
that call, so the host reads them off the action and no manifest block carries them. `popup` keeps
the frame under it, `worldBackground` keeps the world, and `overlay` is the scrim the screen fills
over either. Esc closes it only with `allowEsc`, because `WebScreen.shouldCloseOnEsc` is false for
every page.

A `layout: "flow"` target is accepted and generates a **mirror** layout with a warning naming M9f:
the flow skins are hand-tuned CSS with servo workarounds and imperative measuring
(`web/menu/src/skin/flow/`), and a generator emitting that CSS would lose them.

`canvas.mode` is how `--u` is computed: `fit` is the FancyMenu autoscale block
(`min(W/baseW, H/baseH) * unit`), `gui` follows the player's GUI scale through the `gui.scale` topic
and falls back to vanilla's own auto scale, `css` pins one unit to one CSS pixel, which is what a HUD
page wants.

## 3. Elements

`{id, type, name, geo, style?, visibleIf?, when?, once?, opacity?, on?, timeline?, children?, ...type fields}`

`id` is six characters of `[a-z0-9]`, minted once and never reused. It is emitted as `data-fv="<id>"`
and it is what the CSS, undo, prefab instances and the hand-edit detection key on. `name` is the
layers panel label and never reaches the generated code.

| type | fields | renders as |
|---|---|---|
| `group` | `clip`, children | `<Box>`, a div. Shapes and progress troughs are a group with `style` |
| `image` | `asset` or `res` or `url`, `fit`, `pixelated`, `alt` | `<Img>` |
| `text` | `text`, `align`, `wrap`, `budget`, `scrim`, `shadow` | `<Text>`; `budget` is a character cap, servo draws no ellipsis |
| `rich` | `source`, `align` | `<Rich>`, plain text until Component to HTML (M10) |
| `button` | `label`, `hoverLabel`, `sprite`, `hoverSprite`, `icon`, `disabled`, `tooltip`, `sound` | `<Button>`, a `div role=button`: servo ignores flex on a real button |
| `slideshow` | `assets`, `duration`, `fade`, `randomize`, `pauseHidden`, `fit` | `<Slideshow>` |
| `ticker` | `lines` or `source`, `interval`, `fade`, `randomize`, `align`, `wrap` | `<Ticker>` |
| `splash` | `source`, `scale`, `bounce`, `rotate` | `<Splash>`, with the vanilla probe auto fit |
| `bar` | `value`, `direction`, `indeterminate` | `<Bar>`, one bound fraction |
| `slider` | `value`, `kind`, `min`, `max`, `step`, `round`, `values`, `label`, `sprite`, `handle`, `store` | `<Slider>` |
| `checkbox` | `checked`, `label`, `sprite`, `checkSprite`, `store` | `<Checkbox>` |
| `input` | `value`, `filter`, `max`, `hint`, `store` | `<Input>` |
| `tooltip` | `text`, `follow`, `target`, `wrap` | `<Tooltip>` |
| `dragger` | `store`, `axis`, children | `<Dragger>`, the offset is saved |
| `cursor` | `asset`, `hotspotX`, `hotspotY`, `scope` | `<Cursor>`, a CSS `cursor: url()` |
| `audio` | `tracks`, `mode`, `loop`, `volume`, `autoplay` | `<Audio>`, draws nothing |
| `music` | `menu`, `world` | `<Music>`, the vanilla music switch, draws nothing |
| `item` | `stack`, `count`, `decorations` | `<Item>`, the island contract |
| `entity` | `entity`, `scale`, `yOffset`, `crouching`, `follow` | `<Entity>`, the island contract |
| `grid` | `spacing` | `<Grid>`, the chunk status grid |
| `native` | `widget` selector, `mode`, `label` | `<Native>`, a vanilla widget mirrored, placed or hidden |
| `prefab` | `prefab`, `args` | the generated prefab component |
| `compass` | `yaw`, `range`, `cardinals`, `needle`, `markers`, `entities` | `<Compass>` over `player.pos`, `hud.markers` and `world.entities` |
| `overlay` | `kind`, `density`, `speed`, `color`, `src` | `<Overlay>`, one decoration overlay in its own box |
| `shader` | `source`, `color` | `<Shader>`, a WebGL surface with a flat fallback |
| `video` | `src`, `poster`, `loop`, `autoplay`, `muted`, `volume`, `fit` | ships with the `-media` native, its poster without it |
| `frame` | `url`, `scroll` | ships, an `fvui://` page only: the bridge origin check refuses the rest |
| `model` | `model` | later: needs a new island kind |

`item`, `entity` and `grid` render only where their host draws them. The editor view has an island
host of its own since M12, so in game they are the real thing in the canvas as well; `item` also
takes an `item` id outright, which is what makes a preview work on the title screen where there is
no inventory to read a slot key from. Outside the game the browser harness still shows a baked icon.

`on.click` and `on.hover` only belong on `group`, `button` and `native`: everything else has no
pointer handler and the validator says which type to put it on.

## 4. Geometry

```txt
"geo": { "anchor": "top-right", "x": -271, "y": 16, "w": 252, "h": 158, "units": "gui" }
```

Nine anchors plus `parent`: `top-left`, `top`, `top-right`, `left`, `center`, `right`,
`bottom-left`, `bottom`, `bottom-right`. `parent` means the origin is the parent's top-left and DOM
nesting does the work. Offsets are signed and always top-left relative even against a right or bottom
anchor, which the anchor class normalizes by writing `right: calc((0 - x - w) * --u)`.

`units` is `gui` (multiples of `--u`), `css` (raw CSS pixels, which pins `--u` to 1 for that element
and its children) or `pct` (percentages of the parent). `w` and `h` may be `"auto"`.

| field | what it does |
|---|---|
| `sticky` | `center` or `edge`: keeps the element's own centre or edge on the anchor point, the only way to centre a box whose width is not known |
| `clamp` | `true` or a margin in GUI units: the element stays on screen. The root runs one pass after layout and after a resize |
| `rotate`, `tiltX`, `tiltY` | degrees, the rotation and tilt grabbers |

Every one of `x`, `y`, `w`, `h`, `rotate`, `tiltX` and `tiltY` may be a binding instead of a number,
which is Advanced Positioning and Advanced Sizing over the one compiler instead of a second
placeholder language.

Emitted CSS is one anchor class plus custom properties:

```txt
.fv-root [data-fv="a3k9pq"] { --x: 740; --y: -43; --w: 148; --h: 248 }
```

A static field lands in `<surface>.layout.css`, a bound one rides an inline `style` on the element.
That a drag is a write of two custom properties and not a recompile is what makes the editor fast, and
it is why geometry lives in its own file.

Geometry owns `transform`, so `style.css` may not set it: rotation, tilt, sticky and the clamp offset
are one chain the generator writes, and a transform timeline track folds into the same chain.

`style` is `{tokens?, css?, class?}`. `css` is checked against what stylo 0.20 does not implement
(`text-overflow`, `appearance`, `user-select`, `mask-*`, `backdrop-filter`, `contain`, `zoom`,
`clip-path`, `border-image`) and against what geometry owns; the first is a warning, the second an
error.

## 5. Bindings

Any string or number field may be an object instead of a literal:

```json
{ "topic": "loading.info", "path": "grid.diameter", "scale": -1, "offset": -11, "fallback": 0 }
{ "topic": "title.state", "path": "player", "format": "hello {}", "fallback": "player" }
```

| field | what it does |
|---|---|
| `topic` | a registered topic id; `path` walks keys and indices under it |
| `store` | a pack store key |
| `lang` | a translation key, read from the label map `title.state` carries |
| `res` | a game resource path, a `fvui://res/` URL that follows `res.epoch` |
| `var` | a document variable |
| `expr` | one expression of the grammar below, for a negation or a comparison |
| `param` | only inside a prefab: the value of one of its parameters |
| `const` | a literal, so a prefab argument can carry one where a binding is expected |
| `format` | positional `{}` only, filled from this binding then `args` |
| `scale`, `offset`, `round` | numbers: multiply, add, then round to this many digits |
| `map` | a value to string table, applied before `format` |
| `fallback` | what an absent value reads as |

`format` is positional and nothing else: there is no expression language inside strings, which is the
pseudo-JSON placeholder trap of the roadmap, and it stays shut. Arithmetic is `scale` and `offset`,
which is what a centred chunk grid (`-d`, `2d`) and a percentage (`x100`) need.

A binding compiles to one store from `@fvui/svelte` and one `$` read, and the generated surface
subscribes each topic exactly once for the whole surface, so a layout that mounts later renders from
a value that is already there.

## 6. `visibleIf`, `when` and `requires`

One frozen grammar, one compiler. The pack embeds the compiled string in a `$derived`, the editor
evaluates the same string with `new Function`, so a condition cannot mean two things.

```txt
expr := or ; or := and ('||' and)* ; and := cmp ('&&' cmp)*
cmp  := unary (('=='|'!='|'<'|'<='|'>'|'>=') unary)? ; unary := '!' unary | primary
primary := number | string | true | false | null | path | call | '(' expr ')'
path := root ('.' ident | '[' int ']' | '[' string ']')*
root := topic | store | var | window | time | pack | session
```

No assignment, no member access outside the roots, no functions of the document's own. `== null` and
`!= null` stay loose, so a missing value reads as absent. `topic.title.state.splash` splits at the
longest known topic id; `topic['my.addon.topic'].field` is the explicit form for an id this toolchain
has not heard of.

Calls: `hour() minute() second() day() month() year() weekday() has(&lt;mod id>) seen(&lt;key>)
contains(a, b) starts(a, b) ends(a, b) lower(s) upper(s) len(x) num(x) abs(n) round(n) min(a, b)
max(a, b)`.

`window` is `{w, h, u, aspect}`, `time` is the system clock (the wall clock, which is what
`is_realtime_hour` reads), `session` is a session flag, `pack` is `{id, version, name}`.

A `time` or `hour()` expression is re-read on a 60 second tick, so a rule on the hour turns when the
hour does.

`visibleIf` toggles `hidden` while the element stays mounted. `when` wraps it in `{#if}`, so its
subscriptions do not exist while it is off: pick `when` for anything with an island or a timer.
`once: "session"` mounts an element once per game session, the `load_once_per_session` of the
original.

## 7. Events, steps and actions

```txt
"on": { "click": [{ "sound": "click" }, { "act": "open", "args": { "screen": "singleplayer" } }] }
```

Events: `click`, `hover`, `mount`, `unmount`, `change` (the value as the handler argument), `tick`,
and `listen`, which hangs off the ordered game event the element's `event` field names:

```json
{ "type": "text", "event": "player.damage", "on": { "listen": [{ "sound": "hit" }] } }
```

A layout listens without an element too, which is the form the editor writes:

```txt
"listen": { "player.damage": [{ "sound": "hit" }], "topic:hud.player": [{ "set": "hp", "value": ... }] }
```

`topic:<id>` fires whenever that topic changes, which is most of the original's 85 listener types
with no channel of its own. [Topics and actions](/en/fv-ui/topics-actions) has the event list.

A step is one of:

| step | what it does |
|---|---|
| `{act, args}` | any registered action id |
| `{sound, pitch, volume}` | `click`, `back`, `hover`, or a full sound id, which needs `sound.any` |
| `{music, fade}` | held by the game across screens; `null` hands music back to vanilla |
| `{store, value}` | writes a pack store key |
| `{set, value}` | writes a document variable |
| `{open}` / `{link}` | sugar over `open` and `link.open` |
| `{skin}` | a `skin.act` payload |
| `{call}` | only inside a prefab: calls one of its `action` parameters |
| `{if, then, else}` | over the grammar of section 6 |
| `{delay, then}` | runs `then` after the seconds |
| `{later, then}` | the same, read as a side branch |
| `{group, then}` | a folder: it only groups in the tree, the steps run in place |
| `{comment}` | a note, emitted as a comment in the generated code |

That is the whole statement set of the original minus `while`, which stays out on purpose (FM#1357):
an infinite loop in a menu script is a hang, and the original caps it at three seconds rather than
refusing it.

Every `act` id maps to the capability it needs and the generator unions them into the generated
`fvui.pack.json`, which closes the trap where a pack that forgets to declare one sees the call fail
with no prompt at all. An id on the NEVER set fails generation with the id and the document path; an
id the format reserves fails with the step that ships it.

Reserved ids, none of them implemented, all of them named so a document can be written against them
and refused with a reason: `pack.file.*` (`read`, `write`, `list`, `delete`, `pick`, always tier
inside `fvui_data/<pack id>/`), `files.*` (`read`, `write`, `copy`, `move`, `rename`, `delete`,
`unzip`, `reveal`, ask tier rooted at the game directory with a deny list), `clipboard.read`,
`net.request`, `media.*` and `music.vanilla`. Every one of those waits on M11, whose distribution
rules decide what a server pack may never be handed, so they read "M12b after M11".
`process.exec` is reserved and declined on purpose: parity 3.3 point 5.

## 8. Timelines

```txt
"timeline": [{ "track": "opacity", "from": 0.02, "to": 1, "delay": 2, "dur": 2.5,
               "ease": "linear", "once": "session", "stagger": 0.15 }]
```

Tracks `opacity`, `x`, `y`, `scale`, `rotate`, `blur`, `var`, plus a raw `keys` track of
`[{t, value, ease}]` whose `value` is a CSS declaration. A `var` track names the custom property it
writes (`{"track": "var", "name": "--fv-glow", "from": 0, "to": 1}`); stylo interpolates an
unregistered custom property discretely, so a var track reads as a switch unless the property it
feeds is itself animated. Servo 0.5 has no Web Animations API and it stays
off on purpose, so tracks compile to `@keyframes` plus one `animation:` shorthand in the
`.layout.css`. Every transform track of one element shares one animation, because there is one
`transform` property.

- `once: "session"` puts the animation under the `.fv-intro` class the root sets from session
  storage: a return from Options draws the whole layout at once.
- `stagger` emits `animation-delay: calc(<delay>s + var(--i) * <stagger>s)` and a `--i` per child, so
  a six row button column is one track and not six.
- `random` spreads the start of each target over that many seconds. The offset is a hash of the
  element id, not a roll per menu load, so the canvas and the pack agree and the golden output is
  reproducible; a per-load roll would need a runtime write on every animated node.
- `ease` is a preset name or a literal `cubic-bezier()` / `steps()` curve. The presets are in
  `web/layout-schema/src/ease.ts`: linear, the four CSS keywords, and sine, quad, cubic, expo and
  back in in/out/in-out, plus `step-start` and `step-end`. The original's Element Animator has none.
- A `@media (prefers-reduced-motion: reduce)` block and a `.fv-reduced` block are always emitted, the
  second because the harness has no desktop preference and `?motion=reduce` has to reach it.

### Animators

```txt
"timelines": [{ "id": "intro", "targets": ["rowone", "rowtwo"],
                "tracks": [{ "track": "opacity", "dur": 0.5, "ease": "back-out", "stagger": 0.12 }] }]
```

A layout-level animator drives several elements at once, which is the Element Animator of the
original. Its `stagger` counts targets in the order they are listed instead of children, and the
offset is resolved into the delay rather than left to `--i`. An element that carries its own
`timeline` *and* sits in an animator gets one merged `animation` shorthand: two rules on the same
selector would silently drop the first.

## 9. Backgrounds

`backgrounds` is a stack, bottom up, and the bottom-most has to be opaque: there is a black backing
layer under it.

| kind | fields | state |
|---|---|---|
| `color` | `color` | ships |
| `image` | `asset`, `fit`, `keepAspect`, `pixelated`, `blur` | ships |
| `slideshow` | `assets`, `duration`, `fade`, `randomize` | ships |
| `animation` | `assets`, `fps` | ships, a frame folder at a frame rate |
| `panorama` | `assets`, `duration` | ships, a CSS cube of six faces in the vanilla order |
| `world` | - | ships: the page keeps a transparent ground and the game draws what is behind it |
| `browser` | `src` | ships, a nested page |
| `shader` | `src` | ships, a WebGL surface; a view without a context falls back to `color` |
| `video` | `src` the clip, `assets[0]` the poster | ships with the `-media` native, the poster without it |

Decoration overlays are a list beside the backgrounds and draw over everything, never hit tested:

```txt
"overlays": ["snow", "lights"]
```

Nine of the ten of the original draw - `confetti`, `firefly`, `fireworks`, `leaves`, `rain`, `snow`,
`lights`, `browser` and `shader` - as one `Overlay` component with a kind, not one element type
each. The buddy pet stays skipped on purpose. The same component is placeable as the `overlay`
element type when an overlay belongs to one box instead of the layout.

`darken` is the vanilla dark overlay. `blur` notes the vanilla blur: stylo has no `backdrop-filter`,
so a blurred ground is a baked image or the game's own pass.

## 10. Prefabs

```txt
"prefabs": { "PlateButton": { "params": [{ "name": "label", "type": "string" },
                                         { "name": "onClick", "type": "action" }],
                              "root": { ...tree, "label": { "param": "label" } } } }
```

Generated as `src/prefabs/PlateButton.svelte` with one typed prop per parameter. An instance is a
`prefab` element carrying `args`, and it owns the root box: the instance's `id`, `anchor` and class
come in as props, everything below keeps the prefab's own ids and geometry in `prefabs.layout.css`.

A parameter is `string`, `number`, `boolean`, `asset`, `assets`, `lines`, `action` or `binding`, and
a `{param}` may stand anywhere a literal would, list and object fields included. The editor ships a
starter library in `web/editor/prefabs/`: Button, Panel, Slideshow, ServerCard and the five SpiffyHUD
icon bars (HeartBar, FoodBar, ArmorBar, AirBar, MountBar) over the M5 `hud.player` topic, which is
why those five are not element types.

Detaching an instance inlines the prefab subtree with its arguments already substituted and fresh
ids; the instance box wins, because that is the box the author dragged.

## 11. Growing the format

None of these is a `format` bump:

- **Element types.** A namespaced type `<ns>:<name>` is either declared in the document's `types`
  block (`{from, component, props}`) or registered by an editor plugin through `registerType`. The
  generator emits the import from `from`: a `./` path is resolved against the pack root, so a hand
  written component in `elements/` becomes `import Clock from '../elements/Clock.vue'` in the
  surface. A `.vue`, `.tsx` or `.jsx` component is mounted through `@fvui/elements`'s `Foreign`
  adapter and its framework, vite plugin and `resolve.dedupe` entry are added to the generated
  project. Either way the generated pack depends on the component and never on a plugin or a panel;
  the in-game way to write one is [Code panel](/en/fv-menu/code-editor).
- **Action ids.** Any registered id works; the generator unions it into `capabilities`.
- **Topics.** `KNOWN_TOPICS` is a registry seeded by the built-in list and filled from
  `api.catalogue`, so an addon's topic splits at the right place.
- **Expression calls.** Adding a call is a minor toolchain change. A document using a call an older
  generator does not know fails validation with `unknown call <name>()` instead of miscompiling, and
  `.fvui-codegen.json` records the call set a document actually used.

## 12. The generated pack

```html
<out>/
  package.json vite.config.ts svelte.config.js tsconfig.json index.html
  .fvui-codegen.json          generator version, document hash, call set, per file hash
  pack/fvui.pack.json         generated: id, version, entries, theme, capabilities, res, sounds
  pack/theme.css              generated from the document tokens and presets
  pack/layout.json            the document itself, so a built pack reopens in the editor
  pack/art/ pack/sounds/      copied assets
  src/main.ts src/mode.ts src/App.svelte src/styles.css
  src/<Surface>.svelte        generated, hand editable
  src/<surface>.layout.css    generated, machine owned
  src/prefabs/<Name>.svelte   generated
  src/vars.ts                 document variables
```

`src/styles.css` carries the default token palette in a `@layer fvui` block: every custom property
`@fvui/elements` reads, so a document that declares no `tokens` still draws in colour. An undefined
custom property is invalid at computed-value time, which renders as black on black, and the pack
theme's plain `:root` beats a layered one without having to match it.

The editor also writes a **loadable** page next to this tree at test in game ([Layout editor](/en/fv-menu/editor)): the same
components compiled in the page, one `page.css`, a `page.js` boot module and the runtime chunk. That
is what the game reads; this tree is what an author edits.

`pack/` rides into `dist/` the way every template does, so `npm install && npm run build` makes
`dist/` the pack. Output is byte identical for one document on any machine: element order is document
tree order, ids come from the document, imports are sorted by module path, one fixed number formatter,
no timestamps and no absolute paths. The generator prints at two spaces itself; `--prettier` runs
prettier when the author has it installed.

## 13. The CLI

```txt
npx fvui-codegen build layout.json out/ [--assets=<dir>] [--deps=workspace|file] [--sdk=<path>]
                                       [--force] [--prettier]
npx fvui-codegen check out/
```

`build` validates, then writes. `--assets` says where the asset files are read from when they do not
sit next to the document. `--deps=file` points `@fvui/sdk`, `@fvui/svelte` and `@fvui/elements` at a
checkout instead of the workspace.

`check` re-hashes every file `.fvui-codegen.json` lists and reports three states:

- all hashes match: a normal edit.
- a `<surface>.layout.css` changed: it is machine owned, so the next build overwrites it and says so.
- a `<Surface>.svelte` changed: that surface is in **keep code**. The next build leaves it alone
  (`--force` overwrites after writing a `.bak`), and geometry and style still regenerate next to it,
  because they only touch the `.layout.css`. In the editor the layers tree and the inspector go
  read-only for structure there.

A pack with no `layout.json` opens read-only: the editor never reverse engineers a document from
code, because nothing it could recover would be reliable. An unknown `format` is refused with both
version numbers.

## 14. FancyMenu concept map

The full inventory is `docs/plans/m8-parity.md`; this is what each concept is here. Nothing in this
table is "not supported": a row that has not landed names its step.

### Elements

| FancyMenu | here | state |
|---|---|---|
| Button (`custom_button`) | `button` with `on.click` | ships; `mimicbutton` is `{act: "open"}` or a `{skin}` press |
| Slider (`slider_v2`) | `slider`, `on.change` sees the value | ships |
| Checkbox | `checkbox` | ships |
| Text Input Field | `input` | ships |
| Tooltip | `tooltip` | ships |
| Item | `item` | ships, an island |
| Block/Item JSON model | `model` | later: needs a new island kind |
| Image | `image`, nine-slice and tint through `style.css` | ships |
| Text (`text_v2`) | `text`, markdown as `rich` | ships; real markdown with Component to HTML, M10 |
| Video (`video`, `video_rinku`) | `video` | ships with the `-media` native, the poster frame without it |
| GLSL shader | `shader`, and the `shader` background and overlay | ships, WebGL with a flat fallback |
| Slideshow | `slideshow` | ships |
| Rectangle and circle shape | `group` with `style` (`background`, `border-radius`) | ships |
| Splash text | `splash` | ships, with the vanilla probe fit |
| Player entity (`player_entity_v2`) | `entity` | ships, an island |
| Browser | the `browser` background and overlay, and the `frame` element for an `fvui://` page | ships |
| Element animator | `timeline` on the element, `stagger` for the per target offset | ships; multi target tracks M8c step 15 |
| Ticker | `ticker` plus `on.tick` | ships |
| Audio (`audio_v2`) | `audio` element, or `{music}` / `{sound}` steps | ships |
| Music controller | `music` | ships for menu music; `music.vanilla` reserved for the world switch |
| Progress bar | `bar` | ships |
| Dragger | `dragger` | ships |
| Cursor | `cursor` | ships |
| Vanilla widget (`vanilla_button`) | `native`, `mode` mirror, place or hide | ships; label and sprite overrides M8c step 13 |
| Drippy vanilla-like loading bar | `bar` bound to `loading.progress` | ships |
| SpiffyHUD icon bars, slot, mirror | `image` plus `group` plus a binding over the M5 HUD topics | ships |
| SpiffyHUD compass | `compass` over `player.pos`, `hud.markers` and `world.entities` | ships |
| SpiffyHUD overlay remover, eraser | a `hud.overlay` rule | later: the remover needs a vanilla overlay rule, the eraser a stencil pass |
| Player entity v1, Video [Rinku] | - | deprecated upstream, not reimplemented |

### Requirements

The 92 FancyMenu requirement families are one grammar here: `visibleIf` on an element, `requires` on
a layout, `{if}` in a script.

| FancyMenu family | here |
|---|---|
| `is_realtime_hour/_minute/_day/_month/_week_day/_year` | `hour()`, `minute()`, `day()`, `month()`, `weekday()`, `year()` |
| `is_mod_loaded` | `has('<mod id>')` |
| `once_per_session` | `seen('<key>')`, `once: "session"` |
| `is_window_width/_height`, `_bigger_than`, `is_fullscreen` | `window.w`, `window.h`, `window.aspect` |
| `is_gui_scale` | `topic['gui.scale'].guiScale` |
| `is_language` | `topic.title.state.language` |
| `is_server_ip`, `is_server_online` | `topic['server.address'].address`, `contains()` |
| `is_multiplayer`, `is_singleplayer`, `is_world_loaded` | `topic['server.address']`, `topic['screen.id']` |
| `is_variable_value` | `var.<name>` |
| `is_number`, `is_text` | the comparison operators, `num()`, `lower()`, `contains()` |
| `is_element_hovered`, `is_button_active` | CSS `:hover` and `:focus`, which need no binding at all |
| `is_menu_title`, `is_any_screen_open`, `is_debug_overlay_enabled` | `topic['screen.id']`, `topic.title.state` |
| player, world, gamemode, effect, biome, dimension, weather, mount, inventory families (about 45) | `topic['player.state']`, `topic['player.pos']`, `topic['player.inventory']`, `topic['world.weather']`, `topic['world.entities']`, `topic['player.gamemode']` |
| `is_entity_nearby`, `is_slot_filled_with` | `contains(pluck(<list>, 'id'), '<id>')` |
| `is_os_*` | `topic.sys.os` |
| `is_resource_pack_enabled` | `contains(topic['res.packs'], '<id>')` |
| `file_exists`, `is_internet_connection_available` | the first is `pack.file.exists` or `files.exists`; the second waits on a network grant that stays never |
| `is_scheduler_running` | page local: the ticker element owns its own timer |

### Actions

| FancyMenu | here |
|---|---|
| `opengui`, `closegui`, `back_to_last_screen` | `{open}`, `{act: "open"}`, `{skin: {action: "back"}}` |
| `loadworld`, `joinserver` | `{act: "world.play"}`, `{act: "server.join"}` |
| `set_variable`, `clear_variables` | `{set}` over `vars` |
| `enable_layout`, `disable_layout`, `toggle_layout` | `Layout.enabled` plus `editor.layout.set`, later M8b step 12 |
| `play_audio`, `stop_all_action_audios`, audio and video element control | `{sound}`, `{music}`, the `audio` element plus `music.next`, `music.prev`, `music.toggle` and `music.volume`; the video half is `media.play`, `media.pause`, `media.seek` and `media.volume` |
| `openlink` | `{link}`, one ask grant plus a per call confirm |
| `copytoclipboard` | `{act: "clipboard.write"}`, ask tier |
| `sendmessage`, `paste_to_chat`, `display_in_chat_client_side` | `{act: "game.chat"}`, ask tier |
| `execute_command_as_integrated_server` | `{act: "game.command"}`, ask tier |
| `quitgame` | `{act: "quit"}`, ask tier |
| `reloadmenu`, `reload_resource_packs` | `{act: "pack.reload"}` and `{act: "resourcepacks.reload"}` |
| `edit_minecraft_option` | `{act: "options.write"}`, ask tier, or the layout's own `options` block |
| `show_toast`, `print_to_log` | `{act: "toast.show"}` and `{act: "log.write"}` |
| `mimicbutton`, `mimic_keybind` | `{skin: {action: "press", id}}`, a `native` selector |
| `manage_resource_pack` | `{act: "resourcepacks.set"}`, ask tier |
| the ten `*_file_in_game_dir` actions, `download_file_to_game_dir`, `select_file_to_game_dir` | `pack.file.*` and `files.*`, reserved under the policy of parity 3.3, M12b after M11 |
| `send_http_request`, the four remote server actions | `net.request` reserved; `net:fetch` and `net:ws` stay on the NEVER set |
| `start_scheduler`, `stop_scheduler` | `{act: "sched.start"}` and `{act: "sched.stop"}` over a ticker element |
| System Interactions addon, process level | `process.exec`, reserved and declined on purpose |
| executable blocks: `if`, `else if`, `else`, `delay`, `execute later`, folder, comment | `{if}`, `{delay}`, `{later}`, `{group}`, `{comment}` |
| `while` | not mapped on purpose (FM#1357): the escape hatch is hand-edited Svelte |

### Placeholders

FancyMenu's 180 placeholders are typed bindings here, because a topic is a shape and not a string.
The groups, with what to bind:

| group | count | here |
|---|---|---|
| Minecraft and mod info (`mcversion`, `loadername`, `loadedmods`, `totalmods`, ...) | 9 | `topic.title.state` and `topic['loading.info']` |
| GUI, input and window (`guiwidth`, `guiscale`, `screenid`, `mouseposx`, ...) | 13 | `window.w` and `window.h`, `topic['gui.scale']`, `topic['screen.id']`, `topic['screen.title']`, `topic['screen.hover']`; the pointer position is page local and needs no binding |
| Real time and date (`realtimehour`, `unix_time`, ...) | 7 | `time.*` and the clock calls |
| Server (`servermotd`, `serverping`, `serverplayercount`, ...) | 5 | `topic.servers[n]`, `topic['server.address']` and `topic['server.ping']` keyed by address. M15 added `address`, `motdHtml`, `motdRuns`, `accent` and `accent2` to a row and moved `icon` from a `data:` url to `fvui://servericon/<key>.png?v=<epoch>`; both are valid `img` sources, so only a document that string matched the prefix has to change |
| Player identity (`playername`, `playeruuid`, `lastdeathmessage`) | 3 | `topic.title.state.player`; the uuid and the death message stay named gaps |
| World and in-game player state (health, hunger, armor, effects, coordinates, boss, biome, ...) | 69 | `topic['hud.player']`, `topic['hud.effects']`, `topic['hud.bossbars']`, `topic['world.time']` for the HUD half, plus the fifteen topics of [Topics and actions](/en/fv-ui/topics-actions) for the rest |
| Audio and video state | 13 | bindings on `media.state`, keyed by the element id: `<id>.playing`, `<id>.position`, `<id>.duration`, `<id>.volume`, `<id>.paused`, `<id>.src`, `<id>.frame` |
| System (`osname`, `javaver`, `fps`, `usedram`, `gpuinfo`, `clipboard_content`, `webtext`, ...) | 19 | `topic.sys` answers the machine half and `topic['loading.progress'].memory` the RAM; `fps`, `clipboard_content` and `webtext` stay named gaps |
| Math, string and data utilities (`calc`, `math_*`, `*_case_text`, `replace_text`, `base64_*`, `json`, `nbt_data_get`, ...) | 42 | `scale`, `offset`, `round`, `format`, `map` on a binding, plus the call set: `lower`, `upper`, `len`, `num`, `abs`, `round`, `min`, `max`, `contains`, `starts`, `ends`. The rest are TODO topics or calls, not format gaps |
| `getvariable` | 1 | `var.<name>` |

A gap in this table is a missing *topic*, not a missing format feature: a new topic is readable the
day it is registered, with no generator change.

The editor carries the same table as a searchable list: the bindings picker has a "placeholder
search" tab keyed by the names of the original, so an author migrating types `playerposx` and gets
the typed binding rather than hunting for a topic path. [Layout editor](/en/fv-menu/editor).

### Layout settings

| FancyMenu | here |
|---|---|
| universal layout, whitelist and blacklist | a layout with no `target`, plus `requires` |
| `layout_index`, stacking | `stack` and `index` |
| `is_enabled`, `.txt.disabled` | `enabled` |
| `randommode`, `randomgroup`, `randomonlyfirsttime` | `random: {group, oncePerSession}`, later M8c |
| `setscale`, `autoscale` with `basewidth`/`baseheight` | `canvas.mode` with `baseW`, `baseH`, `unit` |
| `setopenaudio`, `setcloseaudio` | `on.mount` and `on.unmount` with `{music}` or `{sound}` |
| menu backgrounds, stackable, keep aspect ratio | `backgrounds`, `keepAspect` |
| vanilla background overlay and blur | `darken` and `blur` |
| `custom_menu_title` | `Layout.title`, later M8c step 18 |
| scroll list header and footer textures | later, M8c step 17 |
| screen identifiers, custom GUI screens | `target.screen`, `target.id`, `target.custom`, later M8c step 18 |
| layer groups, collapsed state | `meta`, the layers panel |
| decoration overlays (snow, rain, fireflies, confetti, ...) | `overlays` on a layout, or the `overlay` element; the buddy pet stays skipped |
| vanilla widget customization (hide, move, re-label, textures) | `native` with `mode` and `geo` |
| animations: `.fma`, `.afma`, APNG frame containers | `background.kind: "animation"` over a frame list, or an animated source the engine decodes |
| game intro animation | later, M12 |

## 15. Worked examples

`web/showcase-gen/layout.json` is `web/showcase` as a document: the same title layout, the same
anchors, the same staged fades, the slideshow, the day rule on the music button and the `link.open`
flow. `web/showcase-b-gen/layout.json` is `web/showcase-b`: the loading overlay with its April
variant, the level loading screen with the entity and chunk islands and a chunk grid whose box is a
bound expression, and the pause layout as `native` widgets moved onto the original's grid.

Both were rendered next to the hand written packs in the headless harness at three resolutions; the
residuals are in `.work/m8a/ab.md`.
