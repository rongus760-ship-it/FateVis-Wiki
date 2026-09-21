# Dev workflow

Three ways to see a page: a plain browser against a mock, the headless harness, and the dev client.
All GUI runs in this repo go through `xvfb-run`, never a real desktop.

## Plain browser

Fastest loop, no game. `window.fvui` does not exist outside the game, so the page installs a mock
when `window.fvui` is missing and branches on `fvui.native`. The SDK ships one, see [Quick start](/en/fv-ui/quick-start).

The shipped page also takes demo parameters, which is the same idea without a mock library:

```txt
?demo=title|options|video|keybinds|language|create|mirror|pause|switch|open|loading
```

`switch` goes from the Options hub to Video Settings after 1.5 s, `open` from the title to the hub.
Extra params: `blur=0..10`, `speed=`, `splash=0`, `contrast=1` (the client prefs as the game passes
them), `choice=auto|dropdown|cycle`, `backdrop=0`, `open=<row name>` clicks that row after 1 s,
`keys=ArrowDown,Enter` presses keys, and `mc=<base url>` points the loading block at local
textures.

`demo=loading` takes `phase=boot|datapack|connect|level|terrain|all` and `t=<seconds>`: `all`
plays the five phases on one clock (boot 14 s, datapack 2 s, connect 3 s, level 6 s, terrain 2 s)
and `t` scrubs to one moment instead of running it, which is how the harness shoots a phase.

## Harness

`native/examples/headless.rs` renders a page with the real engine and no Minecraft, answers bridge
calls from JSON files and writes a PNG.

```sh
cd native && cargo build --release --example headless
FVUI_PATH='index.html' xvfb-run -a -s "-screen 0 1920x1080x24" \
  env -u WAYLAND_DISPLAY ./target/release/examples/headless \
  ../packs/example /tmp/pack.png examples/mock 1600x900
```

Arguments are `<page dir> <out.png> [mock dir] [WxH]`. The page dir answers whatever `fvui://` host
the url names.

| variable | effect |
|---|---|
| `FVUI_PATH` | page inside the served directory, query included |
| `FVUI_URL` | a full url instead, for origins `fvui://` cannot give |
| `FVUI_SHOTS` | `ms,ms,...`, several frames as `out-0.png`, `out-1.png`, to diff an animation |
| `FVUI_STATE` | `'a=1;a=2;b={"x":1}'`, pushes topics once the page is loaded |
| `FVUI_KEYS` | `'800:h;900:ctrl+z'`, presses keys at those times the way GLFW would |
| `FVUI_BRIDGE_ORIGIN` | adds one origin to the bridge allowlist |

Mocks are keyed by bridge method, not by action id: `state.sub.json` holds the topics,
`act.json` is the one answer every action gets, so it is an object carrying `version` and `data`
for `store.get` next to `epoch` and `urls` for `res.need`. An unknown method answers `true`, which
is why a missing mock silently hands the page a boolean.

The run prints the first frame time, RSS and the counter line at the end. A non empty frame plus no
`console` event of level error is the pass condition.

`native/examples/state_bench.rs` is the coalescing benchmark: 200 keys per simulated frame for 300
frames, then it asserts the eval count, an empty backlog and the last value of every key.

## Dev client

From `mods/`:

```sh
xvfb-run -a -s "-screen 0 1920x1080x24" env -u WAYLAND_DISPLAY \
  ./gradlew :menu:runClient -PdevPack=packs/example -PdevOut=.work/run -PdevQuit=true
```

`DevAutomation` then plays a scripted run: title, Options hub, Video Settings, slider drag, a
dropdown open and Esc, Esc back twice, Controls then Key Binds with a wheel scroll, the mods list
in mirror, Create World, title. It writes a screenshot and one RSS line per step, plus eight frame
bursts around the loading to title handoff and the three riskiest switches. Input goes through the
real mouse and keyboard handlers, so NeoForge events and the skin routing run exactly as for a
player.

Two bridge methods exist only while `-PdevOut` is set: `dev.rect` (the page answers an element box
in CSS pixels, which is how the run clicks a page element) and `dev.log` (one line into the game
log). A pack page that wants to be driven by a scripted run calls `fvui.call('dev.log', ...)` and
catches the rejection when the method is absent.

### Dev properties

Every switch of the client run, one documented list in `mods/menu/build.gradle`.

| property | system property | default | effect |
|---|---|---|---|
| `-PdevOut=<dir>` | `fvui.dev.out` | empty | screenshots and RSS per step; empty turns the run off |
| `-PdevPack=<dir>` | `fvui.dev.pack` | empty | that directory is the active pack, whatever `packs.json` says |
| `-PdevQuit=true` or `web` | `fvui.dev.quit` | `false` | stop from a tick, or through the page Quit button |
| `-PdevPage=<url>` | `fvui.dev.page` | empty | replaces the step list, the view loads that page and is poked there |
| `-PdevPerf=true` | `fvui.dev.perf` | `false` | one perf counter line per second |
| `-PdevReload=true` | `fvui.dev.reload` | `false` | adds the F3+T step, proves the res cache epoch bump |
| `-PdevStore=true`, `auto`, `dropdown`, `cycle` | `fvui.dev.store` | `false` | pack store round trip and limit steps |
| `-PdevConsent=allow`, `deny`, `always`, `none` | `fvui.dev.consent` | empty | consent run, answers the screen with a real click |
| `-PdevLifecycle=switch`, `reload`, `crash` | `fvui.dev.lifecycle` | empty | pack lifecycle run through the picker |
| `-PdevWorld=flat` or `normal` | `fvmenu.dev.world` | empty | loading phase and pause run: create or open a test world, pause, Options, disconnect |
| `-PdevServer=<host:port>` | `fvmenu.dev.server` | empty | adds the `connect` phase of that run against a real server, then cancels |
| `-PdevServerChannel=true` | `fvui.dev.serverchannel` | false | joins `-PdevServer` and exercises `fvui:data`: a `server.data.*` topic on the page, an action at each level, the rate limit, then a disconnect |
| `-PdevServerPack=true` | `fvui.dev.serverpack` | false | the same run, also reporting the pack the server delivered and which pack owns each surface |
| `-PdevJoinBurst=<n>` | `fvmenu.dev.joinburst` | `0` | shoots the first n frames of the world join, each named by the screen that drew it |
| `-PdevEditor=true` | `fvui.dev.editor` | `false` | the pack editor script instead of the menu one, and it turns the editor on |
| `-PdevM12=true` | `fvui.dev.m12` | `false` | the parity run: a listener on a real event, one of the new topics, an editor plugin type, a native entity preview, a HUD layer moved from the main editor. Implies `-PwithHud` |
| `-PdevM12b=true` | `fvui.dev.m12b` | `false` | the M12b run over `-PdevPack=packs/m12b`: the pack's own data folder, the `files` consent and the overwrite confirm, the exec consent and its declared list, the refusal paths, the modpack lock and a server pack copy of the same manifest |
| `-PdevMedia=true` | `fvui.media` | empty | answers for the media pipeline of a hand built native; otherwise the `media` marker beside the library decides |
| `-PwithHud=true` | - | `false` | the menu run also loads fvhud, the mirror of the hud run's `-PwithMenu` |
| `-Peditor=true` | `fvui.editor` | `false` | turns the pack editor on without running its script; `fvui/editor.json` wins over it |
| `-PslowLoad=<ms>` | `fvui.dev.slowload` | `0` | stretches the first resource reload, so loading is visible |
| `-PglTrace=true` | `fvui.dev.gltrace` | `false` | synchronous GL debug output with the Java stack of each error |
| `-Pvanilla=true` | `fvmenu.vanilla` | `false` | no title replacement, skins or loading page, the baseline |
| `-PgfxNative=<so>` | `fvui.native` | dev build | run against another native build, e.g. `../native/target-media/release/libfvui_servo.so` for the media one |
| `-PservoPrefs=a=true,b=2` | `FVUI_SERVO_PREFS` env | empty | override servo prefs for the run |
| `-PglvndPatch=0` or `1` | `__GLVND_DISALLOW_PATCHING` env | unset | force the NVIDIA WebGL variable for the run |
| `-PfixedHeap=2G` | `-Xms`/`-Xmx` plus `AlwaysPreTouch` | unset | pin the heap so RSS deltas show native memory |

`:hud:runClient` takes the same switches plus its own six, listed in [The HUD surface](/en/fv-hud/hud-surface).

`-PdevOut` and `-PdevPack` take an absolute path or one relative to the repo root, not to `mods/`:
the client itself runs in `mods/menu/run`. `-PdevPack=packs/example` is right,
`-PdevPack=../packs/example` points outside the repo.

`-PdevConsent` expects a pack with a `#gated` button and `#status` and `#undeclared` lines, and
answers the prompt with a real click on its button. `-PdevLifecycle` types K for the picker and
then either switches back, edits the pack page and presses F6, or injects a crash event.

### Author loop in game

F6 on any screen re-reads every manifest and loads the current surface again, no restart and no
second engine. K on the shipped title page opens the pack picker. Both are [Pack format](/en/fv-ui/packs).

## Perf line

`-PdevPerf=true` logs once a second, and the `dev.perf` topic carries the same numbers:

```txt
fvui perf: evals/s=58 bytes/s=41k keys/s=1180 flushes/s=12 pending=0 calls/s=2 blocked=0
```

`evals` counts ordered emits too, so `keys/s` over `flushes/s` is the coalescing ratio. `blocked`
counts bridge calls the origin check refused; anything but zero means a document that should not be
calling is calling. `pending` is the current backlog and should sit at zero.

A page that subscribes one topic per component and never releases shows up here as `calls/s`
climbing with every screen switch.

## Building the shipped pack

```sh
cd web && npm install && npm run build && npm run build:menu
cd mods && ./gradlew dist
```

`:menu:processResources` packs `web/menu/dist` as the default pack, `:core:distJar` fails if either
cross built native is missing, and `dist/` keeps its `README.txt`. Unit tests of the pack code:
`./gradlew :core:test`.

## Doc rot check

```sh
node tools/check-dk.mjs [--strict]     # also `npm run check:dk` in web/, `./gradlew checkDk`
```

It builds the action, topic, capability, dev property, bridge method, store key and manifest field
inventory from the code by regex, then fails on an id these chapters or a template README names
that nothing registers, on a `Source:` line pointing at a file that does not exist, on `FVUI_API`
drifting from `mod_version`, on `docs/dk/fvui.pack.schema.json` drifting from the record and the
surface list of `PackManifest.java`, and on any manifest in the tree that does not fit that
schema. The other direction, a registered id no chapter mentions, is a
warning and fails only under `--strict`. Deliberate exceptions live one per line with a reason in
`tools/dk-allow.txt`. The task hangs off the `check` lifecycle, next to the unit tests.
