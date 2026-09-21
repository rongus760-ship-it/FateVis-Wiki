# Server cards: the multiplayer list as trading cards

A showcase of what a page-driven menu can do that a widget menu cannot: every saved server is a pixel trading
card on a three.js plane, the rarity comes from hours played on that server and the accent colour
from the server's own icon. It is opt in, the classic list is one key away, and every failure path
ends at that list.

## Turning it on

`ui.serverView` in the pack store: `list` (default) or `cards`. C on the title toggles it:

| key | values | default | effect |
|---|---|---|---|
| `ui.serverView` | `list`, `cards` | `list` | which multiplayer panel the title shows |
| `ui.serverSort` | `list`, `tier`, `joined`, `name`, `ping` | `list` | the row order |
| `ui.showcaseQuality` | `off`, `low`, `high` | `high` | `off` never creates the renderer |
| `ui.reducedMotion` | `auto`, `on`, `off` | `auto` | no tilt, an instant lift and an instant flip when on |

All five are rows in the pack panel, which K opens on the title: they are the page's own keys and
there is no vanilla Options row to hang them on.

`auto` reduced motion is a heuristic, because 1.21.1 has no such option: it resolves to on when
`prefers-reduced-motion: reduce` matches, when the alias `ui.motion` is `off`, or when the player
zeroed `panoramaSpeed`. Servo 0.5 answers the media query false whatever the desktop says, so in
practice the store keys and the panorama speed decide. On the cards reduced motion drops the tilt spring, the
lift curve, the flip curve and the idle sway, and keeps the glints, which are view dependent and not
time dependent: a card that does not move holds a fixed set of them.

## Where the data comes from

Nothing here is new bridge surface either; it is the `servers` topic of [Topics and actions](/en/fv-ui/topics-actions) grown five keys.

- `servers` for the row, joined with `servers.stats` on the normalized `address` and never on the
  list index, which moves when the player reorders `servers.dat`.
- `icon` is a `fvui://servericon/<key>.png?v=<epoch>` url keyed by a hash of the icon bytes, so two
  servers with the same icon share one file, one fetch and one accent.
- `accent` and `accent2` are quantised in Java once per distinct icon. When they are missing - an
  older mod, or a direct connect whose ping has not answered - `cards/accent.ts` runs the same
  k-means over the decoded icon in the page and the card repaints with what it found. A server with
  no icon at all takes the menu's `--glow` and draws the pattern with no picture, which reads as
  deliberate.
- `motdRuns` carries the MOTD as `(text, colour)` pairs, at most two source lines. The canvas needs
  the colour *name* to reach the card palette, which is why `motdHtml` cannot serve it.
- `servers.stats` gives `hours` per address; `cards/tier.ts` derives the tier from it and nothing
  stores one.

## The modules

```txt
src/cards/device.ts   the page's one adapter and device, and the loss listener
src/cards/layout.ts   every number of cards.json: rects, camera, lift, tilt, glint, sheen
src/cards/tier.ts     hours => tier, and the ornament and foil table
src/cards/accent.ts   colour helpers, the card palette, the page side icon quantiser
src/cards/text.ts     fold, fit, wrap, clip: the fitting rules, with the widths injected
src/cards/art.ts      the pixel painters: frame, ornaments, badge, patterns, bars, foil mask
src/cards/font.ts     the baked player font on the canvas, and the charset it covers
src/cards/face.ts     one 300 x 420 face canvas per card
src/cards/foil.ts     the TSL node graph: flake glints, rainbow sheen, matte lobe
src/cards/spring.ts   the tilt spring and the lift eases, pure functions
src/cards/flip.ts     the row => lifted => back state machine, a pure reducer
src/cards/sort.ts     the five row orders, page side only
src/cards/model.ts    servers + servers.stats => one card model each
src/cards/state.ts    the refs the row, the stage and the title share
src/cards/stage.ts    scene, plane placement, tilt, lift, flip, frame loop
src/cards/CardRow.vue the DOM row, the rects, the gestures and the keyboard
src/cards/CardStage.vue  the canvas over it
src/cards/NoteEditor.vue the textarea over the projected note box
```

The row is CSS and the planes follow it: `CardRow.vue` lays out one button per server and the stage
reads their `getBoundingClientRect()` and places a plane under each. Rects are read on mount, on a `gui.scale` change, on a scroll and on a
window resize, never through a `ResizeObserver`, which servo 0.5 does not have. The DOM cards stay
at zero opacity rather than `visibility: hidden`, which would take their hover, their focus ring and
their place in the accessibility tree with them; until the scene has drawn a frame they show a flat
stand-in instead, so a slow device never shows an empty strip.

The camera keeps the concept's fov and its distance-to-card ratio rather than its absolute numbers:
a card is 2.5 x 3.5 units, the units per pixel come from the measured row, and the camera is pulled
back to suit. A lift then dollies by the same fraction of the camera distance the Blender render
does, whatever width the right column ends up at.

## Text with the player's font

The concept measures in a uniform 3x5 font where an advance is `4 * scale` px. The baked player font
has variable advances and its sidecar is a list of distinct advance buckets and not a width table,
so `text.ts` keeps every *rule* of cards.json and takes every *width* from `ctx.measureText` through
an injected `Measure`. A scale is the largest integer multiple of 8 px - an em is 8 game pixels -
whose measured width fits the band, and "30 characters per line" becomes the box width, which is the
same budget in the concept's own metrics. Measurements are memoised by text and scale, so the
fitting search never reaches the repaint path.

`fold` drops what the bake does not cover and folds small capitals and accents to plain letters,
which is what makes a MOTD written in decorative Unicode readable. Unlike the concept it keeps the
case the source had: the 3x5 font had no lowercase and the baked one does.

The baseline is the game font's own metric, 7 of the 8 game pixels of an em above it, and **not** the
sidecar's `ascent`, which is a different number and put every title a whole band above its box.

## How a face reaches the GPU

`face.ts` paints a 300 x 420 canvas per card and the plane wears it, but the trip is not the obvious
one: servo 0.5 cannot take a canvas as a WebGPU texture source at all. `copyExternalImageToTexture`
leaves the texture at zero and logs nothing, a `data:` backed `<img>` does the same, and
`createImageBitmap` and `canvas.toBlob` never call back. So `pixelsOf` reads the canvas with
`getImageData`, flips the rows, and the pixels go up as a `DataTexture`, which uploads correctly.
Two more traps of [Servo support matrix](/en/fv-ui/servo) are worked around in the same file: the one context per canvas, because
a second `getContext('2d')` answers a blank one, and the stepped corner cut, because `clearRect`
clears the whole canvas whatever rect it is given.

A repaint therefore rebuilds a card's texture and material, which is why the repaint is gated on the
data actually moving. `canvasReadable()` checks one pixel at boot, so an engine that cannot read a
canvas back hands over to the classic list with a line instead of drawing empty rectangles.

## The foil

`foil.ts` is the first hand written TSL graph in the tree. One material for the whole row, moved to
whichever card is lifted or hovered, so the glints cost one shader compile and a resting card pays
nothing:

- a 2D cell hash at 90 cells per card width gives each cell a random flake normal, and
  `smoothstep(0.9985, 0.9996, dot(flake, view))` leaves about 0.6 percent of them lit at any one
  angle. That narrow window is the whole trick: a few degrees of tilt swaps which cells are lit, so
  the card sparkles instead of sliding a gradient around.
- the flake colour is `mix(white, accent, 0.5)` pulled 30 percent toward the cell's own hue, at the
  tier's glint strength, times a dot mask and the foil mask.
- `epic` and `legendary` add a faint rainbow sheen whose hue scrolls with the view vector, and with
  time on `legendary` only. The matte tiers get a broad highlight that fills as the card faces you
  rather than a glossy lobe.

The view vector is `cameraPosition` transformed into the card's own space on the CPU and handed over
as a uniform, which is the concept's `inverse(modelMatrix) * cameraPos` without a matrix uniform.
The foil mask is a second single channel canvas over the same rects, so the icon, the text boxes and
the badge never sparkle and no mask PNG ships.

## Art and assets

Every pixel is ours. `art.ts` draws the body, the 10 px accent band, the outlines, the four
ornaments (`plain`, `studs`, `double`, `engraved`), the tier pill with one pip per step, the diagonal
and lattice patterns and the stepped 12 px corner, all as integer `fillRect`s off the icon's accent.
The stepped card edge lives in the texture alpha and not in the geometry, so a card is one plane.

Nothing is a runtime asset. `npm run gen:cardart -w fvmenu-web` renders the five tier frames at a
neutral accent into `web/menu/test/fixtures/cards/` as the golden the composition test measures
against, importing `src/cards/art.ts` itself so the fixture cannot drift from the painter.
`npm run gen:mockicons -w fvmenu-web` writes eight 64x64 icons for the harness. No real server's
favicon and no mockup art is in the repository.

## The back, and turning a card over

A card is in one of three states and `cards/flip.ts` is the whole of it - a pure reducer, no clock,
no GPU, no DOM, so the sequences are a vitest case and the stage only animates what it answers:

```txt
row  --click/Enter-->  lifted  --click/Enter/F-->  back  --click/F-->  lifted  --Escape-->  row
```

A gesture on another card always finds that card in the row, which is what makes an arrow key carry
the lift along without turning anything over. Enter answers by state: it lifts, then turns over,
then joins.

The back carries the accent lattice, the note in up to four wrapped lines of the `text` block of
`cards.json`, three stats rows - `HOURS`, `JOINS` and `LAST`, a relative stamp ("2 H AGO", "3 D AGO", "NEVER") - and the
same tier badge the front has. It is painted on the first flip and dropped when the card goes back
to the row: one card is ever turned over, and a back per card would double the texture bill for
nothing.

The turn is 180 degrees about the vertical axis over 0.7 s, `easeInOut`, and the angle only ever
grows - 0 to 180, then 180 to 360 - so a card never unwinds the way it came. Past the halfway point
the material takes the back texture, whose pixels are mirrored on the CPU because the plane is being
seen from behind; the mirror is not `texture.repeat`, which the engine has never been given
negative on a data texture. The foil rides through the turn, and its `1 - abs(view.z)` term peaks as
the card goes edge on, which is the glint catching the light mid-turn; `abs` and not a clamp to
zero, or a back that faces you square on sits at full sheen and washes out to grey. While the back holds, a 1.5
degree sway at 0.35 Hz is the only thing keeping the loop dirty with no pointer input, so it is the
first thing reduced motion drops - there the whole flip is a position change.

## The note field

Canvas text is not editable and servo has no IME, so the note is a real `<textarea>`:
`NoteEditor.vue` over the back's own note box, projected out of the scene by
`CardStage.projectRect` - the four corners of the face rect through the card's world matrix and the
camera - and given the baked font at the same text scale the card will paint it at. The tilt target
is forced flat while it is open, so the text does not move under the caret.

Enter saves, Escape reverts, blur saves, 240 characters is the cap. A save is
`servers.note.set`; the Java half writes `fvui/stats.json` and pushes `servers.stats` back, and that
push is what repaints the back. The field takes the keyboard while it is up: the title's own window
handler steps aside on `cards/state.ts`'s `editing`, or every letter typed would also be a title
shortcut.

## Actions and the row order

| what | how |
|---|---|
| join | `server.join` with the card's own `index`, which the sort never moves |
| refresh ping | `servers.refresh`, the same ping the title fires on every show |
| edit, add, remove | `open` with `edit-server` and the index, [Topics and actions](/en/fv-ui/topics-actions): the vanilla screen owns `servers.dat` |
| note | `servers.note.set`, above |
| sort | page side only, `ui.serverSort` in the pack store |

The five orders are `list` (the `servers.dat` order, the default), `tier` (hours descending),
`joined` (last session descending), `name` and `ping`. A server that never answered sorts last
whatever number its ping field carries. Nothing here reorders `servers.dat`, so `index` stays the
key `server.join` takes.

## Input

Left and Right move the focus and carry the lift with it; Enter lifts, turns over and joins by
state; Escape steps back one state at a time. F turns a card over, N opens the note, R re-pings, E
opens the vanilla editor on that server, S cycles the order and L returns to the classic list. A
click lifts a card and the next click turns it over. The tilt follows the pointer through a damped
spring (`k` 120, `c` 14 per second, 8 degrees of cone, 6 under 1280 px wide) and returns to flat
300 ms after the pointer stops.

The card keys hang off the card's own button rather than off the window, because a window handler
over a page with a text field eats every letter typed into it. The row therefore calls `.focus()` by
hand on a click and takes the focus back when the note field closes, rather than trusting the
engine's own click focus.

## The downsample floor

Three cards across a `clamp(320px, 32vw, 440px)` column is a 140 device pixel card off a 300 pixel
face - a 0.47x resample with nearest
filtering, where a two texel stem can fall between two samples and vanish. That is what ate the
periods of `1.21.1` in M15a. `minScaleFor` in `text.ts` answers the texels per device pixel, rounded
up and capped at 4, and the title and the version are drawn at no smaller a scale, so every stem
lands on at least one sample.

The count and the MOTD keep the concept's scale 2. They are digits, a slash and prose, which survive
the resample as a soft edge rather than a hole, and a thicker count would push the version off the
footer while a thicker MOTD would cost a third of the characters per line - the information those
boxes are for. The floor is part of the repaint key, so a resize repaints and nothing else does.

## The renderer, and what a failure does

A false `renderer.backend.isWebGPUBackend` is a failure and not a
downgrade, and every path ends in one log line, the classic `ServerPanel` list and no retry.

```txt
cards: falling back to the server list, navigator.gpu missing
cards: falling back to the server list, requestAdapter answered null
cards: falling back to the server list, the engine cannot read a 2D canvas back
cards: falling back to the server list, init rejected: ...
cards: falling back to the server list, WebGPURenderer fell back to WebGL2
cards: falling back to the server list, device lost: ...
cards: falling back to the server list, render failed: ...
cards: falling back to the server list, the canvas would not give its pixels up
```

A success logs `gpu: one device for the page` once, then `cards: three r186, isWebGPUBackend true`
and one `cards: <n> planes, <w>x<h> buffer, <n> px per unit` per layout change.

## Running it

```txt
# harness, mock servers, no game behind it
cd native && FVUI_PATH='index.html?demo=cards' FVUI_SHOTS=1200,3000,4500,6500 \
  xvfb-run -a -s "-screen 0 1920x1080x24" env -u WAYLAND_DISPLAY \
  ./target/release/examples/headless ../web/menu/dist out.png examples/mock 1920x1080

# the same, walking the lift, the turn and the note field on a timeline
FVUI_PATH='index.html?demo=cards&drive=1' FVUI_SHOTS=1200,3150,4200,6000,7600

# dev client over the real server list
cd mods && xvfb-run -a -s "-screen 0 1920x1080x24" env -u WAYLAND_DISPLAY \
  ./gradlew :menu:runClient -PdevOut=.work/m15b/client -PdevCards=true \
  -PdevServer=127.0.0.1:25565 -PdevQuit=true
```

`-PdevOut` resolves against the repo root, not against `mods/`. `&drive=1` is the harness driver in
`src/demo/cards.ts`: 400 ms lift, 2800 ms turn (so 90 degrees at 3150), 5000 ms the note field, then
Escape back to the row. `-PdevCards` walks the same path with real clicks and real keys and joins
the dev server off the back of its own card.

`-PservoPrefs=dom_webgpu_enabled=false` on the same run proves the fallback: the multiplayer panel
stays the classic list and exactly one line is logged.
