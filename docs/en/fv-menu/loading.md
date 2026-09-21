# Loading page

One stream, five phases. Everything that makes the player wait pushes the same two topics, so a
pack writes one `loading` entry and it serves the launch, the world load and every join.

| phase | screen | progress | actions |
|---|---|---|---|
| `boot` | the game's loading overlay | the reload, 0..1 | none |
| `datapack` | `GenericMessageScreen`, `ProgressScreen` | the stage percent, else indeterminate | none |
| `connect` | `ConnectScreen` | indeterminate | `cancel` |
| `level` | `LevelLoadingScreen` | the chunk listener, 0..1 | none |
| `terrain` | `ReceivingLevelScreen` | indeterminate, with a deadline | none |

`boot` is drawn over the game's loading overlay, which keeps doing the real work (reload, progress
meter, finish callback, removal about 2 s after the reload); the page plays its own outro inside
that time. The other four are skins of live vanilla screens, so their logic never moves: the
blocking world load loop, the 30 s terrain timeout and the connect abort race all stay vanilla. The
page is drawn over the whole frame of those screens, which is why their own status text disappears
under it.

Two rules make this surface different from the others:

- the NeoForge game event bus is not started during mod loading, so no tick topic is sampled in
  `boot` and the engine is pumped by the loading host itself. Everything the page needs is a push
  topic.
- there is no screen to prompt on in `boot`, so an ask capability is refused and the prompt waits
  for the title. A pack that needs a gated action there looks broken with no prompt. Do not.

The first overlay frame logs which host it runs over:

```txt
fvmenu: loading page over WebLoadingOverlay, early window on (fv-earlywindow copy)
```

## Topics

`loading.info`, pushed once when a phase starts. Every phase fills every key, unknown ones null:

```json
{
  "phase": "level",
  "minecraft": "1.21.1",
  "neoforge": "21.1.250",
  "mods": [{"id": "fvui", "name": "FateVis UI", "version": "0.1.0"}],
  "early": null,
  "title": "Loading world",
  "reason": null,
  "world": {"id": "north", "name": "Northern Reach"},
  "server": null,
  "grid": {"diameter": 25, "fullDiameter": 27}
}
```

- `early` is the share of the bar the early window copy already showed, `boot` only. A page that
  sees it skips its entrance animations, because the player has been looking at the same layout for
  a second already.
- `title` is the one line the phase names itself with, in the player's language.
- `reason` is `nether_portal`, `end_portal` or `other`, `terrain` only. The two portal reasons are
  GL effects the page cannot draw, so the skin arrives with `backdrop: false` and the page must stay
  see-through over them.
- `world` is the singleplayer save, `server` is `{address, name, lan}` of the server being joined.
- `grid` is the chunk grid of `level`, which a page draws with an island ([Surfaces](/en/fv-menu/surfaces)).

`loading.progress`, pushed every 100 ms in `boot` and once per render frame in the other four:

```json
{
  "phase": "level",
  "progress": 0.62,
  "indeterminate": false,
  "done": false,
  "stage": "Loading world",
  "detail": "62%",
  "bars": [{"label": "Minecraft Progress", "progress": 0.4, "steps": 12}],
  "reload": null,
  "messages": [],
  "deadline": null,
  "memory": {"used": 812, "max": 2048},
  "actions": []
}
```

What makes it one stream: `progress` is always 0..1 and always present, 0 while `indeterminate`;
`bars`, `messages` and `reload` are empty outside `boot` rather than absent; and `stage` plus
`detail` are the two lines every phase fills, so a pack that binds those two and the bar works in
all five without knowing which one it is in.

- in `boot`, `progress` is already scaled into what is left after the early share:
  `early + (1 - early) * raw`. `bars` are the FML progress meters; a meter without steps reports 0,
  because 0/0 is NaN and JSON will not carry it. `messages` is the newest four log lines, built from
  new FML messages, meters appearing and completing, and reload listeners finishing.
- `deadline` is an absolute millisecond wall clock, never a countdown, so a payload that does not
  move is not pushed. `terrain` gives up 30 s after it opened; the page does the subtraction.
- `memory` is in MB. `actions` lists what `loading.act` accepts right now.
- `done` is true on the last push of a phase, which is the cue for an outro. It belongs to the phase
  it arrived with: a page that keeps an outro flag has to clear it when the phase changes, or the
  next phase starts invisible.
- The four screen phases also arrive in the `mode` payload as `loading` (`{info, progress}`), one
  eval ahead of the topics. Apply that first, see [Surfaces](/en/fv-menu/surfaces).

A minimal loading page:

```js
fvui.call('state.sub', { topics: ['loading.info', 'loading.progress'] });
fvui.state('loading.progress', (p) => {
  document.getElementById('stage').textContent = p.stage + ' ' + p.detail;
  document.getElementById('bar').style.width = Math.round(p.progress * 100) + '%';
});
```

## `loading.act`

A bridge method of the menu view, not an action id, like `skin.act`. It only presses a button the
screen already shows, which is why it is an always capability: everything behind the button, the
abort flag and the netty future included, stays vanilla.

| action | when | effect |
|---|---|---|
| `cancel` | `actions` contains it, so `connect` | presses the vanilla Cancel button |

```js
fvui.call('loading.act', { action: 'cancel' })
```

The SDK wraps it as `loadingAct({ action: 'cancel' })`.

## Early window handoff

`fv-earlywindow` is an optional separate jar that draws a native copy of the loading page from the
first second of the launch, before any mod exists. It is not a pack and reads no theme, so a pack
that repaints loading still differs from that first second. It needs
`earlyWindowControl = true` in `config/fml.toml`, the NeoForge default.

When the copy is on screen, the page continues its bar and log instead of starting over, and two
extra bridge methods exist on the menu view:

| method | args | result |
|---|---|---|
| `loading.hold` | none | `{percent, progress, used}` of the frozen copy, or null |
| `loading.shown` | none | null, marks the start of the crossfade |

The sequence the shipped page follows, and the one a pack should copy:

1. read `loading.info`; if `early` is null, run the normal entrance and skip the rest.
2. call `loading.hold`. The copy stops moving and answers its current numbers, so the page can
   render exactly what the player is looking at.
3. render those numbers, wait for the first `loading.progress` push, the backdrop image,
   `document.fonts.ready` (capped at 2 s) and two painted frames.
4. call `loading.shown`. The page fades in over 250 ms and the copy is freed afterwards.

Until `loading.shown` the page is drawn at alpha 0, so a page that never calls it is never seen.
Without the copy the page is drawn at full alpha from its first frame and neither method exists.

## Outro

The overlay is removed about 2 s after the reload finishes. The page is drawn in that removal frame
too, so it owns the transition: fade the loading content out to the backdrop the title screen keeps
drawing, instead of letting the overlay cut to a bare panorama. `progress.done` is the cue.

After removal the host switches to `title`, unless the title screen was already initialised, in
which case the switch happens the moment the loading page is done. The four screen phases end the
same way: a last push with `done` true and `progress` 1 once their screen is gone.

## Demos without the game

`?demo=loading&phase=boot|datapack|connect|level|terrain|all` runs the shipped mock timeline;
`phase=all` plays boot 14 s, datapack 2 s, connect 3 s, level 6 s and terrain 2 s on one clock.
`&t=<seconds>` scrubs to one moment instead of running it, which is what the headless harness
shoots. The chunk grid and the entity puppet are native, so a demo draws their boxes and nothing
inside them.
