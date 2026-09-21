# Server

One jar, one mod id, three packages. `fv-ui` is dist neutral now: `FvUi` branches on
`FMLEnvironment.dist` into `fatevis.fvui.client` or, on a dedicated server, into nothing that names a
client class. A server installs the same `fv-ui` jar and nothing else; it never extracts a native and
never writes `.fvui/`, `fvui/` or `fvui_data/`.

```json
[modloading-worker-0/INFO] [fa.fv.FvUi/]: fvui: server side, engine not loaded
```

`fv-menu` and `fv-hud` stay client only and are not installed on a server.

## The channel

One payload channel, `fvui:data`, registered once from the dist neutral entry with `optional()`, so a
vanilla client still connects to an fvui server and an fvui client still connects to a vanilla
server. Every send is gated by `hasChannel`, so a vanilla client is simply never written to.

| payload | direction | fields |
|---|---|---|
| `S2CHello` | to client | protocol, topics, actions, rateLimit, sizeCap |
| `S2CPack` | to client | packId, namespace, surface, digest, required |
| `S2CData` | to client | topic, json |
| `S2CEvent` | to client | channel, json |
| `C2SAction` | to server | seq, id, json |
| `S2CReply` | to client | seq, ok, json |

Codecs are hand written over plain strings and JSON with no registry ids, so the same bytes can be
produced by something that is not a NeoForge server later. Until the schema is frozen the rule is:
append only fields, no reordering, no registry ids.

`S2CHello` and the pack offer ride the play phase, on player login, not a configuration task. The
client still decides before its first HUD frame, and a slow answer cannot hang a join.

## Topics

A server value lands in the state channel under `server.data.<name>`. Plain `server.` was already
taken - `server.address` is an fvmenu topic and `server.join` an action - so only `server.data.` is
reserved, and the guard in `FvUiApi.push`, `pushTo` and `topic` is the whole reservation: those maps
are flat with no collision warning of their own.

| topic | owner | kind | payload |
|---|---|---|---|
| `server.channel` | core | push | `{protocol, topics, actions, rateLimit, sizeCap}`, null with no channel |
| `server.data.motd` | core | tick | the message the server shows, a string |
| `server.data.players` | core | tick | player names, sorted |
| `server.data.tick` | core | tick | `{count, ms}` |

Everything past those three comes from an addon. A page reads them like any other topic:

```js
const v = await fvui.call('state.sub', { topics: ['server.data.motd'] })
```

## Actions

A page reaches a server action through one client action, because a bridge call is synchronous and a
server answer is not:

| action | args | result | tier |
|---|---|---|---|
| `server.act` | `{id, args}` | `{seq}` | always |

The answer arrives on the ordered event `server.reply` as `{seq, ok, result}`. On a refusal `result`
is a `{code, message}` with `code` one of `limit`, `rate`, `unknown`, `denied`, `off`.

```js
fvui.call('events.sub', { events: ['server.reply'] })
fvui.on('server.reply', r => console.log(r.seq, r.ok, r.result))
const { seq } = await fvui.call('act', { id: 'server.act', args: { id: 'ping', args: {} } })
```

| action | level | what it does |
|---|---|---|
| `ping` | 0 | `{pong, name, tick}` |
| `motd.set` | 2 | sets what `server.data.motd` carries |

## Two gates, both must pass

The page: a new ask capability, `server:data`. Without it a pack cannot subscribe to a
`server.data.*` topic and cannot call `server.act` at all. `server.act` itself is always granted so
the dispatcher lets it through, and the real gate is inside it - the same shape `sound.play` and
`sound.any` already have.

The player: every action id is registered through
`FvUiServerApi.action(id, handler, level, about)` with a command level, an unregistered id is refused
with `unknown`, and the check is `player.createCommandSourceStack().hasPermission(level)`, so a
permissions mod that patches that path applies without fvui knowing about it.

`net:fetch` and `net:ws` stay never granted. This channel is named topics and registered actions, not
a socket, so the [Capabilities](/en/fv-ui/capabilities) rule holds.

## Limits

| limit | value | over it |
|---|---|---|
| action json | 8 KiB | refused with `limit`, client side first |
| topic json | 64 KiB | dropped server side, one warn line per topic per 5 s |
| per player | 256 KiB a second | dropped until the next second |
| actions | 20 a second, burst 40 | refused with `rate` |
| payloads | 32 a tick per player | oldest dropped |

Server to client coalesces the latest value per topic per tick; events keep their order and go first.
`/fvui debug <player>` prints the counters: sent, bytes, dropped, refused, rate limited.

## Server commands

`/fvui`, registered for every command selection, so singleplayer testing against the integrated
server is free.

| command | level | effect |
|---|---|---|
| `/fvui pack list` | 0 | the pack this server offers: id, namespace, surfaces, required |
| `/fvui pack activate <targets> <id> [surface]` | 2 | pushes an offer to those players |
| `/fvui pack reload` | 3 | re-reads `config/fvui-server.json` and announces again |
| `/fvui hud set <targets> <layer> <x> <y> <scale>` | 2 | a HUD suggestion, see below |
| `/fvui hud reset <targets> [layer]` | 2 | the same |
| `/fvui data <topic> <targets> <json>` | 3 | ad hoc push, the command block and datapack hook |
| `/fvui debug <target>` | 3 | the channel counters |

`/fvui hud` is a suggestion and never a silent write: the client applies it only when
`"serverHud": true` is set in `fvui/hud.json`, which it is by default, and a player who turned it off
gets one chat line saying the server tried.

## Client commands

`/fvuic`, a separate root. A client command shadows a server command of the same name, so two roots
is the only way both can exist. Nothing in these handlers touches a server.

| command | effect |
|---|---|
| `/fvuic pack list` | the pack each view runs, plus the server pack if there is one |
| `/fvuic pack activate <id>` | switch every view to that pack |
| `/fvuic pack reload` | the F6 reload from chat, for a pack that broke its own page |
| `/fvuic engine` | platform, resolved native, loaded or not |
| `/fvuic server` | the channel this server offers |

## Server delivered UI packs

A server ships a UI pack inside its normal resource pack. There is no second transport and no HTTP
client in the mod: vanilla already downloads the pack, shows its own prompt, honours
`require-resource-pack` and mounts it.

```html
<resource pack>.zip
  pack.mcmeta
  assets/<namespace>/fvui/pack/<id>/fvui.pack.json
  assets/<namespace>/fvui/pack/<id>/index.html
```

`server.properties` needs `resource-pack` and `resource-pack-sha1` as usual, and
`config/fvui-server.json` names which pack and which surfaces:

```json
{
  "enabled": true,
  "packs": true,
  "levels": {},
  "pack": {
    "id": "serverui",
    "namespace": "fvuidemo",
    "surfaces": ["title"],
    "required": false
  }
}
```

`levels` may raise the level of an action id and never lower it. `enabled` false turns the whole
channel off, `packs` false keeps the data half and stops the pack offer.

The client copies the tree out of the mounted pack into
`<gamedir>/.fvui/cache/server/<server-id>/<id>-<stamp>/`, because the native side serves plain files.
`<server-id>` is 16 hex of a sha256 of the address, so no address becomes a directory name. An
extracted tree over 64 MiB or 4000 files is refused with one error line.

Activation is one link at the front of the entry lookup: the server pack, then the player's active
pack, then the default pack. A surface it does not claim, or claims without an entry for, falls
through untouched, so the one-pack-per-host rule of [Pack format](/en/fv-ui/packs) still holds. Logging out clears the
entry and the player's pack is back after one reload. The pack's own `fvui_data/<id>/store.json` is
namespaced by id, so leaving loses nothing.

## What a server pack may never do

A server pack is never trusted and never becomes trusted. Before any grant is looked at, a fixed
whitelist decides - and it runs before the tier, so even an always granted id that is not on it is
refused:

```txt
state.sub  state.unsub  events.sub  events.unsub
store.get  store.set  store.remove  res.need  res.lang
sound.ui  sound.play  music.set
hud.rects  menu.rects  container.rects  skin.act  loading.act
server.act  server:data
```

Refused whatever the manifest or a grant says: `quit`, `world.play`, `server.join`, `link.open`,
`options.write`, `pack.activate`, `game.command`, `game.chat`, `sound.any`, `open`, and the whole
never tier. There is no `files` capability at all and no `process.exec`, so "a server page cannot
touch your files" is true because those ids do not exist, not because they are filtered.
`game.command` is the one a server does not need: it can run the command itself.

Consent is once per server, not once per capability. The prompt is a vanilla screen naming the
address, the pack, its authors and licence and its full capability list, with Esc a decline that
leaves the player's own pack up. The answer is keyed by the server id plus a digest of the manifest
and its sorted capability list, so a server changing either asks again. It is stored in a new
`servers` block of `fvui/packs.json`:

```json
{
  "active": {"menu": "example"},
  "servers": {
    "9f2a1c4d5e6b7a80": {
      "address": "play.example.com",
      "packId": "serverui",
      "digest": "0011223344556677-1f4a2b0c",
      "allowed": true,
      "authors": ["the server owner"],
      "license": "MIT",
      "capabilities": ["state.sub", "server:data"]
    }
  },
  "trustedServers": []
}
```

## trustedServers

`trustedServers` is a list of server ids in `fvui/packs.json`, hand edited by the player and never
written by the game. A server on it has its pack treated like a local one: the whitelist step is
skipped and the normal per capability grant flow runs instead, prompt and all. It is the way to run
a pack from a server you actually own without the whitelist in the way. Everything else still
applies, so the never tier is still never.

## Writing an addon against it

`FvUiServerApi` lives in `fatevis.fvui.common`, so an addon compiles against it on both sides and is
a no-op where there is no channel.

```txt
FvUiServerApi.topic("shop.balance", 40, () -> economy.total());
FvUiServerApi.action("shop.buy", (player, args) -> shop.buy(player, args.get("item").getAsString()),
    Commands.LEVEL_ALL, "Buy from the server shop");
FvUiServerApi.push(player, "shop.balance", economy.of(player));
FvUiServerApi.event(player, "shop", Map.of("bought", "diamond"));
```

`topic(name, intervalTicks, sampler)` samples once and pushes to everyone on the channel; a per
player value goes through `push(player, name, value)` from the addon's own logic. A name must be
lowercase dotted segments, at most 64 characters, and the `server.data.` prefix is added for you.

## Later

A Paper plugin sending the same bytes over the plugin messaging channel `fvui:data` is the only new
work a non NeoForge server needs, and it is blocked on freezing the schema, which M11a does not do.
Streaming pack delivery over the payload channel is for the same case, where there is no server
resource pack to ride.
