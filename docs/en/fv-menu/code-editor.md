# The in-game code editor

A code panel inside the layout editor, for an author who already builds UI on a web framework. It
is **optional**: every menu, HUD and loading layout is fully makeable without it, nothing on the
no-code path imports from it, and it ships hidden. Read [Layout editor](/en/fv-menu/editor) first: this is one panel of that
editor, not a second tool.

## Turning it on

Two switches, both off by default.

1. The editor itself: `fvui/editor.json`, [Layout editor](/en/fv-menu/editor). Under the modpack lock nothing here appears.
2. The panel: **Window > Code Editor**, which writes the `ui.codeEditor` pack store key.

With the panel off, `Window > Open Code Editor`, `Layout > Open in code editor`, the element
context menu row and the Help row are all hidden. With it on and the files locked the panel opens
read only.

## What it is

```txt
Window > Open Code Editor
```

A docked panel over the canvas: the pack file tree on the left, tabs across the top (twelve open at
most, a dirty one is never evicted), the editor, a problems list under it and an optional preview
of the running surface beside it.

The editor is a `<textarea>` with a Prism-highlighted `<pre>` under it, both monospace on the same
11 px line-height, scroll synced, the textarea's own text transparent over a themed caret. The
caret, the selection, the arrows, Home, End, Shift+arrows and click-to-position are servo's own
text input, and undo is the textarea's, so nothing here reimplements a text editor. CodeMirror 6
renders correctly in servo but has no pixel-to-text-offset API at all (`caretPositionFromPoint` and
`caretRangeFromPoint` are undefined and a sub-node `Range.getClientRects()` returns an empty list),
which is why it is not used; the editor sits behind one component interface so it can be swapped
later.

Highlighting: `.svelte` and `.vue` as markup with nested script and style, `.tsx` and `.jsx`,
`.ts`, `.js`, `.css`, `.json`. Anything else is plain text on the same grid.

No folding, no virtualization, no multi-cursor, no autocompletion and no minimap. Pack files are
small, and the two features that would need the broken `Range` geometry are exactly the ones left
out.

## Keys

Ctrl+letter chords reach the page directly, and the same rows also arrive as the `editor.key`
event, which is the compatibility path of [Layout editor](/en/fv-menu/editor).

| keys | what |
|---|---|
| Ctrl+S | compile, write, reload |
| Ctrl+F | find and replace, go to line |
| Ctrl+G | go to line |
| Ctrl+D | duplicate the line or the selection |
| Ctrl+U | cut the line |
| Alt+Up / Alt+Down | move the line |
| Tab / Shift+Tab | indent, outdent |
| Ctrl+C / Ctrl+X / Ctrl+V | copy, cut, paste |
| Ctrl+W | close the tab |
| Ctrl+Tab | next tab |
| F6 | reload the pack |

Servo has no `navigator.clipboard` and no `document.execCommand`, so copy and paste go through the
trusted `editor.clipboard.set` and `editor.clipboard.get` actions and reach the real OS clipboard.
There are no composition events either, so **there is no IME**: CJK text is typed outside the game
and pasted in.

## The limitations lint

Every line is checked against the servo quirks table of [Servo support matrix](/en/fv-ui/servo), per language section of the
file, and the gutter carries a dot beside it: red for **error** (it renders nothing or the call is
refused), amber for **warn** (it renders differently). Neither blocks a save. Each row names the
rule id and the [Servo support matrix](/en/fv-ui/servo) section it came from.

The same table runs headless, so a pack built outside the game gets the same rows:

```sh
node tools/check-quirks.mjs src/Title.svelte
node tools/check-quirks.mjs                    every pack source in the tree
node tools/check-quirks.mjs --table            the chapter 08 table, printed from the rules
```

## The languages

Each backend loads on the first compile of its language and never at boot.

| language | backend | in-game cost |
|---|---|---|
| `.svelte` | `svelte/compiler` | one big chunk, warm compiles in milliseconds |
| `.vue` | `@vue/compiler-sfc`, `parse` + `compileScript({inlineTemplate: true})` + `compileStyle` | the largest chunk |
| `.tsx`, `.ts`, `.jsx` | `sucrase`, `['typescript', 'jsx']` and the automatic runtime | the smallest |
| `.css`, `.json` | themselves, parsed and linted | free |

Vue compiles to a render function, so a pack needs the Vue runtime only and never the runtime
template compiler. `esbuild-wasm` is refused rather than deferred: it works and costs 13.3 MB of
wasm, a 1.5 s cold fetch and about 150 MB of RSS against a 250 to 500 MB budget.

**No npm in game.** A bare import resolves only to `@fvui/sdk`, `@fvui/elements`, `@fvui/layout`,
`@fvui/svelte`, `svelte`, `vue`, `react` and `react-dom`, each the one instance the editor already
holds. That single-instance rule is not a detail: two copies of Vue make `getCurrentScope()` null
inside the adapter and two copies of React break hooks, the same defect `resolve.dedupe` fixes in
the templates. Anything else is a compile error naming the line and [Dev workflow](/en/fv-ui/dev-workflow).

**No type checking.** Sucrase strips types, it does not check them, and `tsc` is about 9 MB plus a
filesystem. Run `npm run check` outside the game.

## Hand written elements

A pack may carry an `elements/` folder. One file is one element type:

```txt
fvui/packs/<id>/elements/Health.svelte      =>  the type <id>:health
fvui/packs/<id>/elements/Clock.vue          =>  the type <id>:clock
fvui/packs/<id>/elements/Gauge.tsx          =>  the type <id>:gauge
```

On save the panel compiles the file, registers the component for the canvas and a `TypeSpec` for
the inspector, the palette and the validator. The spec comes from an optional `export const spec`;
without one the panel writes a stub `elements/<Name>.spec.json` from the props it can read (Svelte
`$props()` and its `Props` interface, Vue `defineProps`, TSX the props parameter), every field
`{"kind": "text", "about": ""}` until you edit it. The stub is a normal pack file.

A component takes the base props `{id, anchor, cls, hidden, style}` plus its own fields, so the
anchor classes and the geometry custom properties apply to it unchanged.

When the document places the type, the save writes its entry into the `types` block ([Layout document](/en/fv-menu/layout-document)):

```txt
"types": {
  "mypack:clock": { "from": "./elements/Clock.vue", "component": "default", "props": ["format"] }
}
```

`fvui-codegen` then imports the file directly, so the generated pack depends on no panel and no
plugin. A Vue or React element goes through one mount adapter, `@fvui/elements`'s `Foreign`, which
the canvas and the generated pack both import - that is what keeps the preview equal to the
runtime. The generated `package.json` and `vite.config.ts` grow the framework dependency, its vite
plugin and the `resolve.dedupe` entry on their own.

## Hot reload

Save is compile, then `editor.pack.write`, then `editor.preview.reload` on the view showing the
surface, then the preview at the new generation. A compile error keeps the last good module mounted
and marks the tab, so the preview never blanks while you type.

| edited | what comes down |
|---|---|
| `elements/<Name>.*` | every element of that type remounts |
| a surface file | that surface remounts |
| `styles.css`, a `.layout.css` | the sheet is swapped, nothing remounts |
| `fvui.pack.json`, `theme.css` | read at host registration: F6 reloads the pack |

An edit made outside the game rides the mtime poll of [Layout editor](/en/fv-menu/editor) and the panel says so. A refused
write shows its bridge `code` and `message`.

## Problems

One list under the editor: compile errors on their line, lint rows, and runtime errors the view's
console reported while a pack component was mounted. There are no source maps in the page, so a
runtime line is mapped back through the generated-line to source-line table each compile keeps and
a line inside a template is approximate.

## New files and snippets

**new** offers a template per framework (element, plain module, stylesheet, spec stub) mirroring
`templates/svelte`, `templates/vue` and `templates/react`, and a snippet row inserts a topic
subscription, an action call, an anchor class, a theme token or a `@keyframes` block with the
`calc(<n> * var(--u))` rule a running animation needs.

## When to stop using it

The panel is for a change of minutes, not for building a pack from scratch. Outgrow it and take the
[Dev workflow](/en/fv-ui/dev-workflow) path: `templates/<framework>` outside the game with Vite, `svelte-check` or `vue-tsc`,
and F6.
