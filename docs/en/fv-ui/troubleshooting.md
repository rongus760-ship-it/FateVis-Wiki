# Troubleshooting

One grep covers everything:

```txt
grep -E "fvui|fvmenu|fvearly" logs/latest.log
```

## Lines worth knowing

| line | means |
|---|---|
| `fvui: loaded native engine from ...` | the native that was loaded, dev override included |
| `fvui: native engine unavailable ...` | no native for this platform, the game runs vanilla |
| `fvui[menu]: rendering through ... GL context` | the shared context path came up |
| `fvui: engine stopped` | clean shutdown, expected right before "Stopping!" |
| `fvui: view menu uses pack <id> <version> (<source>, <root>)` | which pack won, and from where |
| `fvui: pack <file>: <problem>` | validation refused a pack, one line per problem |
| `fvui: pack <id> for view menu is unknown, invalid or disabled, using <default>` | the selection fell back |
| `fvui: pack <id> asked for <cap>, which is not declared in its manifest` | add it to `capabilities` |
| `fvui: pack <id> asked for <cap>, which is never granted` | a `never` tier id, it will never work |
| `fvui[menu]: <id> needs consent from <pack>` | the call was refused, a prompt is queued |
| `fvui: pack <id> <what> on view menu (<root>)` | reloaded, activated, or took over after a crash |
| `fvui[menu]: page crashed: <reason>` | the engine reported the document dead |
| `fvui: pack <id> crashed and is disabled until its manifest changes: ...` | it is in `disabled` in `packs.json` |
| `fvui[menu]: topic <id> started` / `stopped` | which screen keeps a topic alive |
| `fvui: topic <id> failed` | a producer threw, with its stack |
| `fvui[menu] console: <message>` | the page's own `console.log`, `warn` and `error` |
| `fvui[menu]: bridge call failed` | a handler threw without a code, with its stack |
| `fvui: res.need N/M ready at epoch E` | N of M requested resources exist |
| `fvui: res <path> not found` / `rejected` | typo, or a path escaping the cache |
| `fvui: res epoch N (M paths)` | a resource reload re-extracted everything |
| `fvui: store.limit on <key>: ...` | a store write over a limit, the file is unchanged |
| `fvui: bad <store.json>, starting empty: ...` | the file was edited or truncated |
| `fvui: WebGL disabled: ...` | WebGL is off for this launch, WebGPU is not affected |
| `fvmenu: loading page over <overlay>, early window on\|off` | which loading host ran |
| `fvmenu: fv-earlywindow is installed but idle, ...` | `earlyWindowControl = false` in `config/fml.toml` |

## Common failures

**My pack is not picked up.** The directory name must equal the manifest `id`, and `id` must match
`[a-z0-9_-]{3,64}`. A zip must be named `<id>.zip`. Then check the `fvui: pack ...` validation
lines: a missing entry file or a `fvui` range that does not match the installed mod version skips
the pack silently otherwise. `-Dfvui.dev.pack` skips the directory name check, so a pack that works
in a dev run can still fail when installed.

**A page shows nothing, or the shipped menu instead.** The page threw on load: look for
`page crashed` and for `console:` lines above it. A crashed pack is disabled in `packs.json` until
its manifest changes; touch `fvui.pack.json` to bring it back.

**A call fails with `capability` and no prompt appears.** The id is not in the manifest
`capabilities` list, see the `asked for` line. Add it, or, during loading, wait: there is no screen
to prompt on.

**A call fails with `origin`.** The document is not an `fvui://` page. An iframe from another
scheme, a `data:` url, or a dev server without `-Dfvui.bridge.origin`.

**A topic never arrives.** Nothing subscribed it: `state.sub` has to run. Check for the
`topic ... started` line. A tick topic is also not sampled while mod loading is running, so a
loading page needs a pushed topic.

**A value never changes.** The producer returns the same mutable object every sample and the diff
eats it. Return a fresh copy.

**Edits do not show up.** File hosts send no cache headers. Press F6, which bumps `r` in the page
url, and append that `r` to relative links the page adds itself.

**The theme file does nothing.** It must be unlayered CSS. A `@layer` block loses to the presets,
and the file is only linked when the manifest names it in `theme` or the page links it.

**A CSS rule does nothing at all.** It probably contains `:has()`, which drops the whole rule, or
an unimplemented property. [Servo support matrix](/en/fv-ui/servo).

**Images or video do not appear.** Game textures need `res.need`, external urls are not fetchable,
and `<video>` needs a native built with the media feature.

**A GL error at exit.** That is a bug, not noise. Run with `-PglTrace=true` for the Java stack of
each GL error.

## Where files live

| path | what |
|---|---|
| `<gamedir>/fvui/packs/<id>/` | a pack |
| `<gamedir>/fvui/packs/<id>.zip` | a zipped pack |
| `<gamedir>/fvui/packs.json` | active pack per view, grants, disabled packs |
| `<gamedir>/fvui_data/<id>/store.json` | the pack's own data |
| `<gamedir>/config/fvmenu-skins.json` | which screens may be skinned |
| `<gamedir>/config/fml.toml` | `earlyWindowControl` for the early window jar |
| `<gamedir>/.fvui/web/` | the shipped pack unpacked out of the jar |
| `<gamedir>/.fvui/natives/<platform>/<stamp>/` | the extracted native engine |
| `<gamedir>/.fvui/cache/packs/<id>-<stamp>/` | an extracted zip pack |
| `<gamedir>/.fvui/cache/res/<epoch>/` | the resource cache behind `fvui://res/` |
| `<gamedir>/logs/latest.log` | everything above |

Deleting `.fvui` resets every extracted file and cache. It does not touch `fvui/packs.json` or
`fvui_data/`.

## What to send with a bug report

`logs/latest.log` and `logs/debug.log`, `crash-reports/`, any `hs_err_pid*.log`, the GPU and driver
version, and a screenshot. The single most useful lines are
`fvui: loaded native engine from ...`, `fvui: view menu uses pack ...`,
`fvmenu: loading page over ...` and whether `fvui: engine stopped` appeared on quit.
