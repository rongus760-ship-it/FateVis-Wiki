# Surfaces and the skin model

The menu is one WebView and one document. It does not load a page per screen, it switches modes.

## Modes

The host emits `mode` whenever the surface changes:

```js
fvui.on('mode', (e) => {
  // e.mode: "loading" | "title" | "skin", e.gen: a counter, e.data: per mode
  render(e.mode, e.data);
});
```

| mode | surface | `data` |
|---|---|---|
| `loading` | `loading` | null, everything is in the `loading.*` topics |
| `title` | `title` | null, everything is in `title.state`, `worlds`, `servers` |
| `skin` | `skin` | the screen info plus its first widget snapshot |

`gen` counts switches, which is the key to render a fresh view for a repeated mode. The title data
is kept in the topic store after the last release, so switching back to the title renders a
complete first frame.

Frames are never held back on a switch. A couple of frames of the previous page look better than
the vanilla screen flashing through, which is why the `skin` payload carries the first widget set.

## The page URL

The game builds the url of the current surface, so the first frame is complete before any tick has
run:

```txt
fvui://menu/index.html?blur=5&speed=1.0&splash=1&contrast=0&pack=example&preset=default&theme=fvui%3A%2F%2Fmenu%2Ftheme.css%3Fr%3D0&r=1
```

| param | meaning |
|---|---|
| `blur`, `speed`, `splash`, `contrast` | the four client prefs, also the `options.prefs` topic |
| `pack` | the active pack id, the key of its store |
| `preset` | `default`, `high-contrast` or `vanilla` |
| `theme` | url of the pack theme file, absent when the pack declares none |
| `backdrop-sharp`, `backdrop-blur5`, `backdrop-blur10`, `backdrop-loading` | the `--backdrop-*` token values from the manifest `backdrop`, absent when it declares none |
| `r` | pack reload generation, absent on the first load |

Only the entry file decides on a real load. A preset change, a mode switch inside one file and a
prefs change never reload the page.

## Surfaces

`title`, `loading` and `skin` in the menu view. `hud`, `editor` and `container` belong to fvhud,
[The HUD surface](/en/fv-hud/hud-surface). A pack declares the ones it wants in `entries`; the rest fall back to the shipped pack
file by file.

A page may implement all three in one file and branch on `mode`, which is what the shipped pack
does and what keeps switches flash free.

## Skins

A skinned screen keeps all its logic, the page takes the look. `SkinModel` picks one of three
layouts and reports it in the screen info:

| layout | when | who owns the pointer |
|---|---|---|
| `flow` | Options, pause, death and out of memory, where the page understands every part | the page |
| `mirror` | every other skinned screen | vanilla |
| `loading` | the four screen phases of the loading stream, [Loading page](/en/fv-menu/loading) | vanilla |

In flow the page lays the screen out itself, all list rows are exported and it sends actions back.
In mirror the page draws widgets at the vanilla bounds and vanilla keeps clicks, focus, sounds,
sliders, text input and scrolling. Flow is only used when nothing is left vanilla under the page,
because flow routes the pointer away from whatever it does not draw.

In loading the page owns the frame over the whole window and the screen info `phase` says which
phase of `loading.info` it belongs to. The vanilla render of those screens is cancelled outright, so
their hand drawn status text in the vanilla font is gone rather than left readable under a
translucent frame; level loading's chunk grid comes back as an island the page places. Portal
terrain is the exception: it keeps its render and its skin stays see-through, because that
background is a GL effect the page cannot draw. Under any page frame the game fills the page ink,
never the panorama, so a page that is briefly translucent shows ink and not the vanilla menu.

Which screens are skinned at all: `config/fvmenu-skins.json` with `enabled`, `modScreens`,
`include` and `exclude`, and the manifest `skins` block merged under it. The pack only adds rules,
`exclude` is read before `include`, so the config file can always veto. Never skinned: the web
screens themselves, the consent screen, containers, chat, books, signs, credits and level loading.
Containers are fvhud's own surface and never fvmenu's, so the two mods can never both own a screen.
The chat screen is the same split: fvhud draws it from the HUD surface, because it sits on the chat
backlog the HUD page already owns, and it keeps the vanilla text field. See [The HUD surface](/en/fv-hud/hud-surface).

## Screen info

The `data` of a `skin` mode, and the fields a layout reads:

```json
{
  "id": "net.minecraft.client.gui.screens.options.OptionsScreen",
  "name": "OptionsScreen",
  "layout": "flow",
  "phase": null,
  "title": "Options",
  "titleKey": "options.title",
  "parent": "Options",
  "inGame": false,
  "unit": 2.0,
  "choiceControl": "auto",
  "backdrop": true,
  "widgets": [ ... ],
  "loading": null
}
```

`unit` is CSS pixels per GUI pixel, the number that turns vanilla bounds into page coordinates.
`parent` is present only for a sub screen. `inGame` is true when a level is loaded, so the page
stays see-through over the world. `backdrop` false means the screen draws over the page frame and
the page must not paint an opaque background. `choiceControl` comes from the pack store key
`ui.choiceControl`. `phase` is set only for the `loading` layout, and so is `loading`: the first
`loading.info` and `loading.progress` of that phase, carried here because the switch is an eval and
the topics are a state flush that lands after it. Apply them before you render the mode, or the page
lays the new phase out on the previous one's numbers.

## Widgets

`skin.widgets` is a flat list, pushed after every render of a skinned screen and diffed, so an
unchanged screen costs nothing. Every entry has:

```json
{"id": 7, "kind": "cycle", "x": 240, "y": 320, "w": 300, "h": 40, "visible": true, "clip": 3}
```

`x`, `y`, `w` and `h` are CSS pixels. `clip` is the id of the list an entry belongs to; rows the
page lays out itself carry zero bounds and are positioned by the page.

| kind | source | extra fields |
|---|---|---|
| `button` | any button | the common set below |
| `link` | `PlainTextButton` | the common set |
| `tab` | `TabButton` | `selected` |
| `cycle` | `CycleButton` | `values`, `index`, `selected` for an ON/OFF option |
| `checkbox` | `Checkbox` | `selected` |
| `slider` | slider button | `value`, 0 to 1 |
| `input` | `EditBox` | `value`, `cursor` |
| `text` | string widget | `align` |
| `list` | a list whose rows the page draws | `scroll`, `maxScroll`, both in CSS px |
| `native` | icon buttons, custom widgets, lists with hand drawn rows | `scroll`, `maxScroll` for lists |
| `key` | a key bind row, flow only | `valueText`, `conflict`, `waiting`, `unbound`, `reset` |
| `choice` | a language row, flow only | `selected` |

Common set on everything but `native`: `label`, `key` (the translation key, when the label has
one), `active`, `focused`, `hovered`, and `tooltip` when the pointer is on it or the layout is
flow. Option widgets also carry `caption` (the option name) and `valueText` (the translated value
without the name), so the page does not have to split the label.

`values` on a cycle is every value text, `index` the current one. Lists longer than 64 values are
left out and the control stays click to cycle.

A `key` row carries the change button as its widget and `reset: {id, active}` for the reset button
next to it. `focused` is set only for the end of the screen's focus path, and only after keyboard
input or for a text field, the way vanilla shows it.

Native entries get bounds and nothing else: vanilla draws them over the page frame.

## skin.act

Flow layouts send actions back. This is a bridge method of its own, not an `act` id:

```js
const skinAct = (action) => fvui.call('skin.act', action);

skinAct({action: 'press', id: 7, fx: 0.5});
skinAct({action: 'set', id: 7, index: 2});
skinAct({action: 'drag', id: 9, fx: 0.35});
skinAct({action: 'release', id: 9, fx: 0.35});
skinAct({action: 'back'});
skinAct({action: 'blur'});
skinAct({action: 'modal', open: true});
```

| action | args | effect |
|---|---|---|
| `press` | `id`, `fx` | replays a click at that fraction of the widget width |
| `set` | `id`, `index` | sets a cycle value in one step with the vanilla callback |
| `drag` | `id`, `fx` | drags a slider, one per animation frame |
| `release` | `id`, `fx` | ends a drag |
| `back` | none | closes the screen |
| `blur` | none | drops the screen focus |
| `modal` | `open` | while true, key events go to the page instead of the screen |

`fx` defaults to 0.5 and is clamped to 0..1. A press on a row without a widget (a language row)
selects it; a second quick press applies. `press` and `set` go through the screen's own
`mouseClicked`, because screens react there (Video Settings opens the Fabulous warning that way).
An action on a widget that is not active, or on an unknown id, answers `false`.

`modal` is what makes Esc close a page dropdown instead of the screen.

## Pause layout

`PauseScreen` is a flow screen: its children are plain buttons and one string widget, so the page
lays the rows out and every vanilla handler still runs behind them - advancements, statistics, the
mods button, the feedback links, Open to LAN or Player Reporting, and Save and Quit or Disconnect.
Match rows by their translation key (`menu.returnToGame`, `menu.options`, `menu.shareToLan`,
`menu.returnToMenu`), and give anything you do not recognise a place of its own: a mod that adds a
row must not land on top of one you placed.

`PauseScreen(false)`, the one the game opens when the window loses focus, has no widgets and no
background and is never skinned.

In game the page is drawn over the vanilla blur and the world stays live under it. `--shade` is how
dark the page shades the world, 0 leaves it untouched. Options opened from pause is an
`OptionsScreen` with `inGame` true and the same tokens, so the two screens look continuous.

## Death layout

`DeathScreen` is a flow screen too, and like the loading screens its vanilla render is cancelled:
the title, the cause of death and the score are drawn by hand with no widget to hide, so covering
them would leave them readable through the page. The page owns the whole frame, the red gradient
included.

Both buttons come from the widget snapshot, so respawn or spectate, the title screen button with
its nested confirm screen and the draft report badge all keep their vanilla handlers, and the 20
tick delay before they become live arrives as the `active` flag. The three fields the snapshot
cannot carry come from a topic of its own:

```json
{ cause: "Dev was slain by Zombie", causeHtml: "...", causeToken: "1f4c...",
  score: "Score: 0", scoreHtml: "...", hardcore: false,
  top: 1615855616, bottom: -1602211792 }
```

`top` and `bottom` are vanilla's own `fillGradient` values, packed ARGB. The cause is clickable and
hoverable through the `text.*` actions of [Topics and actions](/en/fv-ui/topics-actions), which is what `DeathScreen.mouseClicked` does
for `OPEN_URL` today, widened to every action because the page has the pointer: report the span
rects with `text.rects` first, because a click outside a reported rect is refused.

`OutOfMemoryScreen` is a plain flow screen with a Back to Title and a Quit button and needs no
layout of its own.

## Islands

Some things the game must draw itself: a chunk grid that is a per frame read of server state, an
entity that every model mod hooks. The page lays out a box, reports its rect, and the game draws
into it after the page frame.

```js
fvui.call('menu.rects', {
  epoch: 4, cssScale: 2,
  rects: [
    {key: 'grid', kind: 'grid', x: 760, y: 380, w: 100, h: 100},
    {key: 'player', kind: 'entity', entity: 'player', scale: 30, crouching: true,
     x: 940, y: 520, w: 36, h: 108, pointer: {x: 0.5, y: 0.4}}
  ]
});
```

Two kinds in the menu view, `entity` and `grid`, and two islands per screen at most; a page that
asks for more gets one warn line and the extras are skipped. Rects are CSS pixels. `pointer` is the
page's normalized pointer inside the rect, which the game turns into the two rotation angles the
vanilla inventory derives from the mouse; without it the pose is fixed. Send the batch one frame
after you measured it, so the frame that carries it has been painted - the SDK's `trackIslands`
does that, hashes the rects and calls only when they moved.

The client player does not exist yet inside the singleplayer world load loop, so an `entity` island
draws nothing during the `level` phase of a local world. Reserve the box anyway; on a server join
and on pause it is the live entity.
