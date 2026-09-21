# Distribution

## Shipping a pack

A pack ships as a directory or as one zip. The zip is the normal case: it is one file, and the game
extracts it once per build.

```sh
cd <pack dir> && zip -r ../example.zip .
```

The archive root must be the pack root, so `fvui.pack.json` is at the top of the zip, not inside a
folder. The file name without `.zip` is the id, and the manifest `id` must match it.

The player drops it into `<gamedir>/fvui/packs/`. The first launch after a change extracts it into
`<gamedir>/.fvui/cache/packs/<id>-<size>-<mtime>/`, because the engine serves plain files only, and
older extractions of the same id are pruned. A directory of the same id wins over the zip, which is
the author override.

Pack it small. Fonts are the usual surprise: subset them and ship one face. The shipped pack uses
`@fontsource` faces, which carry woff2 with a woff fallback in the same `@font-face` rule; keep
both formats rather than betting on one.

Nothing else has to be shipped. A pack never contains the bridge script, a theme preset or the
shipped pages: those come from the mod.

## What is not yours to ship

- Mojang assets. Textures come through `res.need` at runtime, from the player's own game and
  resource packs. A pack that bundles a vanilla texture is redistributing it.
- Fonts without a license file. Ship the license next to the font, the shipped pack does.
- The manifest carries `license` and `authors`; fill them in, the picker and the consent screen
  show them.

## Files the player owns

| path | owner | survives |
|---|---|---|
| `<gamedir>/fvui/packs/<id>/` or `<id>.zip` | the pack author | a pack update replaces it |
| `<gamedir>/fvui/packs.json` | the player | pack and modpack updates |
| `<gamedir>/fvui_data/<id>/store.json` | the pack, written by its page | pack and modpack updates |

Neither `fvui/` nor `fvui_data/` is inside `config/`, on purpose: a modpack update overwrites
`config/`, and that is exactly how player state gets lost.

`packs.json` holds the active pack per view, the grants per pack id keyed by a hash of the declared
capability list, the packs disabled by a crash keyed by their manifest hash, the `servers` block of
per server answers for packs a server delivered, and the hand edited `trustedServers` list. A pack
update with the same capability set keeps its grants; a grown set only asks for the new entries.
[Servers](/en/fv-ui/server) covers the last two.

`store.json` is `{"version": "<pack version>", "data": {...}}`. On a pack update the page reads the
old version once, migrates what it understands and writes. Data no page migrates stays untouched.

## Shipping to a server

A server installs `fv-ui` alone: `fv-menu` and `fv-hud` are client only and would not load anyway.
The jar carries the natives it never extracts, about 96 MB the server pays in disk and nothing else,
because the engine is reachable only from the client branch. `config/fvui-server.json` is written on
first start. A UI pack the server hands out rides its normal resource pack; [Servers](/en/fv-ui/server) has the
layout, the limits and what such a pack is never allowed to do.

## Shipping an addon mod

The jar goes into `mods/` next to fv-ui, and fv-ui is a `compileOnly` dependency, never shaded in.
The page half is a normal pack and ships the normal way. [Addon mods](/en/fv-ui/addons-java).

## The mod build

`cd mods && ./gradlew dist` writes four jars into `dist/`:

```txt
fv-ui-<version>.jar           the engine mod, with the natives for every platform
fv-menu-<version>.jar         title screen, screen skins, loading page
fv-hud-<version>.jar          the in-world HUD, independent of fv-menu
fv-earlywindow-<version>.jar  optional early loading window
```

`:core:distJar` packs `natives/linux-x86_64/libfvui_servo.so` and
`natives/windows-x86_64/fvui_servo.dll` and fails if either cross built native is missing, so a
`dist` is never a jar without an engine. `:menu:processResources` packs `web/menu/dist` and
`:hud:processResources` packs `web/hud/dist` as their default packs. `dist/README.txt` is preserved by the sync task and is the player facing install
note; keep its sha256 lines in step with the jars.

The plain `:core:jar` has no natives and is what a dev run and an addon build use.

`:core:distMediaJar` writes a fifth, optional jar, `fv-ui-<version>-media.jar`: the same classes with
a native built `--features media`, Linux only, installed instead of `fv-ui` and never beside it.
`dist` never packs a media native into the normal jar.

## Releasing

`tools/release.sh` is the whole build: the checks, the natives against `native/dist-stamp.txt`, the
pages, the jars, `dist/SHA256SUMS`, the SDK tarballs in `dist/sdk/` and `dist/RELEASE-<version>.txt`.
It runs nothing against a remote and takes `--dry-run`. Steps, artifacts and what has to be true
first: `docs/release-process.md`. What changed per version: `CHANGELOG.md`.

Versions are one number, `mod_version` in `mods/gradle.properties`. `node tools/version.mjs --set
&lt;x.y.z>` propagates it to the SDK packages, the manifest `fvui` ranges, the packs that ship inside
the jars and the version notes here, and `./gradlew checkVersion` fails when any of them drifts.

## Natives at runtime

The native engine is extracted on the first launch into
`<gamedir>/.fvui/natives/<platform>/<stamp>/`, about 133 MB, where the stamp is the size and mtime
of the mod jar. A new jar build extracts again and the old directory is pruned; a file still held
by a running instance is left for a later launch. `-Dfvui.native=<path>` overrides it, which is how
a dev run loads `native/target/release/libfvui_servo.so`.

The shipped pack is unpacked the same way into `<gamedir>/.fvui/web/<modid>-<stamp>/`, because the
engine reads plain files and a jar path is not one. `-Dfvui.web.menu=<dir>` overrides it.

A pack a server delivered is extracted the same way into
`<gamedir>/.fvui/cache/server/<server-id>/<id>-<stamp>/`, where the stamp is a digest of the tree, so
rejoining the same server reuses it. It is a cache like the rest: [Servers](/en/fv-ui/server).

Deleting `.fvui` resets all of it and keeps `fvui/packs.json` and `fvui_data/`.

## Beside FancyMenu

FancyMenu gives every screen it is allowed to a `ScreenCustomizationLayer` plus its customization
menu bar, and the bar cancels the mouse press inside `MouseHandler.onPress`, under every event a mod
can listen to. On our title that meant no click reached the page at all. So `fvmenu` puts the
`fatevis.` class name prefix on FancyMenu's own screen blacklist through
`ScreenCustomization.addScreenBlacklistRule`, reflectively and from its constructor: our screens
(`WebTitleScreen`, a pack's `CustomScreen`, the editors, the consent screens) are FancyMenu free, and
the vanilla screens we skin stay customizable by it.

A modpack that ships both still has to say which title the player gets. That is `coexist` in
`config/fvmenu-compat.json`, written on first start; `-Dfvmenu.coexist=<value>` overrides it for one
launch and an unknown value falls back to `ours` with a warning. It only does anything while
FancyMenu is installed.

| `coexist` | title | skins, loading page |
|---|---|---|
| `ours` (default) | ours; a warn line says FancyMenu title layouts are ignored | ours |
| `theirs` | FancyMenu's | ours |
| `off` | FancyMenu's | off, and no engine is started for `fvmenu` |

Drippy draws into `LoadingOverlay.render`, which our overlay never calls, so the loading page is ours
under `ours` and `theirs` and Drippy's under `off`. The constructor logs the winner either way.
`docs/compat.md` has the matrix rows and the mechanism in full.

## Requirements to repeat to players

Linux x64 needs glibc 2.35 or newer, libstdc++ with GLIBCXX_3.4.30, libfontconfig1, zlib, and X11
or XWayland. Windows x64 needs the MSVC runtime. Any GPU with OpenGL 3.2 core and shared contexts;
WebGPU picks Vulkan or D3D12. WebGL additionally needs `__GLVND_DISALLOW_PATCHING=1` in the
launcher environment on NVIDIA, WebGPU does not. The full list is in `dist/README.txt`.
