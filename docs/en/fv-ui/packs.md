# Packs

A pack is a directory with `fvui.pack.json` at its root. Everything else is optional. The shipped
menu is itself a pack, inside `fv-menu.jar`, and is the fallback of every surface a player pack
does not claim.

## Manifest

```json
{
  "id": "example",
  "version": "1.0.0",
  "name": "Example Pack",
  "authors": ["fatevis"],
  "license": "MIT",
  "description": "One line for the picker.",
  "fvui": ">=0.1.0",
  "entries": {"title": "index.html"},
  "theme": "theme.css",
  "backdrop": {"image": "art/back.png", "loading": "art/loading.png"},
  "capabilities": ["state.sub", "open", "quit"],
  "skins": {"include": [], "exclude": [], "modScreens": false},
  "res": ["minecraft/textures/block/grass_block_side.png"],
  "sounds": {"click": "sounds/click.ogg"}
}
```

| field | rule |
|---|---|
| `id` | matches `[a-z0-9_-]{3,64}` and equals the directory name |
| `version` | `\d+(\.\d+)*` with an optional suffix, also stamped into the pack store file |
| `name` | shown on the consent screen and in the picker |
| `authors` | list of strings |
| `license` | free text |
| `description` | one line |
| `fvui` | version range: `>=0.1.0`, `<=0.2`, `0.1.0`, or a maven range `[0.1.0,0.2)` |
| `entries` | surface to file, surfaces are `title`, `loading`, `skin` and `hud` |
| `theme` | one CSS file of token overrides |
| `backdrop` | the `--backdrop-*` images, a string is the short form of one image for all four |
| `capabilities` | what the pack may ask for, [Capabilities](/en/fv-ui/capabilities) |
| `skins` | merged under `config/fvmenu-skins.json`, the config file wins |
| `res` | game resource paths extracted into `fvui://res/` before the first frame |
| `sounds` | ogg files the pack ships, by sound name, see "Pack sounds" |

Required: `id`, `version` and one of an entry, a theme or a backdrop. A pack with only a theme or a
backdrop is legal and repaints the shipped pages.

`hud` is reserved as a fourth surface and lands with the HUD view.

Validation is one line per problem in the log, then the pack is skipped. Checked: the manifest
parses, the id pattern and the directory name, the version, the `fvui` range against the installed
mod version, known surfaces, every entry and the theme file exists inside the pack root and none
escapes it, every capability is known and none is forbidden, every sound name is legal and its ogg
is there.

`docs/dk/fvui.pack.schema.json` is the same shape as a JSON schema, for an editor or a build step.
It is stricter than the game on one point: an unknown field fails there, while Gson simply drops
it. `node tools/check-dk.mjs` validates every manifest in this tree against it.

## Where a pack lives

First hit per id wins:

```txt
-Dfvui.dev.pack=<dir>              dev override, wins over packs.json
<gamedir>/fvui/packs/<id>/         directory pack
<gamedir>/fvui/packs/<id>.zip      zip pack
the default pack inside fv-menu.jar
```

A zip is extracted once per zip build into `<gamedir>/.fvui/cache/packs/<id>-<size>-<mtime>/`,
because the native side serves plain files only. Directories beat zips of the same id.

## Which pack is active

`<gamedir>/fvui/packs.json`:

```json
{"active": {"menu": "example"}, "disabled": {}, "grants": {}}
```

One active pack per view, not per surface: the menu is one document that switches modes. The file
is in `fvui/`, not in `config/`, which a modpack update overwrites. An unknown, invalid or disabled
id logs one warn line and the view stays on the default pack.

Fallback is entry by entry. A pack declaring only `entries.title` keeps the shipped loading page
and the shipped screen skins.

## Hosts

| url | serves |
|---|---|
| `fvui://menu/` | the root of the active pack of the menu view |
| `fvui://ui/` | the root of the default pack, the fallback of missing entries |
| `fvui://res/` | the game resource cache |
| `fvui://saves/` | the saves directory, for world icons |
| `fvui://bridge/bridge.js` | the bridge script |

A pack page therefore links its own files relatively, and the file host sends no cache headers.

## Resources

Game textures are not readable from a page, so ask for them:

```js
const need = await fvui.call('act', {id: 'res.need', args: {paths: ['minecraft/textures/block/dirt.png']}});
document.querySelector('img').src = need.urls['minecraft/textures/block/dirt.png'];
```

The answer is `{epoch, urls}`. A path that does not exist or escapes the cache is left out of
`urls` and logged once. The manifest `res` list is extracted before the first frame, `res.need`
covers everything later. Paths are `<namespace>/<path>`.

Each url carries `?v=<epoch>`. A resource reload writes a fresh epoch directory, re-registers the
host and pushes the `res.epoch` topic, and the `?v=` is what makes the engine re-read: follow that
topic and rebuild the urls.

Translations do not go through the cache, the table would be megabytes:

```js
const lang = await fvui.call('act', {id: 'res.lang', args: {keys: ['menu.options']}});
// or {prefix: 'options.'} , at least two characters or the call fails with bad-args
```

## Pack sounds

A pack can ship its own ogg files and play them with `sound.play` and `music.set`:

```txt
"sounds": {
  "click": "sounds/click.ogg",
  "menu": {"file": "sounds/menu.ogg", "stream": true, "subtitle": "example.menu"}
}
```

A string is the short form of `{"file": ...}`. The same block may live in `sounds.json` beside the
manifest instead; entries in the manifest win. Names match `[a-z0-9_.-]{1,64}`, the file must end in
`.ogg` and sit inside the pack, and a missing file is a validation problem like any other.

The id is `fvui:pack.<pack id>.<name>`, so the manifest above gives
`fvui:pack.example.click` and `fvui:pack.example.menu`. Ids are namespaced per pack, so two packs
cannot collide, and a pack may play its own sounds without the `sound.any` grant: they are its own
data. `stream` belongs on anything longer than a few seconds, music above all.

```js
await fvui.call('act', {id: 'music.set', args: {id: 'fvui:pack.example.menu', loop: true}});
```

Volume follows the category as always: `music.set` is on the MUSIC slider, `sound.play` defaults to
MASTER and takes a `category`.

The game reads these files from a hidden resource pack fvui injects into the client's pack
repository, which is built when that repository reloads. A pack that gains or loses a sound
therefore needs a resource reload (F3+T) and not only the pack hot reload of F6; the ogg files
themselves are read from disk on every play, so replacing one needs neither.

## Pack store

`<gamedir>/fvui_data/<pack id>/store.json`, one namespace per pack, outside `config/` and outside
the pack itself, so neither a pack nor a modpack update drops player data.

```js
await fvui.call('act', {id: 'store.set', args: {key: 'example.runs', value: 3}});
const dump = await fvui.call('act', {id: 'store.get'});   // {version, data}
const one = await fvui.call('act', {id: 'store.get', args: {key: 'example.runs'}});
```

`version` is the pack version that last wrote the file. It changes only on the next write, so a
page sees the old one once after a pack update, migrates what it understands and writes. Java never
interprets pack data and there is no migration hook.

Limits, rejected with `{code: "limit"}` and one warn line, the file unchanged: 16 KB per value,
256 KB per file, 512 keys, 128 characters per key. Writes are flushed 2 s after the last change,
on screen close and on game shutdown, always tmp file plus atomic move.

Keys the shipped pages read: `ui.theme` (`default`, `high-contrast`, `vanilla` or `auto`),
`ui.choiceControl` (`auto`, `dropdown`, `cycle`), `ui.hoverSound`, `ui.showcaseQuality` (`off`,
`low`, `high`) and `ui.reducedMotion` (`auto`, `on`, `off`), plus the card row's `ui.serverView`
(`list` or `cards`) and `ui.serverSort` (`list`, `tier`, `joined`, `name`, `ping`) - [Server cards](/en/fv-menu/server-cards).
The shipped page shows all of them as rows in the pack panel, which K opens on the title.

## Theme

`theme.css` is plain unlayered CSS. The presets the shipped page carries sit in a CSS layer, so an
unlayered `:root` block beats all of them without matching their specificity. A four line file is a
real theme.

```txt
:root { --glow: #ffb347; --paper: #f2efe6; --sans: "Geologica", sans-serif; --text: 16px; }
```

| token | kind | paints |
|---|---|---|
| `--ink` | `R, G, B` | page base, used at many alphas as `rgba(var(--ink), 0.8)` |
| `--panel` | `R, G, B` | raised plates: cards, hover fills |
| `--pop` | `R, G, B` | popovers over them: dropdown bodies |
| `--paper` | colour | primary text and bright fills |
| `--dim` | colour | secondary text |
| `--faint` | colour | hairlines and control outlines |
| `--glow` | colour | accent: focus, sliders, the primary button |
| `--rim` | colour | lit pixel rim of a chrome plate, its top and left |
| `--bevel` | colour | the bevel pixel under the rim |
| `--sunk` | colour | deepest recess: scroll tracks, fields |
| `--ok` | colour | positive state |
| `--bad` | colour | negative state |
| `--sans` | font stack | headings and body |
| `--mono` | font stack | labels, numbers, keys |
| `--text` | length | base font size |
| `--ease` | easing | shared transition curve |
| `--photo` | 0..1 | how much of the backdrop photo shows through |
| `--pixel` | `auto` or `pixelated` | `image-rendering` of the photos |
| `--shade` | 0..1 | how dark an in game menu shades the world, 0 leaves it untouched |
| `--backdrop-sharp` | `url(...)` | the menu backdrop at blur 0 |
| `--backdrop-blur5` | `url(...)` | the same photo at Menu Background Blur 5 |
| `--backdrop-blur10` | `url(...)` | the same photo at blur 10 |
| `--backdrop-loading` | `url(...)` | the backdrop of the loading page |

The three surface tokens are `R, G, B` triples because they are composited at many alphas. Content
colours are complete CSS colours and their alpha variants use
`color-mix(in srgb, var(--glow) 10%, transparent)`, which works in servo 0.5.

The four `--backdrop-*` tokens are the half of a backdrop a theme file can own by itself: it is
served from the pack host, so a relative `url(art/x.png)` in it resolves against the pack and four
lines of CSS are enough to replace the shipped photos. The manifest `backdrop` is the other half,
for the first frame and for a pack with no theme file at all; it wins nothing over the theme file,
it is simply applied earlier and re-applied on a pack switch with no reload.

Delivery: the game appends `preset=<id>`, `theme=<url>` when the manifest declares one, and one
`backdrop-<slot>=<url>` per declared backdrop image, to the page URL, so the first frame is already
themed. A pack page that replaces a surface links its own
file. A pack that only declares `theme` and no entries still gets its file applied to the shipped
pages, because it keeps its own host.

The preset and the backdrop tokens also ride the `theme` topic as `{preset, vars}`, so a High
Contrast change or a pack switch repaints without a reload.

Not themed: the early window copy of the loading page is native Java and reads none of this, so a
pack that repaints loading still differs from the first second of the launch.

## Container and HUD chrome

Containers, tooltips, toasts, the tab list, the chat input row and the boss bar frame are drawn
from pixel sprites, not from a flat token fill: one hard outline, a lit rim on the top and left, a
shadow on the bottom and right, then the body. The sheets ship per preset in
`fvui://hud/chrome/<preset>/`; `--rim`, `--bevel` and `--sunk` are the tokens the CSS half of that
look reads, so a theme file still moves the hairlines, the captions and the accent with it.

The hotbar, hearts, armour, food, air, the xp bar, the effect icons and the boss bar sprite itself
stay vanilla, pixel for pixel. Nothing a theme file sets moves them.

The pack store key `ui.chrome` picks where the sprites come from:

| value | effect |
|---|---|
| `page` | my sheets, the default |
| `pack` | the player's resource pack, read from `fvui://res/` |
| `flat` | no sprites, the plain token fill |

In `pack` mode every piece is a vanilla GUI sprite a resource pack can already override -
`popup/background`, `widget/button`, `widget/tab`, `widget/tab_selected`, `widget/text_field`,
`widget/scroller_background`, `widget/scroller`, `container/bundle/background`, `container/slot` -
and its nine-slice border comes from that sprite's own `.png.mcmeta`. A GUI pack therefore recolours
our chrome with no pack of ours at all. Two limits: the slices stretch where vanilla tiles, which
only shows on a patterned rim, and there is no vanilla sprite for the boss bar frame, so it is
absent in this mode.

## Lifecycle

| key | effect |
|---|---|
| F6 | on any screen, re-reads every manifest from disk and loads the current surface again |
| K | on the shipped title page, the pack picker |

F6 is the author loop: edit a file, press F6, no restart and no second engine. The reload bumps a
generation that rides the page URL as `&r=<n>`, because file hosts send no cache headers and the
same URL could hand the engine the document of the pack just left. Files a page links relatively
are not busted by it, so a page appends that `r` to its own links:

```html
<script>
  const bust = new URLSearchParams(location.search).get('r') || '0';
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="theme.css?r=' + bust + '">');
</script>
```

`pack.activate {id}` switches at runtime, writes `active` in `packs.json` and reloads. It is an
ask capability, so the shipped pack switches untouched (it is trusted) while any other pack needs
the grant, the way back to the default included.

A page that crashes puts its pack in the `disabled` section of `packs.json`, keyed by the hash of
its `fvui.pack.json`, and the view falls back to the default pack. It comes back by itself once
that hash changes, that is, once its author touched the manifest.

A surface whose entry is a different file than the loaded one is a real page load, and it costs two
frames of vanilla between the old document and the first frame of the new one. A pack that wants no
flash keeps one file for every surface, as the shipped pack does.
