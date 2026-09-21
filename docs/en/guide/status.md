# Status and changelog

**0.1.0, 2026-09-15.** First build. Servo runs inside Minecraft 1.21.1 on NeoForge 21.1.x and a web
page is the menu, the loading screen and the HUD. Four jars, Linux x64 and Windows x64 natives in
one of them.

One number covers the mod, the bridge API and the manifest `fvui` range. While on 0.x a breaking
bridge or pack format change bumps the minor, and an entry that moves the pack format or the bridge
API says so, because a pack's `fvui` range is what refuses it.

## Known limits

- FV-Hud has never been run in game on Windows, and Windows itself is built but not confirmed in game.
- macOS is not built.
- `@fvui/*` is not on npm. Tarballs ship in `dist/sdk/`, and a pack outside the source tree uses a
  `file:` dependency on them.
- The mod id may still change before the first public release, because NeoForge has no aliasing
  mechanism. `fvui` as the protocol name in `fvui://`, `window.fvui` and the sound namespace stays.

## Unreleased

### Added

- `coexist` in `config/fvmenu-compat.json` (`ours`, `theirs`, `off`, override with
  `-Dfvmenu.coexist`): who owns the title screen while FancyMenu is installed.

### Fixed

- FancyMenu swallowed every click on our title page. Our screens go on FancyMenu's own screen
  blacklist now, reflectively and with no compile dependency, so its customization layer and menu
  bar stay off them.
- A skinned screen closed by a page action during its own render no longer crashes the client.

## 0.1.0

| | milestone | what landed |
|---|---|---|
| M1 | Data layer | a typed, coalesced game data and action API in core, an origin checked bridge, per frame counters |
| M2 | UI packs | manifest, discovery, validation, capability tiers with a consent screen the game draws, the `fvui_data/` store, `fvui://res/`, theme tokens and presets, the sound bridge, F6 reload and crash disable |
| M3 | Developer kit | `@fvui/sdk` with vue, svelte and react adapters, four pack starters plus `templates/addon-java`, and these docs |
| M4 | Recreation A | a Vue pack recreating a studied FancyMenu title screen with generated placeholder art |
| M5 | FV-Hud base | its own mod and its own view, ten HUD topics on absolute gui tick deadlines, the vanilla layer cancel set, native items drawn inside page rects |
| M6 | HUD layer editor | a layer box recorder, `hud.json` v2 with anchors and clip rects, eight `hud.*` actions, a transparent in game editor overlay |
| M7 | Loading | one `loading.*` stream over five phases, the loading page, and `fv-earlywindow` drawing from the first second of the launch |
| M8 | Editor v1 | `layout.json` format 1, `@fvui/layout`, `@fvui/elements`, `@fvui/codegen` and its CLI, the Svelte editor, timelines, the in game code panel with the Servo limitations lint |
| M9 | Containers | chrome for every container screen, relayout for the inventory and chests, the creative tab strip, search field and scrollbar, the `fvui://item/` baked icon host |
| M10 | Chat and overlays | `ComponentHtml` with a click table a page cannot read, the Minecraft font baked at runtime into TTF faces, the chat HUD and chat screen, opt in page tooltips, toasts, the tab list and the death screen |
| M11 | Distribution | a green dedicated server, the `fvui:data` channel with limits and a server policy, `/fvui` and `/fvuic`, server delivered packs with consent, Windows load hardening, export and import share bundles |
| M12 | Parity completion | 30 action ids, the 15 parity topics, 188 mapped placeholders, `FvUiApi.events()` with 27 channels, the five hook editor plugin API with no mixins, the optional media build as its own jar |
| M14 | Reactive HUD | the `hud.damage`, `hud.status` and `hud.reactive` topics, bar to entity matching on `hud.bossbars`, the `reactive` block in `hud.json` |
| M15 | Server cards | `fvui/stats.json` with the per server hours played, and the server card data the multiplayer page reads |
