# The layout editor

The editor is a pack like any other, shipped inside the core jar and opened as its own view. It
edits a layout document ([Layout document](/en/fv-menu/layout-document)), and the canvas mounts the same `@fvui/elements` components a
generated pack mounts and injects the same generated `.layout.css`, so what is on screen is the
pack. An editor-only rendering path would be a defect, not a feature.

## Opening it

**The editor is off unless an author turns it on.** With no `fvui/editor.json` an ordinary player
sees nothing of it: no key, no pause row, and the editor pack is not registered as a view at all.
Turning it on is one file:

```html
<gamedir>/fvui/editor.json
{"enabled": true}
```

A dev run turns it on with `-Dfvui.editor=true` instead, which `-PdevEditor=true` and
`-PdevM12=true` already set for you. The file is the author's word and wins both ways: an explicit
`{"enabled": false}` keeps the editor off even with the property set, which is the modpack lock.

Once it is on, three ways in:

| way | what |
|---|---|
| `key.fvui.editor` | a key mapping, unbound by default, category `key.categories.fvui` |
| the pause menu | an "Edit layout" row at the bottom left of the pause screen |
| `editor.open` | an action a pack page may call, ask tier, so a pack can carry its own edit button |

All three are no-ops while the editor is off, and `editor.open` refuses with one debug line rather
than a warning, because off is the normal state.

The key mapping needs a note of its own. A vanilla key mapping only fires through `consumeClick`,
which never runs while a screen is open, and every fvui screen answers its own keys and returns
true. So the mapping is also handled on `ScreenEvent.KeyPressed.Pre`, matched against the key the
player bound and cancelled when it hits. It is skipped while the editor is already open and while a
vanilla text field has focus; a text field **inside a page** keeps no focus the game can see, so a
layout with an input element should not bind the editor to a printable key.

## Host and trust

The editor runs on the view `fvuiedit`, whose default pack is `fvui-editor` in the core jar. That is
what makes `Packs.trusted("fvui-editor")` true, and the whole trust story rests on two facts:

1. `EditorHost.url()` builds the page from `Packs.base("fvuiedit")`, never `Packs.url` and never
   `Packs.active`. A player pack that claims the `editor` surface, or a `-Dfvui.dev.pack` active on
   every view, cannot put its own page behind a trusted source.
2. `view.source()` is the jar pack id, so the grant key is the jar pack and not whatever is active.

The page URL is
`fvui://ui-fvuiedit/index.html?pack=<pack id>&unit=<gui scale>&r=<generation>`, plus `&doc=<pack id>`
when reopening a document and `&lock=1` when writing is off.

Because the editor is in core, a menu-only install has an editor and a pack does not have to install
fvhud to get one. The M6 HUD layer editor keeps its own `hudedit` view and its own page, at
`web/hud-editor`, and it is kept on purpose: it is the in-world quick editor, it needs no pack and
no document, and it is one keypress from the game. The main editor owns the document half.

## Actions

Every id below is trusted-only except `editor.open`: the handler checks that the caller is the
`fvuiedit` view and that `Packs.trusted` accepts its source. The declared tier is `always` because
that check, not the tier, is the gate.

| id | tier | what |
|---|---|---|
| `editor.pack.list` | always | `{}` lists the packs, `{id}` lists one pack's files, `{id, stat: true}` adds an `mtime` column |
| `editor.pack.read` | always | `{id, path}` to `{text}` or `{base64}` |
| `editor.pack.write` | always | `{id, path, text|base64, bak?}`, a temp file then an atomic move |
| `editor.pack.create` | always | a new pack directory with a minimal manifest |
| `editor.pack.delete` | always | one file, never the pack root |
| `editor.pack.rename` | always | move one file inside the pack, refuses when the target exists |
| `editor.pack.mkdir` | always | a directory inside the pack |
| `editor.pack.stat` | always | `{id, paths}` to `{files: {path: mtime}}`, a poll and nothing else |
| `editor.pack.assets` | always | copy a file into the pack, or write fresh bytes |
| `editor.preview.reload` | always | `{view, surface?}` to `{generation, full}`; `full` is true while no host has a per surface push |
| `editor.preview.activate` | always | `{view, id}` to `{generation, view}`; switches another view to a pack, which `pack.activate` cannot do because it acts on the caller's view |
| `editor.scale` | always | `{value}` 1 to 4 to `{scale}`; the density of the editor chrome, stored under `ui.editorScale` |
| `editor.layout.set` | always | turn one layout of a pack on or off, effective on the next reload |
| `editor.open` | ask | open the editor, optionally on a pack |
| `editor.close` | always | close the editor screen, which `shouldCloseOnEsc` being false otherwise makes a dead end |
| `editor.clipboard.set` | always | put text on the system clipboard, capped at 64 KB; servo 0.5 has no `navigator.clipboard` |
| `editor.clipboard.get` | always | read the system clipboard back |
| `res.list` | always | texture paths of the loaded resource packs, for the image chooser |
| `sound.list` | always | sound ids the game can play, for the sound chooser |

Sandbox: every path normalises inside `<gamedir>/fvui/packs/<id>/`, `..`, absolute paths and symlinks
are `bad-args`, the extension allowlist is
`.json .js .mjs .css .html .svelte .ts .png .jpg .jpeg .webp .ogg .txt .md .ttf .woff2`, and the
limits are 4 MB per file, 64 MB per pack and 2000 files per pack. `files:write` stays on the NEVER
set and no fourth tier was added.

## The catalogue

`api.catalogue` is a topic, so the pickers follow a mod registering an action late instead of
reading a list written at build time:

```json
{
  topics:   [{ id, tier, about, shape }],
  actions:  [{ id, tier, about }],
  surfaces: ["singleplayer", "multiplayer", ...],
  anchors:  [...]
}
```

`shape` is a cheap description of the last sampled value (`object{a,b,c}`, `array`, `string`,
`number`, `boolean`, or `?` when nothing has been sampled), shown next to the id in the bindings
picker. The ids also feed `KNOWN_TOPICS`, which is what lets a third-party topic parse inside a
`visibleIf` without the `topic['my.addon.id']` escape.

## The switch file

`<gamedir>/fvui/editor.json`, both keys optional:

| key | default | effect |
|---|---|---|
| `enabled` | **false** | true turns the editor on; false is the lock and beats `-Dfvui.editor=true` |
| `files` | true | false keeps the editor readable and refuses every write |

A refused write comes back as `{code: "capability"}`, the editor shows a badge in the menu bar, and
the file is re-read on F6 with the rest of the pack reload, so switching the editor on does not need
a restart. Shipping a modpack with the editor closed is now the default: ship no file at all.

## Panels

| panel | what |
|---|---|
| menu bar | Layout, Edit, Element, Window and Help; the screen id sits on the right, one click copies it |
| layers | document order is layer order, drag to reparent, groups, collapse, an editor-only eye, and a Hidden section that restores a deleted vanilla widget |
| canvas | the compiled document at the target surface size, with the selection outlined rather than lifted |
| | islands (`item`, `entity`, `grid`) are drawn by the game into the rects the canvas reports: the editor view has its own host, so an item stack and an entity are the real ones with glint and animation. An entity needs a world, so on the title screen an `entity` box stays empty and the same layout opened from the pause screen shows the puppet. Outside the game the browser harness falls back to a baked `item.icons` preview |
| inspector | generated from the `FieldSpec` table of `@fvui/layout`, so a new element type gets a panel for free |
| timeline | tracks per element and layout-wide animators, with a scrub bar, Ctrl+T |
| vanilla widgets | on the skin surface: the widget model of the target screen, click a row to place a passthrough |
| loading mock | on the loading surface: the five phases on one clock, driving the real `loading.*` topics |
| HUD layers | on the hud surface: `hud.layers` as placeable `native` elements |
| status bar | surface and layout, selection count, canvas size and scale, grid state, undo depth |

Dialogs: the element palette, the prefab library, Screens and rules, Manage Layouts, Layout Settings,
the preview matrix, the history, the shortcut sheet, the pack file browser, the code editor, and the
four pickers (image, sound, colour, binding).

The left column splits in two on every surface but `title`: the layers tree on top, and the panel
that surface needs under it.

### The timeline

Ctrl+T, or the track count in the inspector. One row per track: kind, from, to, delay, duration,
easing (a preset or a `cubic-bezier()` typed in the field next to it), stagger, randomized spread,
loop, direction and a first-time toggle, plus the bar showing where the track sits. "+ animator"
makes a layout-wide animator over the current selection, which is the Element Animator of the
original editing several targets at once.

Scrubbing is CSS, because servo 0.5 has no Web Animations API: the panel writes the generator's own
delay expression minus the playhead and pauses the animation, so the frame the canvas paints at
1.25 s is the frame the pack paints at 1.25 s and never a second interpolation of the same tracks.
The canvas mounts with `introKey="*"`, so a `first time only` track plays on every mount here while
a shipped pack still plays it once per session.

### The prefab library

`Element > Prefab Library`, Ctrl+Shift+P. Three things in one dialog: the document's own prefabs with
their instance count, their parameter table, place / edit / delete; and the starter library, which
copies an entry into the document with fresh ids and a free name. Edit prefab mounts the prefab tree
on the canvas as a one-off layout, so the tree, the inspector, the timeline and undo are the same
code: a prefab is a document subtree, never a second editor. The status bar says which one is open.

An instance overrides a prefab through its arguments, shown as their own inspector section. Detach
inlines the subtree with the arguments already substituted and stops the copy following the prefab.

### Skins, and the screen under the canvas

A skin layout draws over a vanilla screen, so the canvas needs that screen's widget model. There are
two sources and the panel says which one it is using:

- **live**: the `skin.widgets` the target screen last pushed. The editor is itself a `WebScreen` and
  `SkinRules.NEVER` lists that class, so the game is not holding the target screen while you edit;
  what you get is the last model it pushed, which is the screen you came from.
- **snapshot**: `capture` stores that model in `meta.editor.widgets[<screen>]` of the document. From
  then on the layout is editable with no game running at all, and the editor seeds `skin.widgets`
  from it so a `native` element still mirrors at the right bounds.

`Layout > Screens and rules` opens with **Start from an existing screen**: the screen the game is on,
the ones it showed this session, the ones already captured, and the vanilla names the catalogue
reports. Redesign copies every exported widget of one into a new skin layout as a passthrough at its
own bounds, so the first frame looks like the screen and the author edits a working copy instead of a
blank page. A screen with no widget model yet says so and asks for one capture.

The widget locator lists every exported widget by kind and label. Clicking one places a passthrough
`native` element at the widget's own bounds in mirror mode; the row greys once it is placed. `hide`
places the same selector in hide mode. The selector is `{kind, key, ordinal}` and never the numeric
id, because ids are minted per screen activation and shift (FM#1098).

Overrides of a vanilla widget are the three modes plus one field: `mirror` keeps the vanilla box,
`place` moves it onto the element's box, `hide` drops it, and `text` relabels it without touching its
click behaviour. Nothing needs a new host action, because a skinned screen already hides its own
widgets for the render pass and the page is what draws them.

Flow skins are **later, M9f**. A `layout: "flow"` target generates a mirror layout and says so.

### Screens and rules

`Layout > Screens and rules`. Selector rules on class name, class pattern, superclass, mod id and
title key, the universal include and exclude lists, the custom screens with their six settings, and
the list of saved overrides. [Layout document](/en/fv-menu/layout-document) section 2 has what each field matches.

### The loading mock

On the loading surface, the panel runs the M7 mock timeline: the five phases on one clock, 27
seconds, pushing the real `loading.info` and `loading.progress` keys in the order the game pushes
them. Play, or drag the bar to a second. A progress bar bound to `loading.progress` moves with it,
so there is no "delete the vanilla bar first" step. Each layout's phase target is a select in the
same panel.

The early window is **later, M12h**: `mods/earlywindow` renders a native copy of the page before the
JVM is up and its colours live in a separate options file, so it is not this document.

### The HUD

The `hud` surface edits like any other: elements, prefabs, timeline, bindings and the preview matrix.
The HUD layers panel lists `hud.layers` and places one as a `native` element with the selector
`{kind: "hud", key: "<layer id>"}`, so a layout can put chrome around what the game draws.

Moving or scaling a vanilla layer works from here too since M12: `HudActions.caller()` accepts the
`fvuiedit` view beside `hudedit` and `hud`, so `hud.layer.set` and `hud.layer.reset` reach
`fvui/hud.json` from the main editor. The in-world quick editor stays for what it is good at, an
edit with the world running and no pack open. A menu-only install has no `hud.layer.*` at all and the
panel says so rather than failing a call.

### Density

The editor is a desktop tool, so its CSS pixel is not the player's GUI pixel: following the GUI scale
drew its 10 px chrome at 30 or 40 device pixels. `EditorScreen.cssScale` reads `ui.editorScale` from
the store, defaulting to one step per screen size (3 above 1400 device pixels tall, 2 above 900, else
1), and `Window > Editor UI Scale`, Ctrl+wheel and Ctrl+plus / Ctrl+minus write it through
`editor.scale`. The host resizes the view and the page comes back at the new CSS size, so nothing in
the page has to know its own scale.

The panel widths are a share of the viewport until the author drags one, so the chrome fits down to
1280x720: at scale 1 that is a 1280x720 CSS viewport, at scale 2 a 640x360 one with the layers tree
and the inspector taking 252 of it.

There is no zoom and no pan: one coordinate system, the real GUI canvas. The canvas only shrinks
when the chrome leaves it no room, and the preview matrix is the honest answer for other
resolutions. Panels toggle from the Window menu and their state rides in `meta.editor` of the
document, so it survives a reload.

### The inspector

One panel generated from the same `FieldSpec` table the validator reads, plus the shared base schema
(anchor, offsets, size, units, sticky, clamp, rotate, tilt, opacity, requirements, once, class) and
the 24 capability flags of `ElementCaps`. The flags hide what a type cannot do instead of offering
it and failing: an `audio` element has no geometry rows because it draws nothing. A multi-selection
shows the intersection of the selected types' schemas with mixed values marked.

A field that takes a binding carries a `~` button and, once bound, a chip naming the source. The
chip is the signal that a field is dynamic, which is the one place the original opens a full screen
editor instead.

The bindings picker has two tabs. **Catalogue** is the live topic list off `api.catalogue`, with the
shape beside each id. **Placeholder search** is the migration path: type the name of a FancyMenu
placeholder and it answers with the typed binding, or with the inspector affordance that replaced it
(a format string, a round, a case toggle), or with the topic the gap waits on. The table is
`web/editor/src/lib/placeholders.ts`; nothing in it is silently missing.

The thirteen audio and video placeholders became bindings in M12b. They all read `media.state`,
which is keyed by element id, so the path is `<id>.position`, `<id>.playing` and so on and the
picker fills the id from the selected element. The `video` and `frame` element types lost their
`later` note in the same step: both come from `BUILTIN_ELEMENTS`, so the palette and the generated
inspector picked them up with no editor change. A `video` still says what it needs - without the
media native ([Servo support matrix](/en/fv-ui/servo)) it draws its poster, and `media.available` is what the canvas reads to
say so.

### Requirements

The builder is groups with ALL and ANY and a per-row IF NOT, compiling to one `visibleIf` string
that stays visible and editable underneath. An expression the builder cannot round-trip is left
alone and shown raw rather than silently rewritten.

"+ from the list of 92" opens the requirement families of the original by name, searchable: picking
one drops a row already filled with the right topic path, leaving only the value to type. Fourteen
of them carry no expression at all, because CSS `:hover`, `:focus` and `:active` answer them, and a
handful carry a named gap instead (a structure the client cannot know, a file read that waits on
M11). The list is `web/editor/src/lib/reqpresets.ts` and a test counts it.

### Scripts

A tree of steps per event (`click`, `hover`, `mount`, `unmount`, `change`, `tick`, `listen`), inline
edit on double click, and an action chooser fed by the catalogue with each id's tier and `about`
next to it. The statement set is the seven of the original minus `while`: `if`/`else`, `delay`,
`later`, a folder and a comment. `listen` needs the element's `event` field, the ordered game event
the script hangs off; a layout-wide listener has no element at all and lives in the layout's
`listen` map.

## Shortcuts

Thirty-six, plus our Ctrl+Shift+Z and Ctrl+D. Ctrl reads as Command throughout. Every canvas
shortcut has a menu entry showing it, so nothing is reachable by shortcut alone; `Help > Shortcuts`
or F1 is the whole sheet.

Canvas: Ctrl+click multi-select, Shift+resize aspect lock, Shift+rotate 45 degrees, Shift+tilt 15,
arrows nudge one unit and Shift+arrows eight, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+S, Ctrl+Z,
Ctrl+Y, Ctrl+Shift+Z, Ctrl+G grid, Ctrl+Shift+G group, Ctrl+Up and Ctrl+Down for the layer order,
Ctrl+E palette, Ctrl+M matrix, O holds the anchor overlay, Delete, F1, F5 test in game, Escape.

**No Ctrl+letter chord reaches a page in servo 0.5.** The native input path forwards named keys only
and GLFW sends no char event while Control is held, so the editor screen routes those chords to the
page instead: `editor.undo` and `editor.redo` for the two the M6 editor already needed, and
`editor.key` carrying `{key, ctrl, shift, alt}` for the rest, matched against the same chord table.
Arrows with modifiers, Home and End, Page Up and Down, Tab, Enter, Backspace, Delete, Alt+Up and
Alt+Down and F1 to F12 do arrive normally, so only the letter chords take that path. A native fix is
queued, and the page keeps working either way because both sources feed one table.

## Undo, autosave and export

Undo is immutable document snapshots with **no step cap**. A count is the wrong knob, so the stack
evicts by total bytes instead, 256 MB by default: a small document gets thousands of steps and a
huge one still cannot eat the heap. A drag or resize snapshots once at the threshold, never per
frame, and stepping the history rebuilds the selection with it.

Autosave writes `layout.json` through `editor.pack.write` two seconds after the last change and on
close, keeping one `.bak`. Escape cancels a drag first and only then asks about closing. Export
writes a store-only zip of the generated pack, source included; import is dropping that zip into
`fvui/packs/` and pressing F6, which is also how a friend's layout arrives.

## Test in game

Generate with `@fvui/codegen` (the same pure `build()` the CLI runs, so the editor and
`npx fvui-codegen` write byte identical trees), write the files through `editor.pack.write`, then
`editor.preview.reload` on the view showing the surface. The in-page Svelte compiler is loaded by a
dynamic import on the first test and never at boot: 884 kB, 117 ms to import and 33 ms to compile a
component inside Servo, measured in `.work/m8b/servo.md`.

What lands is two things at once. The generated **source project** (`src/`, `package.json`, the vite
config) is the hand-editable path and the round trip reads it back. Beside it the editor writes the
**loadable page**, which is what the game reads:

```js
index.html        loads page.css and page.js, nothing else
page.js           the boot module, the loadable twin of src/main.ts
page.css          the runtime sheet, the pack theme, the geometry and the component styles
build/*.js        every surface and prefab, compiled in the page
runtime/*.js      the prebuilt runtime chunk
fvui.pack.json    entries pointing at index.html
```

Nothing in a pack directory resolves a bare specifier, which is the one reason M8b's test in game
still needed a build in that directory. The runtime chunk closes it: `web/editor/runtime/*.ts` builds
`svelte`, `svelte/internal/client`, `svelte/store`, `@fvui/sdk`, `@fvui/svelte` and `@fvui/elements`
into plain ESM files (`npm run build:runtime -w fvui-editor-web`), the editor ships them beside its
own page and copies them into the pack, and the linker rewrites every bare specifier to a relative
path into them. **12 files, 226 kB raw and 71 kB gzipped**, written once per pack.

`src/main.ts` and `src/mode.ts` are TypeScript and would not load as they stand, so `page.js` is
written in their place; the surfaces themselves are `.svelte` and the compiler strips their types.
That is why the source project keeps both files: they are the path for an author who outgrows the
document, not what the game loads.

The order at the end is `editor.preview.reload`, then `editor.preview.activate`, both on the view that
shows the surface. Reload first because a pack the editor just created is not in the manifest list
yet, and activating before the rescan is an `unknown-pack` refusal. And the editor's own action
rather than `pack.activate`, because that one acts on the caller's view by design, which for the
editor is itself: it would reload the editor and drop the open document instead of showing the pack.

## The code editor

`Window > Code Editor` turns the code panel on, `Window > Open Code Editor` opens it, and
`Layout > Open in code editor`, the element context menu row and the Help row open it on a file.
Everything is hidden until the `ui.codeEditor` pack store key is on, and under the modpack lock the
panel is read only and the toggle is off.

It is a pro affordance and it is optional: no element type, layout setting, inspector field or
benchmark of the editor needs it, and nothing else in `web/editor` imports from it, so it is
lazily loaded on first open and its compilers never enter the first paint. What it is - the
highlighted textarea, the servo limitations lint, the Svelte, Vue SFC and TSX backends, the pack
`elements/` folder as `<ns>:<name>` types, and hot reload - is **[Code panel](/en/fv-menu/code-editor)**.

## Strings

The editor's own chrome goes through `t()` in `web/editor/src/lib/i18n.ts`, one flat English table
with the key as the fallback, so a missing entry is visible rather than blank. Translating the
editor is adding a table and calling `setLang`. Game-side text is unaffected: a pack still reads its
strings through `res.lang`, which the game translates.

## Pack layout

The editor writes what the generator writes, so a pack it made is a normal Svelte pack:

```js
fvui/packs/<id>/
  pack/layout.json        the document, the source of truth
  pack/fvui.pack.json     the manifest, generated from it
  pack/theme.css          the tokens
  src/<Surface>.svelte    generated, hand editable
  src/<surface>.layout.css generated geometry
  .fvui-codegen.json      what was written, out of which document
```

A hand-edited `.svelte` puts that surface in keep code: structure editing goes read only there while
geometry and style stay editable, because they only touch the `.layout.css`. The status bar says
which surfaces are in keep code. A pack with no `layout.json` opens read only, so opening a hand
written pack can never destroy it.
