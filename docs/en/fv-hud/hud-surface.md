# The HUD surface

`fv-hud.jar` is a second mod on the same engine. It owns the views named `hud`, `hudedit` and
`container`, the surfaces `hud`, `editor` and `container`, and it is independent of fvmenu in both
directions: either can be installed alone.

The HUD view is created on world join and closed on leave, the other two on first use and closed
with it, so the extra GL contexts and their texture rings only exist while a level is loaded. No
input is routed to it while the game is being played - it is created outside any screen and stays
unfocused - so the page can never swallow a click, a keybind or the hotbar wheel. The chat screen is
the one exception and a narrow one: see the chat screen section.

## A HUD pack

The same manifest as any other pack, with `hud` in `entries`:

```json
{
  "id": "my-hud", "version": "1.0.0", "name": "My HUD", "fvui": ">=0.1.0",
  "entries": { "hud": "index.html" },
  "capabilities": ["state.sub", "state.unsub", "hud.rects"],
  "res": ["minecraft/textures/gui/sprites/hud/hotbar.png"]
}
```

Put it in `<gamedir>/fvui/packs/<id>/` and select it with `active.hud` in
`<gamedir>/fvui/packs.json`. Anything the pack leaves out falls back entry by entry to the pack
shipped in the jar through `fvui://ui-hud/`, exactly like the menu surfaces of [Pack format](/en/fv-ui/packs). A pack
with only a `theme` repaints the shipped page instead of replacing it.

The page URL carries `pack`, `unit` (CSS pixels per GUI pixel, so the first frame can size itself
before any topic arrives) and `theme` when the active pack declares one.

### The GUI pixel rule

This view is not created with the menu CSS scale. `cssScale` is the player's GUI scale, so **one
CSS pixel is one GUI pixel** and vanilla offsets can be written straight into the layout. Lay the
page out in a box of `gui.scale` `guiWidth` x `guiHeight` pinned to the top left, not in `100vw`:
`guiWidth` is `ceil(width / guiScale)`, so vanilla's canvas is up to a pixel wider than the window
and its own projection squeezes it back. The shipped page corrects for that with one transform:

```txt
scale(width / (guiWidth * guiScale), height / (guiHeight * guiScale))
```

Without it the page and the vanilla layers drift by up to a device pixel at odd scales - it is the
difference between a pixel identical heart row and a 13% pixel diff at GUI scale 3.

Sprites come from `fvui://res/`, so a resource pack applies to the HUD as well:
`fvui://res/minecraft/textures/gui/sprites/hud/hotbar.png?v=<res.epoch>` with
`image-rendering: pixelated`. Declare the paths in the manifest `res` list and they are extracted
before the first frame; anything dynamic goes through `res.need` at runtime.

## Topics

Owner fvhud, every one of them lazy: a page that draws no hearts pays nothing for `hud.player`.

| topic | kind | payload |
|---|---|---|
| `hud.player` | tick | `{health, maxHealth, absorption, display, blinkUntil, hardcore, hearts, regenerating, hunger, saturation, starving, armor, air, maxAir, underwater, level, progress, xp, hurtable, spectator, heldName, heldUntil, now, paused}` |
| `hud.hotbar` | tick + frame | `{selected, slots: [item x9], offhand, offhandSide}` |
| `hud.effects` | tick | `{effects: [{id, amplifier, until, ambient, visible, icon, good}], now, paused}` |
| `hud.title` | tick | `{title, subtitle, until, fadeIn, stay, fadeOut, actionbar, actionbarUntil, animate, now, paused}` |
| `hud.bossbars` | tick | `[{id, name, progress, color, overlay, darken, fog, entity, dist, kind}]` |
| `hud.damage` | tick | `{seq, dir, aimed, until, amount, health, kind, mob, now, paused}`, one payload per hit, see the reactive section |
| `hud.status` | tick | `{lowHealth, critical, starving, tremor, drowning, bubbles, frozen, onFire, portal, poisoned, withered, regen, blind, armorLow, levelUp, now, paused}` |
| `hud.reactive` | tick | `{enabled, fx: {id: bool}, intensity}`, the `reactive` block of `fvui/hud.json` |
| `hud.scoreboard` | tick | `{title, lines: [{name, value}]}` or null |
| `hud.tablist` | tick | `{visible, header, headerRows, footer, footerRows, count, columns, rows, faces, objective, layout, players}`, see the tab list section |
| `hud.chat` | tick | `{seq, now, lines: [line]}`, the backlog only, see the chat section |
| `hud.chat.opts` | tick + frame | the vanilla chat options, see the chat section |
| `chat.suggest` | frame | `{open, input, x, y, width, height, items, index, offset, limit, total, usage, usageX, usageWidth, row, fill, inputFill}`, see the chat screen section |
| `hud.tooltip` | event | `{open, x, y, w, h, rows, images, colors, delay, screen}`, see the tooltip section |
| `hud.toasts` | tick | `{toasts: [toast], now}`, wall clock millis, see the toast section |
| `hud.layers` | tick | `[{id, mod, hidden, x, y, scale, anchor, bounds, clip}]`, every registered layer, in render order |
| `hud.layout` | tick | `{elements: [{id, label, x, y, w, h}], offsets: {id: {x, y, scale, hidden}}, open}` |
| `world.time` | tick | `{dayTime, day, raining, thundering}` |
| `hud.container` | frame | the open container screen or null, see the container section below |

An item is `{id, count, damage, maxDamage, glint}`. `hearts` is `normal`, `poisoned`, `withered` or
`frozen` and picks the heart sprite family; `display` is the lagging health vanilla draws behind the
real one while `blinkUntil` has not passed. `hurtable` is false in creative and spectator, where
vanilla draws no hearts, armor, food or air either, and `xp` is false while a jumpable mount is
ridden, because vanilla puts the jump bar there instead.

Live chat lines arrive as the ordered event `hud.chat.line` on the view, not in the topic: the
topic is the ring of the last 100 lines, rebuilt on subscribe so a reloading page gets the backlog
once and no line twice. Both carry the same line shape, see the chat section.

### Deadlines, not countdowns

Every time in these payloads is an **absolute gui tick**: `until`, `heldUntil`, `actionbarUntil`.
A countdown would move every tick and push twenty times a second; a deadline does not move at all,
so the `equals` diff eats it and a running title costs nothing. `now` and `paused` ride along, but
they are only refreshed when the rest of the payload changed, so the page extrapolates from the
tick the payload was stamped at:

```js
const secondsLeft = Math.max(0, (state.until - state.now) / 20);
```

`paused` says whether that clock is advancing. Values are also rounded before the diff - health,
absorption and saturation to half hearts, air to one bubble, bars to 1/182, ping to 50 ms, day time
to 20 ticks - so a still player pushes one key a second and nothing else.

The page follows the same rule the other way: no always-on animation. Bars move when the value
moves, fades are CSS transitions started by a timer, and the whole HUD repaints about once a second
while the player stands still.

## The reactive HUD (M14)

A HUD that answers the game: hearts that crack at low health, a damage direction indicator on the
screen edges, the boss as a puppet beside its bar, a particle burst on a level up. Every one of them
is a toggle, not a second pack, and with the toggle off the page is byte for byte the M5 page.

### The three data topics

`hud.damage` is one payload per hit and nothing between hits. `seq` is a counter and the only field
that always moves, so a second hit of the same size from the same bearing is not diffed away.
`until` is `now + hurtTime`, which is the whole `GameRenderer.bobHurt` ramp - `sin((t/10)^4 * PI)` -
with no per frame push. `dir` is `Player.getHurtDir()` normalized into `[0, 360)` and rounded to 5
degrees; it is measured from the player's forward toward their **left**, so the screen bearing
clockwise from the top edge is `360 - dir`. `aimed` is false when the drop came through the
`SetHealth` path only, which carries a stale direction - a page should draw a symmetric flash then
rather than point at a lie. `kind` is the damage type id and `mob` the causing entity type.

`hud.status` is vanilla's own trouble thresholds, so an effect fires when the game says the player
is in trouble: `critical` is `ceil(health) + ceil(absorption) <= 4`, the window `Gui.renderHearts`
jitters hearts in, and `tremor` is `hunger * 3 + 1`, the period `Gui.renderFood` jitters on. Every
number is bucketed - freeze to 10 ticks, portal to 0.1, armor durability to 0.05 - so a burning,
starving, freezing player pushes at most once per bucket change and a standing one never. `levelUp`
is the one deadline here, `now + 14` on the tick the level rose.

`hud.bossbars` grew `entity`, `dist` and `kind`. **There is no bar-to-entity link in the protocol**:
`ServerBossEvent` takes a fresh random UUID and `ClientboundBossEventPacket` carries no entity id,
so the client matches the bar against its own entity list - the two vanilla bosses first, then a
display name or a type name equal to the bar's, then distance - and caches the match for 40 ticks.
Every miss answers `entity: null` and the page draws the plain bar, so the failure mode is "no
showcase" and never "wrong HUD".

### The toggle

`fvui/hud.json` carries a `reactive` block next to `layers` and `tooltips`:

```txt
"reactive": {"enabled": true, "fx": {"hearts.crack": true, "damage.edge": true}, "intensity": 1.0}
```

`enabled` false is the kill switch and the pixel parity baseline, an absent `fx` entry means the
shipped default (on), and `intensity` is a 0..2 multiplier. It rides the `hud.reactive` topic, so a
page sees it with no file read, and `hud.reactive.set {fx, value}` writes it back through the same
debounced atomic write every other `hud.json` edit takes.

### The effects

All thirteen ship. An absent `fx` entry means on.

| fx | reads | technique | reduced variant |
|---|---|---|---|
| `hearts.crack` | `hud.player.health/maxHealth`, `hud.status`'s `critical` | canvas 2D over the heart row: seeded crack polylines, then the heart sprite composited with `destination-in` so they are clipped to the heart alpha; four buckets by health fraction | the same canvas, no re-seed |
| `hearts.beat` | `hud.status`'s `critical` | `scale(1.11)` on each heart, `steps(2, end)`, 1.2 s at 4 hp and 0.7 s at 2 - per heart and not on the row, because a region fills the whole HUD box | one 150 ms pulse per damage `seq`, not a loop |
| `hunger.tremor` | `hud.status`'s `starving` and `tremor` | a `translateY` jitter on the drumsticks at vanilla's own `hunger * 3 + 1` period, `steps(1, end)`, 1 px or 2 px by how empty the belly is | none, it goes vanilla |
| `damage.edge` | `hud.damage` | four bearing weights on four 24 px edge bands of pack art, one animation per hit sampling vanilla's own quartic sine at six stops; `dir` picks the bands, `kind` the strip | one 150 ms symmetric flash |
| `edge.tint` | `hud.status`'s `onFire`, `frozen`, `portal`, `withered`, `poisoned` | the same 24 px border, one opacity transition and never a filter: `block/fire_1` upright along the bottom, `misc/powder_snow_outline` and `block/nether_portal` around the frame, pack art for poison and wither | the same, at half the duration |
| `air.pop` | `hud.player`'s `air` | the bubble that emptied gets `hud/air_bursting` under a 200 ms `scale()` at `steps(3, end)`, then unmounts | a 100 ms opacity out |
| `xp.burst` | `hud.status`'s `levelUp` | canvas 2D, 24 two pixel quads in vanilla's level green, 700 ms at 12 Hz off the deadline, then the canvas is dropped | a 200 ms opacity flash, no canvas |
| `armor.crack` | `hud.status`'s `armorLow` | the `hearts.crack` canvas over the armor row below 0.15 durability left, four buckets | the same canvas |
| `boss.island` | `hud.bossbars[].entity` | a 40x40 `data-kind="entity"` island beside the bar, never over it | identical, an island does not animate |
| `effects.ring` | `hud.effects[].until` | a canvas arc around the 24x24 icon, redrawn by the 2 Hz ticker the effect row already runs and by no timer of its own | a 1 px underbar on a width transition, no canvas |
| `hotbar.swap` | `hud.hotbar`'s `selected` | `translateX` on the selection frame, `transition: transform 90ms steps(4, end)`; the nine `data-slot` cells never move, so no native item moves | instant, no transition |
| `tablist.fade` | `hud.tablist`'s `visible` | a 120 ms opacity animation on the way in only - the rows carry `text` and `face` islands the game draws at full alpha, so a fade out would leave the names over an empty panel | 60 ms |
| `chat.rise` | the newest `hud.chat` row's `ts` | three steps of `translateY(4px => 0)` folded into the M5 fade shorthand, because servo has one `transform` and a second animation would drop the fade | none, the fade already carries it |

The structural rule behind all of them: **no effect animates without a deadline or a state that
ends.** Every one is a CSS animation started once with a duration, a canvas redrawn only when a
bucket changed, or a loop gated on a state the game will leave. At most one loop runs at a time -
`hearts.beat` outranks `hunger.tremor` - and the winner is resolved centrally rather than by
whichever component evaluated first.

The 24 px border art of `damage.edge` and the poison and wither tints are ours, in `web/hud/src/art/`
and generated by `web/hud/art/strips.mjs`: a resource pack will not recolour them, and the three that
come off `fvui://res/` are the answer for players who want it to. One 64x24 strip serves all four
sides, rotated about its own centre, because tinting one neutral strip needs a filter or a blend mode
and servo pays about 8x a frame for a filter on animated content.

Reduced motion is resolved per effect and never globally. The `ui.reducedMotion` store key
(`auto | on | off`) decides first, `ui.motion` from M5 is the alias that forces off, and only on
`auto` does the page fall back to `options.prefs.speed === 0` and the `prefers-reduced-motion`
query - which answers "no reduce" under servo 0.5 whatever the desktop says, so the keys are the
real switch.

### The tuning page

`web/hud/dev/tune.html` is the shipped HUD page with a panel over it: the master switch, the
`intensity` dial, a reduced motion selector, an on/off and a preview gain per effect, a solo button,
and a mock driver that replays one recorded state per effect on a timeline. It is a third Vite input
and **never a pack entry** - `processResources` in `mods/hud/build.gradle` drops `dev/**` - so it is a
build artifact and never in a shipped jar.

```sh
npm run build:hud          # then open web/hud/dist/dev/tune.html?res=<dir>
```

F6 reloads the page, space plays and pauses the driver, `record` prints the `reactive` block to paste
into `fvui/hud.json`. The panel writes the `hud.reactive` topic for the preview and calls
`hud.reactive.set` as well, so with a game behind the page a tuning session lands in the file. The
per effect gain is the one control that persists nowhere: `hud.json` carries one dial for the whole
catalogue, so the gain is there to look at a single effect and not to ship one.

### Writing a reactive page of your own

Read `hud.reactive` and resolve each effect yourself: the ids are a convention, not a contract the
game enforces. The three rules the shipped page follows and a pack should too: never move a
`data-slot` box, because that moves a native item; keep the diff of a running effect inside the
region that effect owns - `REGIONS` in `web/hud/src/reactive/model.ts` is that declaration and the
parity crop list is generated from it; and never start an animation that has no end.

## Native items in page rects: `hud.rects`

The page owns the layout, the game owns the item, so glint, durability bars, stack counts,
cooldowns, animated textures and mod item decorators stay exactly vanilla.

Mark a box in the page and measure it once per frame:

```html
<div data-slot="hotbar.0"></div>

fvui.call('hud.rects', {
  epoch: 1,
  cssScale: window.devicePixelRatio || 1,
  rects: [{ key: 'hotbar.0', x: 312, y: 431, w: 16, h: 16 }],
  bars: { left: 59, right: 49 }
});
```

Rules that matter:

- Send the batch **only when the hash of the rounded numbers changed**. A static HUD sends nothing,
  and it is one bridge call, not one per slot.
- Send it **one frame after measuring it**. `requestAnimationFrame` runs before the paint, so a
  batch sent in the same callback names a frame that does not carry the layout yet.
- `kind` picks what the game draws: `item` (the default, `key` is `hotbar.<0-8>`, `offhand` or
  `toast.<id>`), `text` (one wrapped row, chat and the tab list), `face` (a player head) and
  `tooltip` (a tooltip component). `clip: true` wraps the rect in a scissor.
- `bars` is `Gui.leftHeight` and `rightHeight` as the layers you replaced would have left them, 39
  plus 10 per bar row. A mod bar (AppleSkin and friends) reads them and stacks above yours.
- Rects are CSS pixels of the page. The game converts with both scales taken from itself, never
  from the batch, and draws the batch only once its present counter proves the page frame that
  produced it is on screen, keeping the previous one until then so items never blink out.

Never route the crosshair, its attack indicator or anything else bound to the pointer or the camera
through a rect: the page is one to three frames behind at 60 fps.

## Layers: what the page replaces

fvhud registers `fvhud:page` directly above `minecraft:camera_overlays` and `fvhud:items` above the
page. So the page sits over the world and the camera overlays, items sit over the page, and every
layer that is not named - the crosshair, the spectator tooltip, sleep, demo, the debug overlay,
subtitles, the saving indicator, **and every layer any other mod registered** - still draws on top
of both, untouched.

`<gamedir>/fvui/hud.json` is the whole control surface, written with the defaults on first run,
next to `packs.json` and not in `config/`:

```json
{
  "enabled": true,
  "layers": {
    "minecraft:hotbar":      { "hidden": true,  "x": 0, "y": 0, "scale": 1 },
    "minecraft:chat":        { "hidden": false, "x": 40, "y": -20, "scale": 0.75 }
  }
}
```

`hidden` cancels the layer, `x`, `y` and `scale` move and scale it without cancelling it - vanilla
or modded, any named id. Anything the file does not name keeps its rule, and anything nothing names
is never touched. `"enabled": false` is the kill switch when another HUD mod owns the vanilla ids.
A partial entry keeps the fields it leaves out, so `{"x": 4}` moves a layer that stays hidden.

Two more fields, both optional and both written by the editor:

```txt
"minecraft:chat": { "x": -6, "y": -6, "anchor": "bottom-right",
                    "clip": { "x": 0, "y": 200, "w": 180, "h": 60 } }
```

`anchor` is one of `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`,
`bottom`, `bottom-right`. With no anchor `x` and `y` are a plain delta, which already survives a
resize and a GUI scale change; with one they are an offset from that region's origin, which is what
keeps a layer dragged across the canvas on the edge it was dropped at. `clip` is an inclusive
scissor in GUI units on the final canvas, for "this mod's bar is too wide". Both are omitted from
the file while they are null, so a player who never used them keeps a file of the older shape.

The same file carries the tooltip opt-in, written with the defaults on first run:

```txt
"tooltips": { "enabled": true, "screens": [], "exclude": [], "delay": 0 }
```

`screens` is empty out of the box, so **no screen hands its tooltips to the page until you name
one**. An entry is a class name, a package prefix ending in `*`, or `*` for everything; `world` is
the id of a tooltip drawn with no screen open. `exclude` is read first, so it always vetoes.
`delay` is a page side hover delay in milliseconds.

`"editor": false` is the modpack lock: the key mapping and `hud.editor.open` become no-ops.
`"profiles": {"<guiScale>": {"layers": {...}}}` is read and merged over the base when the player's
GUI scale matches, and written back untouched. Nothing produces it yet.

Hidden by default, the ids the shipped page draws instead: `minecraft:hotbar`,
`minecraft:player_health`, `minecraft:armor_level`, `minecraft:food_level`, `minecraft:air_level`,
`minecraft:experience_bar`, `minecraft:experience_level`, `minecraft:effects`,
`minecraft:boss_overlay`, `minecraft:scoreboard_sidebar`, `minecraft:title`,
`minecraft:overlay_message`, `minecraft:selected_item_name`, `minecraft:chat`,
`minecraft:tab_list`. Listed but native: `minecraft:vehicle_health` and `minecraft:jump_meter`.

`minecraft:chat` has two rules of its own on top of the file. It is only cancelled while a page is
actually subscribed to `hud.chat`, so a pack that does not draw chat keeps the vanilla one with no
setting at all, and it is never cancelled while the player's chat visibility is `HIDDEN`, where
vanilla draws nothing either. The narrator is untouched: it hangs off `ChatListener`, not off the
layer. `minecraft:tab_list` follows the same subscription rule against `hud.tablist`, and toasts
are not a layer at all: they are cancelled one by one, and only while a page reads `hud.toasts`.

If you write a pack that draws less than the shipped page, un-hide what you do not draw. The cancel
set is the file, not the pack: a pack cannot silently turn a vanilla layer back on.

Two things the file cannot do. A mod drawing outside layer events - a `Gui` mixin, a
`RenderGuiEvent.Post` listener, a screen overlay - is unreachable, and a mod using
`registerBelowAll` lands under the page and is drawn behind it. Both are known and documented, not
fixed.

An existing `hud.json` always wins, including after an update: a file written by an older version
keeps the layer set it was written with. Delete it to pick the new defaults up.

## Chat

The page draws the chat backlog, the fade and the row backgrounds; the game keeps the wrap, the
widths and every option. Two topics and one ordered event:

| topic | payload |
|---|---|
| `hud.chat` | `{seq, now, lines: [line]}`, the ring of the last 100 messages, rebuilt on subscribe |
| `hud.chat.opts` | `{scale, width, height, heightFocused, heightUnfocused, opacity, background, lineSpacing, lineHeight, textOffset, visibility, delay, focused, scroll, rows, newMessage, lines, queue, queueText, indent, bottomMargin}` |
| `chat.suggest` | what `CommandSuggestions` would have drawn, see the chat screen section |

A line, the same shape in the topic and in the `hud.chat.line` event:

```json
{ seq: 12, ts: 4180, system: false, plain: "<Dev> hi",
  tag: null,
  rows: [{ html: "<span class=\"mc\">&lt;Dev&gt; hi</span>", width: 41,
           native: false, token: null, key: "chat.12.0" }] }
```

- `rows` is **vanilla's own wrap**, one entry per `GuiMessage.Line`, so a page never re-wraps and
  never disagrees with the game about where a message breaks. `width` is `Font.width` of that row
  in GUI pixels.
- `html` is the row as `span`, `br` and `wbr` with every text node escaped, see [Topics and actions](/en/fv-ui/topics-actions).
- `ts` is the gui tick the message arrived at, an absolute deadline: the fade is started once as a
  CSS animation with a negative delay equal to the row's age, so a still chat costs no timer.
- `tag` is `{color, text, icon, iconWidth, iconHeight}` or null. `color` is vanilla's packed
  indicator colour, drawn as a two pixel bar at x -4; `icon` is a sprite name for `fvui://res/`.
- Every number in `hud.chat.opts` is the result of vanilla's own getter, computed in Java, so the
  page never re-derives one. `lineHeight` is `9 * (lineSpacing + 1)`, `textOffset` is where the
  glyph top goes inside a row, `opacity` already has the `* 0.9 + 0.1` folded in, and `scroll` and
  `lines` are the scrollbar position and the lines per page. `rows` is the length of vanilla's
  display list, which it trims to 100 **rows** and not to 100 messages, so trim your own flattened
  row list to that too or your backlog outlives the game's.
  `queue` and `queueText` are the delayed message line vanilla draws above the box, its count and
  its translated text, and `newMessage` recolours the focused scrollbar when a message arrived while
  the backlog was scrolled away.

Geometry, all of it vanilla's `ChatComponent.render`: the box is `ceil(width / scale)` wide, the
first row's bottom edge is at `floor((guiHeight - 40) / scale)` and rows walk up by `lineHeight`;
the background runs from x -4 to x `width + 8` at `rgba(0, 0, 0, background)`; the row opacity is
full for 180 ticks and then the square of a linear ramp over the last 20.

Two rules keep your ring and the game's the same list. Past eight messages in one tick the ordered
events stop and `hud.chat` is pushed whole instead, because a burst outruns the event queue; and
when a `text` island names a line the game no longer has, the game pushes `hud.chat` again. So:
**replace your ring whenever `hud.chat` arrives**, append on `hud.chat.line`, and drop a line whose
`seq` you already hold, because the two paths overlap by design.

`chat.scroll {lines}` calls `ChatComponent.scrollChat`, so the scrollbar arithmetic stays one
implementation. Chat is a movable page element: the shipped page marks its box `data-move="chat"`,
so the M6 editor moves, scales and hides it with no editor change.

### The chat screen

Opening chat with T or `/` still opens vanilla's `ChatScreen`, and its `EditBox` is still the text
field: the caret, the selection, the clipboard, every input method, the up and down history and tab
completion are the game's and none of them travels through the bridge. What changes is what is
drawn around it. While the screen is open the page gets the chat with `focused: true`, which means
the focused height, no fade and the scrollback, and the game cancels its own chat draw and its own
input bar fill because the page has already drawn both one layer below.

The field is **not moved**. `CommandSuggestions` anchors its popup to the screen height and its x to
the field's, and hit tests clicks against the box it built there, so a moved field would split the
list from the line it completes. `chat.suggest.input` reports where the field is instead, in GUI
pixels, and the page draws its row around it. Screens render after the HUD, so the field is already
above the page with no island.

`chat.suggest` is pushed once a frame while the screen is open:

- `input` is the field box, `x`, `y`, `width` and `height` the popup box, `row` its 12 pixel pitch
  and `fill` and `inputFill` vanilla's own two background colours as packed ARGB ints.
- `items` is **only the ten entries the popup shows**, each `{text, index, tooltip}` with `index`
  into the whole list; `total`, `offset` and `limit` say where that window sits, which is what the
  two dashed markers above and below the box are for. `index` is the selected entry: draw it yellow
  and the rest grey, as vanilla does.
- `usage` is the grey usage lines and the red parse errors as text rows, at `usageX`/`usageWidth`,
  stacked upward from 27 pixels above the bottom. Vanilla draws the popup **or** the usage rows,
  never both, so drop the usage rows whenever there is a popup.
- A page that does not subscribe keeps the vanilla popup, which keeps rendering above it.

The pointer reaches the page only while the screen is open, and only over the boxes reported with
`text.rects`: a left press inside one of them goes to the page and is cancelled for the game, and
every other press is the game's, so the delayed message line, the popup and the caret keep their
vanilla handlers. Keys are never routed to the page, so typing always lands in the field and Esc
always closes the screen. Clicking a span calls `text.click`, or `text.insert` when shift is held
and the style carries an insertion, exactly the branch `Screen.handleComponentClicked` takes. The
hover tooltip of a message tag and of a `show_text` or `show_entity` style is still drawn by the
game, with the game's own hit test over its own backlog.

A row drawn as a `text` island has no spans in the page, so there is nothing to report and nothing
to click: that press is not taken, and vanilla's own `mouseClicked` handles it at the same
coordinates, because the island is drawn exactly where vanilla would have drawn the row. Both paths
end in `handleComponentClicked`, so a row with an obfuscated run or a pack font stays clickable
without the page doing anything.

`-Dfvhud.chat.screen=false`, or `-PchatScreen=false` in a dev run, leaves the whole screen vanilla;
the page keeps the in-world chat either way.

### The text island

A row the page cannot draw correctly is handed back to the game. `native: true` means: use a `text`
island instead of the HTML. Mark the box and the game draws that row with its own `drawString`, so
the styles, the font and the advances stay exact:

```html
<div data-slot="chat.12.0" data-kind="text" data-props='{"alpha":0.87}'
     style="width: 41px; height: 9px"></div>
```

The rule is **per wrapped row, never per span**: mixing HTML and a draw inside one row would desync
the widths. A row is native when any run has a font other than `minecraft:default`, any run is
obfuscated (`FontSet.getRandomGlyph` has no page equivalent), any codepoint is in the private use
area U+E000..U+F8FF, or any codepoint is outside what the font bake covered.

### The font

Page text is the game's own font, baked at runtime from the player's installed assets and served
from `fvui://font/`. Nothing is shipped: there is no metrics compatible Minecraft web font whose
licence survives an OSS release, and a shipped font would freeze what a resource pack is allowed
to change. `font.need {fonts: ["minecraft:default"]}` answers
`{epoch, fonts: {id: {faces: {regular, bold, italic, bold-italic}, sidecar, glyphs}}}`; load the
four faces as one family at `font-weight: 400|700` and `font-style: normal|italic` with
`font-synthesis: none`, because vanilla's bold and italic are pixel operations and each is a real
face. The `sidecar` is `{lineHeight, ascent, ranges, advances}`.

1024 units per em and 128 per game pixel, so `font-size: 8px` with `line-height: 9px` puts the
baseline where vanilla puts it when one CSS px is one GUI px. Keep your own fallback stack until
the faces resolve; a bake that fails costs styling, never correctness, because the rows it could
not cover are marked `native` and the game draws them.

The bake reads `bitmap`, `space` and `reference` providers and honours the `uniform` filter. `ttf`
providers are not baked and the unicode `unihex` fallback is off by default - 20k glyphs and 14 MB
of face for scripts a Latin chat never types - so those codepoints stay uncovered and their rows
take the island. `font.epoch` bumps on a resource reload, which is when the cache directory and
every face URL move.

## Tooltips

Opt in per screen, off for everything by default: tooltips carry the most mod traffic in the game,
and an opted-in screen is a promise the page can draw whatever a mod put there.

`RenderTooltipEvent.Pre` is the cancel point, at `EventPriority.LOW` so a mod cancelling first
still wins. Three gates, all three needed:

1. the screen has to be in the `tooltips` block of `hud.json` (`world` is the id for a tooltip with
   no screen open);
2. **every** `ClientTooltipComponent` has to be one we mapped - `ClientTextTooltip`,
   `ClientBundleTooltip` or `ClientActivePlayersTooltip`. One unknown component and the whole
   tooltip stays vanilla and uncancelled, with one log line naming the class. JEI, Jade and
   Legendary Tooltips all arrive that way;
3. nothing is cancelled while there is no HUD view.

Then `hud.tooltip` is pushed and vanilla's tooltip is replaced by the page's, drawn at the very
point in the frame vanilla would have drawn it - so it lands above any screen, the container skin
included.

```json
{ open: true, x: 412, y: 190, w: 74, h: 28,
  rows: [{ html: "<span class=\"mc\">Diamond Sword</span>", width: 74,
           native: false, token: null, key: "tip.row.0", x: 0, y: 0 }],
  images: [{ key: "tip.img.1", x: 0, y: 12, w: 40, h: 20 }],
  colors: { backgroundStart: -267386864, backgroundEnd: -267386864,
            borderStart: 1347420415, borderEnd: 1344798847 },
  delay: 0, screen: "net.minecraft.client.gui.screens.inventory.InventoryScreen" }
```

- `x`, `y`, `w` and `h` are what the event's **own positioner** produced, in GUI pixels, so a mod
  positioner (`MenuTooltipPositioner`, `BelowOrAboveWidgetTooltipPositioner`) keeps deciding the
  flip and the page never re-derives a rule. **Do not grow past the reported `w`/`h`**: Java
  already clamped them to the screen.
- `colors` is the four gradient values **after** `RenderTooltipEvent.Color`, which fvhud fires
  itself because the cancel means vanilla never reaches it, so a mod recolour still shows.
- `rows` are text components as HTML, at their offsets inside the box; `images` are every other
  component, reserved at `getWidth(font) x getHeight()` and drawn by the game as `tooltip` islands.
  A row marked `native` is a `text` island, the chat rule.
- `delay` is a page side hover delay in milliseconds, 0 by default, which is what vanilla does.

The frame itself is one shared element in the SDK, so the HUD page, the container skin and a menu
skin all draw the same tooltip and none of them owns a copy of the vanilla geometry:

```js
import { mountTooltip } from '@fvui/sdk'
const off = mountTooltip(hostElement)          // `unit` for a view where 1 CSS px is not 1 GUI px
```

It renders into the host, marks its islands `data-slot`, so the page's own island loop reports them
with everything else, and answers a disposer.

## Toasts

Toasts are not a GUI layer: `ToastComponent.render` runs from `Minecraft` after the screen, and
`ToastAddEvent` is the whole hook. A toast of a class fvhud has a describer for - `AdvancementToast`,
`RecipeToast`, `SystemToast`, `TutorialToast` - is cancelled and becomes a `hud.toasts` entry;
anything else is left alone and draws natively over the page, the unknown-layer rule again. A
describer registry for mods is not built yet.

```json
{ toasts: [{ id: 3, kind: "advancement", title: "Advancement Made!", titleHtml: "...",
             body: ["Stone Age"], bodyHtml: ["..."],
             frame: "toast/advancement", icon: null, item: "toast.3", type: "task",
             progress: -1, textX: 30, titleY: 7, bodyY: 18, bodyStep: 9,
             titleColor: -1, bodyColor: -1, iconX: 8, iconY: 8, iconW: 16, iconH: 16,
             slot: 0, slots: 1, w: 160, h: 32,
             shownAt: 1738000, until: 1743600, hiding: false }],
  now: 1739000 }
```

- **Times are `Util.getMillis()` milliseconds, not gui ticks.** Toasts run on the wall clock and
  keep running while the game is paused, the one documented exception to the deadline rule, and the
  payload carries its own `now` so a page never mixes the two clocks.
- `slot` and `slots` are vanilla's five slot `BitSet` allocation, reproduced in Java so the two
  sides cannot disagree, and `notificationDisplayTime` already multiplies `until`.
- Placement is `translate(guiWidth - width * v, slot * 32)` with `v` the squared 0..1 ramp over
  600 ms, run backwards once `hiding` is set from `until`.
- Every text offset and colour is the number the vanilla subclass draws with, so the page places
  text and never re-derives one.
- `frame` and `icon` are sprite paths for `fvui://res/`; `item` is the key of an `item` island, which
  is what draws an advancement icon or the cycling recipe result.
- `ui.toast.in` and `ui.toast.out` are played from Java when a toast is accepted and when it starts
  hiding, so the volume sliders apply and a page that draws no toast makes no sound.

## The tab list

`minecraft:tab_list` is cancelled while a page reads `hud.tablist`. Hold-to-show is driven from the
topic, because nothing else would call `setVisible` once the layer is gone - and the narrator hangs
off that call.

```json
{ visible: true, header: "A server", headerRows: [row], footer: null, footerRows: [],
  count: 2, columns: 1, rows: 2, faces: true,
  objective: { name: "kills", kind: "INTEGER" },
  layout: { left: 280, top: 10, columnWidth: 120, contentWidth: 120, row: 9, stripe: 8,
            gap: 5, nameWidth: 60, scoreColumn: 0, face: 8, faceAdvance: 9,
            pingW: 10, pingH: 8, pingInset: 11 },
  players: [{ id: "<uuid>", name: "Dev", html: "...", width: 18, native: false,
              nameKey: "tablist.<uuid>.name", ping: 50, pingSprite: "icon/ping_5",
              mode: "survival", score: 0, scoreText: null, scoreWidth: 0, health: -1,
              spectator: false, face: "tablist.<uuid>" }] }
```

- `html` is `getNameForDisplay`, which already carries the tab list display name or the team
  prefix, suffix and colour plus the spectator italics, so **no team logic belongs in a page**.
  `name` stays plain for anything that needs to sort.
- The 80 player cap, `PLAYER_COMPARATOR` (spectators last, then team, then name) and the 20-rows-per-
  column split all happen in Java, and every width in `layout` was measured with the game's own
  `Font`. Rows fill **column major**: entry `i` is column `i / rows`, row `i % rows`.
- `faces` is vanilla's own condition (a local server or an encrypted connection). A head is a `face`
  island keyed `tablist.<uuid>`: a skin is a downloaded texture and not a pack resource, so
  `fvui://res/` cannot serve it, and the island keeps the hat layer and every skin reload exact.
- `pingSprite` is the sprite vanilla would pick at that latency; `ping` itself is rounded to 50 ms
  so a jittering latency does not push the whole list.
- `objective.kind` is `INTEGER` or `HEARTS`; a `HEARTS` objective puts the value in `health` and
  reserves 90 px, and vanilla skips the column for a spectator and for anything under 5 px wide.
- The list is a movable page element, `data-move="tablist"`, so the M6 editor moves it with no
  editor change. Toasts are `data-move="toasts"`.

## The layer editor

One transparent screen over the live HUD, so what you drag is the real layer with its real
transform. It pauses in singleplayer; on a server nothing pauses, the same deal the vanilla pause
screen offers.

Three ways in: the key mapping `key.fvhud.editor`, **unbound by default** (Options, Controls, the
FateVis UI category); the `hud.editor.open` action, so a pause or options page can offer a row; and
`-PhudEditor=true` in the scripted run.

| key | what |
|---|---|
| drag a box | move the layer, snapping to the canvas centre lines, the canvas edges, the other boxes and a 2 unit grid |
| wheel, corner handle | scale, quantised to 0.05 and clamped 0.25 to 4 |
| `H` | hide or show |
| `R` | reset that layer |
| arrows, shift+arrows | nudge 1 and 8 GUI units |
| alt while dragging | no snapping |
| ctrl+Z, ctrl+shift+Z | undo and redo, a drag is one entry |
| Tab | next row |
| Esc | close |

The panel groups every row by the mod that registered it, and the count is honest: the list comes
from the registered layer list, not from what happened to draw, so a boss bar layer with no boss is
still listed and still movable.

Boxes are measured, not tabulated. A `GuiGraphics` mixin records the draw calls of the layer being
rendered while the editor is open, so the box is whatever the layer actually painted, at whatever
size, vanilla or modded. A layer drawing through its own shader records nothing and is marked
`no box` in the panel: it still moves, it just gets a plain handle instead of an outline. A hidden
layer is cancelled and draws nothing to measure, which is not a warning.

### Page elements: the `hud.layout` contract

The editor moves layers and the HUD page's own elements in one list. Mark a movable element:

```html
<div data-move="hotbar" data-label="Hotbar">
```

While the editor is open the page reports the boxes of those elements through `hud.layout.moves`
and reads the stored offsets back from the `hud.layout` topic, applying them itself:

```txt
transform: translate(Xpx, Ypx) scale(S)   /* transform-origin: 0 0 */
display: none                             /* when hidden */
```

Offsets are in GUI units, which are CSS pixels on this view. They are kept in the pack store of the
HUD view under the key `hud.layout`, so they follow the pack, not the game. The editor page never
writes that key itself - being a different pack it would land in the wrong namespace - it calls
`hud.layout.set` and the game writes.

### Actions

| id | tier | what |
|---|---|---|
| `hud.editor.open` | ask | opens the editor screen |
| `hud.editor.close` | always | closes it |
| `hud.layer.set` | ask | `{id, hidden?, x?, y?, scale?, anchor?, clip?}`, merged field by field |
| `hud.layer.reset` | ask | `{id}`, or `{}` for everything including the page elements |
| `hud.layout.set` | ask | `{id, x?, y?, scale?, hidden?}` for one page element |
| `hud.layout.moves` | always | the page reporting its element boxes |
| `hud.layout.export` | ask | writes `fvui/hud-layout-<yyyymmdd-hhmm>.json` |
| `hud.layout.import` | ask | reads one back, newest first when no `file` is given |

Every one of them refuses a caller that is not the HUD or the editor view, so a title page cannot
move the HUD even with a grant. Answers carry the resulting rule, so a page reconciles rather than
assumes. `hud.layer.set` quantises the scale and rounds the position itself; sending a scale with no
position holds the drawn corner in place, because the hook scales about the GUI origin.

### Export format

```json
{"fvui": "0.1.0", "pack": "fvhud", "packVersion": "0.1.0",
 "layers": { ...as the hud.json layers block... },
 "elements": { ...as the hud.layout store key... }}
```

A plain file in `fvui/`, so it survives a modpack update and can be shared. The layer half always
applies; the element half is dropped when the file was written by another pack.

### Replacing the editor page

The editor is the `editor` surface of the HUD pack, so a pack declaring it replaces the editor and
nothing else:

```txt
"entries": { "hud": "index.html", "editor": "editor/index.html" }
```

It runs in its own view named `hudedit`, which borrows the HUD view's active pack: a pack that
leaves `editor` out falls back to the shipped editor entry by entry, the usual rule. A third-party
editor page declares the action ids above in its manifest and gets one consent screen each.

## Containers: the `container` surface

Every `AbstractContainerScreen` can get a page skin, at one of two tiers.

**Tier A, `chrome`,** is every screen: the page draws the panel, the slot frames and the labels, and
vanilla keeps the items, the hovered highlight, the carried stack, tooltips and every click. Nothing
moves and no slot is touched, so the whole blast radius is two cancelled draw calls.

**Tier B, `relayout`,** is the player inventory and `ContainerScreen` (every chest, barrel, ender
chest and shulker box). The page also says where each slot goes; the game writes `Slot.x/y` and
moves the widgets, and vanilla still draws every item and still runs every hit test, so drag split,
shift click, double click, the hotbar keys and the tooltips all follow with no page code. Tier B is
vanilla screens only - a mod screen asking for it is logged once and falls back to `chrome`.
Creative can be relaid out too, but it ships as `chrome` and is a pack opt-in: it is the one screen
whose entire chrome is drawn inside the cancelled `renderBg`, so a page taking it on owes the tab
strip, the search field and the scrollbar.

A fifth view named `container` owns it, created the first time a skinned container opens and closed
with the world, so a player who never opens a chest pays no texture ring for it. It borrows the HUD
view's pack through `Packs.alias`, and the pack override is one more `entries` key:

```txt
"entries": { "hud": "index.html", "container": "container.html" }
```

The GUI pixel rule of the HUD view applies unchanged: `cssScale` is the player's GUI scale, so one
CSS pixel is one GUI pixel, and the page needs the same `guiWidth` correction transform. That is
what puts a page slot frame on the vanilla slot at every GUI scale.

### `hud.container`

Pushed from `ContainerScreenEvent.Render.Foreground` and diffed, so an idle chest costs nothing.
`null` while no skinned container is open.

```json
{
  "id": "net.minecraft.client.gui.screens.inventory.ContainerScreen",
  "name": "ContainerScreen", "menu": "ChestMenu", "tier": "chrome",
  "title": "Chest", "titleKey": null, "inventoryTitle": "Inventory",
  "unit": 1, "guiScale": 2, "pointer": {"x": 940, "y": 300},
  "image": {"x": 872, "y": 236, "w": 176, "h": 168},
  "labels": [{"key": "title", "text": "Chest", "x": 880, "y": 242}],
  "slots": [{"index": 0, "type": "container", "x": 880, "y": 254, "w": 16, "h": 16,
             "active": true, "empty": false}],
  "hovered": 12, "carried": {"empty": false, "id": "minecraft:cobblestone", "count": 17},
  "buttons": [{"id": 0, "kind": "button", "x": 0, "y": 0, "w": 0, "h": 0,
               "visible": true, "active": true, "label": ""}],
  "effects": {"visible": true, "x": 1050, "y": 236, "w": 32, "h": 64},
  "recipebook": {"visible": false, "movable": true, "x": 700, "y": 237, "w": 147, "h": 166},
  "creative": null
}
```

Every position is an absolute page coordinate, so a slot's vanilla `x` is `slot.x - image.x` and
`image` is `leftPos`, `topPos`, `imageWidth`, `imageHeight`. `unit` is CSS pixels per GUI pixel.
`type` is one of `container`, `result`, `fuel`, `player`, `hotbar`, `armor`, `offhand`, which is
enough to group a screen without knowing its menu. `buttons` are the screen's widgets in the
`skin.widgets` shape, and `id` is the position in that list, which is what a `widget.<id>` rect
moves; vanilla still draws the real widget over the page frame and keeps its input, so a page only
draws a plate behind one.

`pointer` is the mouse and the only per-frame field. `effects` is the potion strip, drawn by the
game and **reserved**: lay out clear of it, because nothing moves it. `recipebook` is the recipe
book, which a `recipebook` layout rect does move horizontally; it is null on a screen with no book,
and `movable` is false on a window too narrow for the book to sit beside the panel, where vanilla
pins it. A click inside an open recipe book is never guarded, so the book keeps working whatever
the page painted.

`creative` is the creative screen and null everywhere else:

```txt
"creative": {
  "tab": "minecraft:redstone_blocks",
  "tabs": [{"id": "minecraft:natural", "label": "Natural Blocks", "icon": "minecraft:grass_block",
            "top": true, "selected": false, "x": 356, "y": 205, "w": 26, "h": 32}],
  "inventoryTab": false,
  "search": {"visible": true, "text": "torch"},
  "scroll": 0.25, "canScroll": true, "rows": 42,
  "scrollbar": {"x": 531, "y": 255, "w": 14, "h": 112},
  "destroy": null
}
```

The tab strip, the search box and the scrollbar are all drawn inside the `renderBg` the skin
cancels, so a creative page **has to draw all three itself** at either tier. At `chrome` draw them
on the rects above and touch nothing else: vanilla still owns every click on them. At `relayout`
put them where you like, mark them `[data-interactive]` and send `tab`, `scroll` and `search` back.
`rows` is what is left past the five rows on screen, `scroll` walks it from 0 to 1, `destroy` is
the menu index of the bin on the survival inventory tab, and `inventoryTab` says the slots are the
player's rather than the item list. Vanilla parks the creative crafting slots at -2000: skip any
slot far outside the viewport instead of laying it out.

### `container.rects` and the item-throw rule

With chrome painted outside the vanilla image rect, a click on it is `hasClickedOutside`, which
sets the slot id to -999 and drops the carried stack on the floor. So the page reports what it
painted and the game guards those rects:

```js
fvui.call('container.rects', {epoch: 4, cssScale: 2,
                              occluders: [{x: 867, y: 213, w: 186, h: 13}],
                              interactive: [{x: 990, y: 215, w: 80, h: 12}],
                              rects: [{key: 'slot.12', kind: 'layout', x: 880, y: 254, w: 16, h: 16},
                                      {key: 'widget.0', kind: 'layout', x: 990, y: 213, w: 20, h: 18},
                                      {key: 'recipebook', kind: 'layout', x: 700, y: 237, w: 147, h: 166},
                                      {key: 'player', kind: 'entity', entity: 'player', scale: 30,
                                       x: 880, y: 240, w: 54, h: 76, pointer: {x: 0.5, y: 0.5}}]});
```

A press or a release inside an occluder is cancelled when, and only when, no active slot and no
visible widget is under the point and the point is outside the image rect - inside it vanilla
cannot throw anyway. A release is never cancelled while a quick craft or a touchscreen drag is
settling, because vanilla settles those in the release branch before the throw branch. An empty
occluder list therefore behaves exactly like vanilla, and a stack dropped on bare background still
drops in survival and still deletes in creative. Send the batch one frame after you measured it,
the `hud.rects` handshake.

### `rects`: the layout

`kind: "layout"` rects are the tier B layout. They are never drawn, and there are two keys:

- `slot.<menu index>` writes `Slot.x` and `Slot.y`. The rect is the 16x16 interior, in absolute page
  coordinates; the game subtracts `leftPos`/`topPos` for you, because that is what `isHovering`
  adds back. `leftPos` and `topPos` stay where vanilla put them, so the carried item, mod code and
  every other origin stay consistent.
- `widget.<id>` calls `setPosition` on that entry of `buttons`. A widget is moved and never
  replayed, so its vanilla input comes along for free and there is no action to send.
- `recipebook` moves the whole recipe book to that x. `RecipeBookComponent.initVisuals` derives
  every position it has from one offset, so the panel, its search box, its filter button, its
  category tabs, its hit tests and its ghost recipes all follow the one rect. Only the x is used:
  the book's y is a function of the window and stays vanilla. Send it only while
  `recipebook.movable`, and leave the rect out to put the book back where vanilla wants it.

Anything else in `rects` is an island the game draws inside the rect. `kind: "entity"` with
`entity: "player"` is the inventory puppet, which vanilla drew inside the `renderBg` we cancel;
`scale`, `yOffset`, `crouching` and a normalized `pointer` are the same props as the menu skin's.
At most 256 layout rects and 64 drawn ones are read, and the extras are skipped with one warning.

### The layout epoch

**A layout change forces a real re-init.** When the batch's layout differs from the applied one, or
vanilla moved the screen origin under it (the recipe book toggle rewrites `leftPos` and puts its own
button back), the game calls `screen.resize(..)` on the next frame, outside the render pass. That
re-runs `init()`, rebuilds every widget and re-runs `recipeBookComponent.init`, and the page rects
are applied again at the tail of `init` - so every position an `init()` cached is correct by
construction instead of being patched one at a time.

Two rules follow for a page:

- **Anchor the layout on the window, not on `image`.** `image` moves when the recipe book opens, so
  a layout that followed it would re-init itself forever.
- **Do not animate slot positions.** A layout epoch is open, resize, GUI scale change, pack switch
  or a reserved rect appearing. Three re-inits a second is the cap; past it the extras wait and one
  line is logged.

The re-init is skipped while a quick craft is in progress or a stack is on the cursor and retried
next frame, so a rebuild never lands mid-drag. A page that cannot lay a screen out (it does not
fit, say) simply sends no layout rects, and every slot goes back to where vanilla put it: an empty
batch over an applied layout is a layout epoch of its own, and the re-init rebuilds the slots.

One more rule follows from that: **do not measure a layout off positions you wrote yourself.**
Reading a grid's column count back out of `slots` is stable while the grid keeps its shape, but one
bad frame reads back as a different shape and the next layout is built on it. Take what the screen
tells you - the creative grid is always nine wide - and measure only what vanilla still owns.

### `interactive`: page input

A container page is not a screen skin. Slots, vanilla widgets and every key have to keep working,
so the page gets the pointer **only over the rects it marks `[data-interactive]`** - a creative tab
chip, the search field, the scrollbar, a page button. Inside one of those, the press, the release
and the wheel are forwarded to the page and cancelled for the screen; everywhere else nothing is
routed at all and vanilla behaves exactly as it did.

Keyboard focus is narrower still. The view is unfocused for its whole life except while a page text
field says it is holding the keyboard:

```html
<input @focus="act('container.act', {action: 'focus', on: true})"
       @blur="act('container.act', {action: 'focus', on: false})" />
```

While it does, key and character events go to the page and not to the screen. **Esc always comes
back:** pressed with a page field open it blurs the field, hands the keyboard back and fires a
`container.blur` event the page listens for; pressed again - or with no field open - it is a plain
key and closes the screen. A press anywhere outside the interactive rects blurs too, so a field can
never hold the keyboard for good.

```js
fvui.on('container.blur', () => document.activeElement?.blur());
```

Mark a control `[data-interactive]` **and** `[data-occluder]`: interactive is what routes the
pointer, occluder is what keeps the click from also reading as `hasClickedOutside`.

### `container.act`

```js
await act('container.act', { action: 'close' });
```

For page chrome that has no widget behind it. Slot clicks and widget presses are never actions.

| action | payload | effect |
|---|---|---|
| `close` | - | closes the container and the screen |
| `recipebook` | - | toggles the recipe book and re-inits the screen, the recipe button's own path |
| `focus` | `{on}` | the page's text field took or gave up the keyboard |
| `tab` | `{id}` | selects that creative tab, and the page layout is re-applied at the tail of it |
| `scroll` | `{value}` | the creative scroll offset, clamped to 0 to 1 |
| `search` | `{text}` | writes the creative search box and re-runs the search |

A creative tab switch rebuilds every slot as a fresh wrapper at vanilla coordinates, which is why
the layout goes back on inside `selectTab` and not a frame later.

### Exclusion zones: JEI, EMI and REI

Whatever the page paints is handed to whichever recipe viewer is installed, so its item list never
draws over the skin. Three adapters under `fatevis.fvhud.container.compat` answer with one cached
union of the reported occluders plus the vanilla image rect, in GUI pixels: a `@JeiPlugin`
registering an `IGlobalGuiHandler`, an `@EmiEntrypoint` calling `addGenericExclusionArea`, and a
`@REIPluginClient` registering an `ExclusionZonesProvider`. All three find their plugin by scanning
for their own annotation, so fvhud compiles against the API jars and has no runtime dependency on
any of them - nothing is in `neoforge.mods.toml` and nothing loads when the viewer is absent. The
union drops zero-area rects, drops a rect inside another, merges two sharing a whole edge and comes
back in a stable order, because JEI polls it every render frame and diffs the answer itself. A page
needs no code for this: report your occluders and the zones follow.

### Which screens are skinned

`config/fvhud-containers.json`, written with the defaults on first run:

```json
{"enabled": true, "modScreens": false, "include": [], "exclude": [], "tier": {}}
```

`tier` is `off`, `chrome` or `relayout` per screen id, and an id may end in `*` to match a package.
It holds your overrides only, never a copy of the shipped table, so a screen that moves to another
tier in a later version reaches you. The order is `exclude`, then the file's `tier`, then a pack's
`containers` block, then the shipped defaults, then the allowlists - so the file always wins and a
pack only ever adds. The twenty-one vanilla container screens ship on: `InventoryScreen` and
`ContainerScreen` as `relayout`, the other nineteen as `chrome`. A mod screen is opt-in by id or
with `modScreens`, and `relayout` on a mod screen is refused with one log line and falls back to
`chrome`: tier B is vanilla only. `-Dfvhud.containers=false` turns the whole feature off.

A pack asks for the same four fields in its manifest:

```txt
"containers": {"include": ["com.example.StorageScreen"], "exclude": [], "tier": {}, "modScreens": false}
```

Anything of ours that throws on a screen takes that screen class out of the feature and writes it
into `exclude`, so one broken mod screen renders vanilla from then on instead of taking containers
down.

Mod screens checked on NeoForge 1.21.1, all at `chrome`:

| mod | screen class | result |
|---|---|---|
| Metal Barrels 7 | `tfar.metalbarrels.client.MetalBarrelScreen` | a plain 90 slot subclass, skinned, nothing to report |
| Tom's Simple Storage 2.4.2 | `com.tom.storagemod.screen.CraftingTerminalScreen` | custom widgets and its own grid, skinned; its side buttons sit outside the panel rect, so the page frame does not reach them |
| Storage Drawers 13.11.4 | `com.jaquadro.minecraft.storagedrawers.inventory.FramingTableScreen` | asked for `relayout`, refused to `chrome` with one log line |

None of the three tripped the crash guard, and all three keep every click.

## Item icons: the `item` host

A page listing items outside slots - a recipe browser, a pack index - has nothing to draw into, so
the game bakes a PNG per stack and serves it from `fvui://item/`. The page never guesses a URL:

```js
const need = await act('item.icons', { items: [{ id: 'minecraft:bread', count: 3 }] });
const url = need.urls['minecraft:bread|3|'];
```

The key is `<id>|<count>|<components>`, where `components` is the SNBT of a `DataComponentPatch`
and is usually empty. Missing items are left out of `urls`, the `res.need` rule. The file is 64 px,
so draw it at 1x to 4x with `image-rendering: pixelated` and nothing resamples. A resource reload
bumps `item.epoch` and the URLs change with it.

A baked PNG is one frame, and that is the whole limit list: no glint animation, no animated texture
past its first frame, no per-tick model state, and a dynamic model frozen in its bake-time pose.
The damage bar and the count are baked in as vanilla draws them. Anything that has to be live is an
island rect instead - islands for a visible grid, baked icons for a long scrolled list.

## Chrome sprites

Everything the page draws around the game's own art - the container window, its wells, slot frames,
buttons, the creative tab strip, search field and scrollbar, the tooltip plate, toasts, the tab list
panels, the chat input row and the boss bar frame - is a nine-slice pixel sprite, not a flat token
fill. The sheets live in `fvui://hud/chrome/<preset>/`, one per preset, drawn by
`tools/chrome-sprites.py`; `--rim`, `--bevel` and `--sunk` ([Pack format](/en/fv-ui/packs)) move the CSS half with them.

`@fvui/sdk` exports the geometry, so a pack page can use the same plates:

```js
import { loadNine, nineTiles } from '@fvui/sdk'

const sprite = { url: 'panel.png', w: 7, h: 7, border: { left: 3, top: 3, right: 3, bottom: 3 } }
for (const tile of nineTiles(sprite, 200, 80)) Object.assign(div().style, tile.style)
```

`nineTiles` answers nine absolutely positioned tiles filling a `w` x `h` box, each one scaling the
whole sheet so its own slice lands on the tile. That is how a nine-slice is drawn here at all:
`border-image` draws nothing in servo ([Servo support matrix](/en/fv-ui/servo)). `hollow: true` leaves the centre out, for a
frame with nothing inside it. The slices stretch where vanilla tiles, so keep every edge strip
uniform along its length. `loadNine(url, fallback)` reads a sprite plus its `.png.mcmeta`
(`gui.scaling.type: "nine_slice"`) and scales the border by the real texture size.

The hotbar, hearts, armour, food, air, the xp bar, the effect icons and the boss bar sprite itself
stay vanilla, pixel for pixel; the boss frame is a hollow ring two pixels clear of the bar. The pack
store key `ui.chrome` picks `page`, `pack` or `flat`, see [Pack format](/en/fv-ui/packs).

## Dev switches

`mods/hud/build.gradle` carries its own map on top of the common ones of [Dev workflow](/en/fv-ui/dev-workflow).

| property | system property | effect |
|---|---|---|
| `-PwithMenu=true` | - | also load fvmenu, the default run proves fvhud stands alone |
| `-PdevWorld=flat` | `fvhud.dev.world` | test world preset, `flat` or `normal` |
| `-PhudOff=true` | `fvhud.off` | no view and no cancelling, the vanilla baseline of a pixel diff |
| `-PhudItems=false` | `fvhud.items` | draw the page without any island |
| `-PhudLayer=<id>:x,y,scale` | `fvhud.dev.layer` | override `hud.json` for one run, `<id>:hide` to cancel, `;` separated |
| `-PhudTestLayer=true` | `fvhud.dev.testlayer` | register `fvhuddev:marker`, the stand-in for a mod layer fvhud must not touch |
| `-PhudEditor=true` | `fvhud.dev.editor` | run the layer editor script instead of the HUD one |
| `-PdevContainers=true` | `fvhud.dev.containers` | run the container script instead: the relaid inventory and chest, real mouse and key events, the throw guard |
| `-PdevIcons=<id>,<id>` | `fvhud.dev.icons` | show the baked icon strip on the container page, the icon host check |
| `-PcontainerTier=<id>=<tier>` | `fvhud.containers.tier` | force a screen's tier for one run, `,` separated, wins over the config file |
| `-PdevModBlocks=<id>,<id>` | `fvhud.dev.modblocks` | blocks the container script places and uses, the mod container compat pass |
| `-PrunMods=<dir>` | - | copy every jar in that directory into `run/mods` before the client starts |
| `-PdevChat=true` | `fvhud.dev.chat` | run the chat script instead: say, a formatted tellraw, a wrap, a pack font, the ring, the fade, the chat screen, scale 2 and 3 |
| `-PchatScreen=false` | `fvhud.chat.screen` | leave the chat screen vanilla, the page keeps the in-world chat |
| `-PdevOverlays=true` | `fvhud.dev.overlays` | run the overlay script instead: an inventory tooltip, the three toast kinds, the tab list with two players, a death and a respawn |
| `-PhudTooltips=<class>,<class>` | `fvhud.dev.tooltips` | opt those screens into page tooltips for one run, `*` for all of them |
| `-PfontBake=false` | `fvui.font.bake` | no baked font and no coverage, so every chat row takes the text island |
| `-PfontUnihex=true` | `fvui.font.unihex` | also bake the 20k glyph unicode fallback, 14 MB of face instead of 1.5 |
| `-PhudContainers=false` | `fvhud.containers` | the container kill switch, no view and no suppression |
| `-PdevReactive=true` | `fvhud.dev.reactive` | run the M14 effect script instead: a hit from four bearings, the crack buckets and the beat, the tremor, a damaged helmet, fire, water, powder snow, a portal, the effect rings, a hotbar walk, the tab list, a chat line, a wither for the boss island, a level up, scale 2 and 3 |

```sh
xvfb-run -a -s "-screen 0 1920x1080x24" env -u WAYLAND_DISPLAY \
  ./gradlew :hud:runClient -PdevOut=.work/run-hud -PdevQuit=true -PdevPerf=true
```

Without a game, the shipped page fills its own topics from `?demo=hud`: `overlays=1` adds the
tooltip, the toasts and the tab list, `chat=1` the backlog and `chat=screen` the focused chat with
the suggestion popup, plus `scale=`, `lines=`, `scroll=`, `players=`, `toasts=`, `tip=off`. The
reactive states have their own: `hit=<degrees>` fires a damage indicator, `unaimed` makes it
symmetric, `kind=` picks the strip, `critical` cracks the hearts and starts the beat, `levelup` runs
the burst, `island=<id>` gives the boss bar a puppet, `starving` and `food=` drive the tremor,
`fire`, `frozen=<ticks>`, `portal=<0..1>` and `hearts=poisoned|withered` pick an edge tint,
`armorlow=<0..1>` cracks the armor row, and `reactive=off`, `fx=<id>,<id>`, `intensity=` and
`motion=reduce` drive the toggle and the reduced variants. Two effects need a change rather than a
state, so they get a second push 300 ms in: `pop` drains the air bar by one bubble and `swap=<slot>`
moves the hotbar frame.

## What is not here yet

A mod cannot register a toast or a tooltip describer of its own, so a
modded toast draws natively over the page and a screen carrying a modded tooltip component keeps
the vanilla tooltip whole. Page tooltips are opt in per screen and the shipped `hud.json` opts in
nothing. The recipe
book moves horizontally only: faking its `height` would move it vertically too, but it lies to a
field its own page also pages off, so that half is deferred. Tier B is still vanilla screens only,
and only the inventory, the chests and creative: brewing, enchanting, anvil, beacon, merchant and
the list screens are one adapter each and are not written. The layout document, prefabs and
the keyframe timeline are M8. The editor's responsive
check draws box outlines, not a rendered preview, and cannot apply a GUI scale for you:
`options.write` is a reserved id no mod answers yet. A true eraser rect for mods drawing outside
layer events needs a stencil pass and is not built. Chat is clickable only while the chat screen is
open, exactly as vanilla chat is unclickable until `ChatScreen` opens, and `text.click` refuses a
call made without a screen. On that screen unlimited scrollback and its persistence are not built,
and a usage row with a pack font is drawn as HTML instead of as an island.
