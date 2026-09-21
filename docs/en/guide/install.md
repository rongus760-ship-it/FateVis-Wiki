# Install

Four jars into `<gamedir>/mods/`. Only the first one is required; add the others as you like.

| jar | what | needs |
|---|---|---|
| `fv-ui-0.1.0.jar` | the engine, natives for Linux x64 and Windows x64 inside | - |
| `fv-menu-0.1.0.jar` | title screen, screen skins, loading page | fv-ui |
| `fv-hud-0.1.0.jar` | in-world HUD, chat, containers | fv-ui, independent of fv-menu |
| `fv-earlywindow-0.1.0.jar` | optional: the loading screen from the first second of the launch | - |

## Requirements

| | |
|---|---|
| Minecraft | 1.21.1 |
| NeoForge | 21.1.250 or newer on the 21.1 line |
| Java | 21 |
| Linux x64 | the development platform |
| Windows x64 | built, not yet confirmed in game |
| macOS | not built yet |

## Where things live

```txt
<gamedir>/mods/               the jars
<gamedir>/fvui/packs/<id>/    a directory pack
<gamedir>/fvui/packs/<id>.zip a zip pack
<gamedir>/fvui/packs.json     which pack is active per view, and the grants
<gamedir>/fvui_data/<id>/     a pack's own data
```

Neither `fvui/` nor `fvui_data/` is inside `config/`, so a modpack update that overwrites
`config/` leaves packs and their data alone. [Distribution](/en/fv-ui/distribution) has the rest.

## Installing a pack

Drop the pack's folder or zip into `<gamedir>/fvui/packs/`, then press <kbd>K</kbd> on the title
screen to open the pack picker. While the game runs, <kbd>F6</kbd> re-reads every manifest and
reloads the current surface, no restart.

The first time a pack asks for something that reaches outside the page (quitting the game, joining
a server, opening a link) the game shows a consent screen of its own. See
[Capabilities](/en/fv-ui/capabilities).

## Alongside FancyMenu

`coexist` in `config/fvmenu-compat.json` decides who owns the title screen while FancyMenu is
installed: `ours`, `theirs` or `off`.

## Build from source

Linux x86_64:

```sh
cd native && cargo build --release
cd web && npm install && npm run build && npm run build:menu
cd mods && ./gradlew :menu:runClient
```

If something does not start, [Troubleshooting](/en/fv-ui/troubleshooting) lists the log lines to
look for.
