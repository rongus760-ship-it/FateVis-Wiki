# Editor plugins

FancyMenu's own addons patch its editor in five places with mixins, because the editor has no
extension point. That is the lockstep problem: every editor change can break every addon, and an
addon cannot be written against anything stable. This chapter is the five hooks those mixins wanted,
as one module.

## The module

One file, `editor.plugin.js`, a plain ES module with one default export:

```txt
export default {
  types:     [{ id: 'ns:name', label, icon, schema, component, from, settings, defaults }],
  inspector: [{ match, section }],
  palette:   [{ group, items }],
  menu:      [{ menu, entry, run }],
  catalogue: { topics: [], actions: [] },
}
```

Every key is optional. A key the editor does not know fails the whole module on purpose, so a plugin
written for a later editor does not half load. `templates/editor-plugin/` is a working example.

## Where it is loaded from

Two roots, both read by the trusted `editor.plugins` action:

| root | who it is for |
|---|---|
| `<gamedir>/fvui/editor-plugins/*.js` | a plugin that belongs to the instance, not to a pack |
| `<pack>/editor/editor.plugin.js` | a plugin a pack ships |

A pack's plugin loads when the pack is trusted (in a jar) or when its id is listed in
`<gamedir>/fvui/editor-plugins/enabled.txt`, one id per line. Nothing else loads: a pack the player
dropped in `fvui/packs/` does not get to run code in the editor because it was unzipped there.

A plugin never reaches `editor.pack.*`. It edits the document through the hooks, not the filesystem,
and a plugin that throws is reported in the editor and skipped rather than taking the editor down.

## The five hooks

### types

Registers an element type. The id is `<ns>:<name>`; a bare name is ours and is refused.

```txt
types: [{
  id: 'example:badge',
  label: 'Badge',
  schema: { about: '...', component: 'Badge', fields: { label: { kind: 'text', about: '...' } } },
  from: '@example/fvui-elements',
  settings: { resizableY: false },
}]
```

`schema` is a `TypeSpec`, the same table the built-in types use, so the validator, the JSON schema
and the generated inspector all get the new type for free - there is no second description to keep
in sync. `settings` is the 24-flag capability set of [Layout editor](/en/fv-menu/editor), so the editor hides what the type
cannot do instead of offering it and failing.

`from` is the package a generated pack imports. On first use the editor writes the matching
`ExternalType` entry into the document's `types` block, so **the pack depends on the component
package, not on the plugin**: a layout built with your plugin still generates on a machine that has
never seen it. A type with no `from` works in the editor and generates an undefined component, which
is a plugin bug, not an editor one.

`component` is the Svelte component the editor canvas mounts, registered through
`registry.register('ns:name', C)`. Give both: `component` for the canvas, `from` for the pack.

### inspector

Appends one section to an existing type's panel, which is what the original's addons mixin for
today. `match` is an element type, or `*` for every type.

```txt
inspector: [{ match: 'button', section: { title: 'Example', fields: { rank: { kind: 'enum', values: [...] } } } }]
```

### palette

Entries in the New Element list, grouped under a heading of your own.

### menu

One entry in the editor menu bar. `menu` is `layout`, `edit`, `element`, `window` or `help`.

### catalogue

Topics and actions your own mod registers, declared before anything has subscribed. `api.catalogue`
reports what the game has registered, and a topic with no subscriber has no sampled value, so the
bindings picker would not know your topic exists until something read it. Declaring it here also
feeds `KNOWN_TOPICS`, which is what lets `topic.example.rank` parse in a `visibleIf` without the
`topic['example.rank']` escape.

## What it is not

- Not a mixin. There is no way to replace an editor panel, only to add to one.
- Not a file API. `editor.pack.*` is refused for a plugin.
- Not versioned yet. There is one hook set and one editor; a version negotiation arrives the first
  time the set changes incompatibly, and until then an unknown key is an error.
- Not a runtime dependency of a pack. See `from` above: the generated pack imports your component
  package directly.
