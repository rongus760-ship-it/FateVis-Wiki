# The FancyMenu canon map

This chapter is the index, not the inventory. `docs/plans/m8-parity.md` is the inventory: it was
measured against the v3 tree and its addons, it carries every numbered item with its shipped state,
and it is the file to edit when a row changes. Here is where each half of it lives in the code and
in this kit.

Keksuccino's code is DSMSL. Everything in the inventory was read for behaviour and UX only: no code,
asset or text is copied, labels are paraphrased, and identifiers are quoted only where an inventory
of them is meaningless otherwise.

| what the original has | count | where ours lives | chapter |
|---|---|---|---|
| element types | 53 with the addons | `BUILTIN_ELEMENTS`, `web/layout-schema/src/elements.ts` | 15 section 3 |
| actions | 67 | `FvUiApi.action` across core, fvmenu and fvhud | 03 |
| loading requirements | 92 families | one `visibleIf` grammar plus the topic set | 15 section 6, 16 |
| placeholders | 196 | typed bindings, plus inspector affordances | 15 section 14, 16 |
| event listeners | 85 | `FvUiApi.events()` plus the `topic:<id>` family | 03 |
| menu background types | 9 | `Background`, `backgrounds` on a layout | 15 section 9 |
| decoration overlays | 10 | `Overlay`, `overlays` on a layout | 15 section 9 |
| script statements and blocks | 7 | the step set, minus `while` | 15 section 7 |
| editor UX items | 101 | `web/editor` | 16 |
| addon extension points | 6 registries plus 5 editor mixins | the type registry, `FvUiApi`, and the plugin API | 10, 18 |

## The four structural answers

Four places where the shape is different rather than the feature missing, which is most of what an
author has to unlearn:

1. **A placeholder is a typed binding.** 60 of the 180 placeholders are string, maths and case
   helpers that exist because the original has no language. In a document they are a `format`, a
   `round`, a `map` or an expression, so they are inspector affordances and not 60 pickable tokens.
   The bindings picker still searches the old names: [Layout editor](/en/fv-menu/editor).
2. **A requirement is a topic and a comparison.** There is no requirement class to register. A new
   topic is usable in a requirement the day it is registered, with no toolchain change, and 14 of
   the 92 families are answered by CSS `:hover` and `:focus` with no binding at all.
3. **A listener is an event, and most events are a topic changing.** `topic:<id>` collapses the bulk
   of the 85 listener types into one family.
4. **Caching is not a setting.** The original has a placeholder cache duration and a requirement
   cache duration in milliseconds, because it polls. Topics push on change, so there is nothing to
   poll and nothing to cache.

## What is deliberately not matched

Each with its reason, because "unsupported" is never an answer here:

| thing | why |
|---|---|
| `while` in a script | an infinite loop in a menu is a hang; the original caps it at three seconds (FM#1357) |
| the System Interactions addon's own surface | `process.exec` ships instead as an ask tier with a declared command list, an owner decision of 2026-09-15 to be revisited at release: [Capabilities](/en/fv-ui/capabilities) |
| `send_http_request` and the four remote server actions | `net:fetch` and `net:ws` stay on the NEVER set, [Capabilities](/en/fv-ui/capabilities) |
| the SpiffyHUD Eraser | a scissor is inclusive; a real eraser needs a stencil pass |
| the AFMA creator and the buddy pet overlay | skipped, not worth the surface |
| the `.txt` layout importer | the concept map is sections 2 to 5 of the inventory; a machine importer would inherit every quirk |

## What still waits, and on what

Everything below names the thing it waits on, never a date:

| thing | waits on |
|---|---|
| `files.copy`, `files.move`, `files.rename`, `files.unzip`, `files.reveal`, `pack.file.pick` | nothing but a use: the eight that shipped compose the first three, [Capabilities](/en/fv-ui/capabilities) |
| flow skins and the scroll list textures | M9f |
| the JSON model element | a new island kind |
| the early window layout editor | M12h |
| the vanilla background blur | the Java blur pass: stylo has no `backdrop-filter` |
