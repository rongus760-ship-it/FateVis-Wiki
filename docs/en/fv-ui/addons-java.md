# Java addons

An addon is a normal NeoForge client mod that registers topics and actions from its constructor.
fvui never names it, and no page has to ship with it: any pack can read what it registered.

`templates/addon-java/` is a complete one, with a Gradle build, a mod and a pack page. Copy it.

## Build

fv-ui is a `compileOnly` dependency, never packed into the addon jar:

```txt
dependencies {
    compileOnly files('fv-ui-0.1.0.jar')
}
```

Same Minecraft, NeoForge and Java versions as fvui itself: 1.21.1, 21.1.250, Java 21, ModDevGradle
2.0.147.

`neoforge.mods.toml` depends on fvui:

```json
[[dependencies.fvexample]]
modId = "fvui"
type = "required"
versionRange = "[0.1,)"
ordering = "AFTER"
side = "CLIENT"
```

Add a second, optional dependency on `fvmenu` with `ordering = "BEFORE"` if the addon registers ask
capabilities. fvmenu validates every pack manifest in its own constructor, and a manifest may only
list a capability that was declared by then.

## The API

```java
FvUiApi.topic(String id, Producer producer)                     // sampled per client tick
FvUiApi.push(String id, Object value)                           // event driven, pushed by the owner
FvUiApi.action(String id, Action handler)                       // ask tier, prompt shows the raw id
FvUiApi.action(String id, Action handler, Tier tier, String about)
FvUiApi.caller()                                                // the calling view, inside an action only
FvUiApi.events(String id)                                       // an ordered event channel
FvUiApi.events(String id, Events.Hook hook)                     // the same, hooked only while listened to
```

Namespace every id. `example.counter` and `example.ping`, not `counter` and `ping`: the id space is
flat and shared with core.

## Topics

A `Producer` is sampled once per client tick, and only while at least one page is subscribed.
`start` runs on the first subscriber, `stop` on the last, so an unused topic costs nothing.

```java
FvUiApi.topic("example.counter", new Producer() {
    @Override
    public Object sample() {
        return ++ticks;
    }

    @Override
    public void start() {
        ticks = 0;
    }
});
```

Rules:

- values are diffed with `equals` against what each view was last sent. A producer building a
  mutable map or list must return a fresh copy every sample, or the diff never fires.
- sampling runs inside the engine pump, in the middle of a frame. Never open a screen, stop the
  engine or start a reload from `sample`, `start` or `stop`. Queue that with `Minecraft.tell`.
- a producer that throws is logged once per tick and the topic goes null. It does not break the
  tick for anybody else.
- return `null` for "nothing right now"; the page keeps its last value.

Event driven data is pushed instead, by whoever owns it:

```java
FvUiApi.push("example.pings", pings);
```

Push once from the constructor to seed the value, so the first `state.sub` of a page already
answers with something instead of nothing.

Use `push` for anything the loading page reads: tick topics do not run during mod loading, the game
event bus is not started yet.

## Actions

```java
FvUiApi.action("example.read", args -> ticks, Capabilities.Tier.ALWAYS, "Read the example counter");
```

`args` is a Gson `JsonObject`, never null. The return value is serialized with Gson and becomes the
resolved value of `fvui.call('act', ...)`. A `CompletableFuture` is allowed and is resolved on the
render thread.

Errors: throw `BridgeError(code, message)` to give the page a code it can branch on, anything else
reaches it as `{code: "error"}`. The same frame rules as a producer apply, which is why the `quit`
action queues the stop with `Minecraft.tell` instead of calling it inline.

`FvUiApi.caller()` is the view whose call is being handled, for a check that depends on the
arguments. `caller().source()` is the pack id behind it.

## Events

A topic is last-value-wins and coalesced; an event is every occurrence, in order. Declare a channel
and fire it:

```java
Events.Channel damage = FvUiApi.events("example.hit", () -> attachMyGameListener());
damage.fire(Map.of("amount", 3));
```

The hook runs when the first page listens and `stop()` when the last one leaves, so a channel nobody
reads costs one map entry and no game callback. `fire` on a channel nobody listens to does nothing
and queues nothing, exactly as a game event does; check `live()` before building an expensive
payload. A page subscribes with `events.sub` and reads it with `fvui.on`, [Topics and actions](/en/fv-ui/topics-actions).

Every topic is already an event under `topic:<id>`, so do not add a channel that only says "this
topic changed".

## Tiers and the consent line

Anything a mod registers is an ask capability by default, so a pack cannot reach it without the
player saying yes. The four argument `action` overload sets the tier and the sentence the consent
screen shows:

```java
FvUiApi.action("example.ping", ExampleAddon::ping, Capabilities.Tier.ASK,
    "Show a message from the example addon");
```

| tier | use it for |
|---|---|
| `ALWAYS` | reading state, anything staying inside the game and the pack's own data |
| `ASK` | anything reaching the player, the world, the file system or the network |

Declaring the tier is also what makes the id listable in a pack manifest: an undeclared id fails
manifest validation with "unknown capability", and an id missing from the manifest is refused
without a prompt. Both are silent from the page's side except for the log line and the
`{code: "capability"}` rejection, so declare before fvmenu constructs.

Core ids stay core owned. Declaring `quit` from a mod is ignored with a warn line, so no addon can
widen or re-word what fvui itself grants.

The prompt then reads:

```txt
Example Addon Pack (fvexample) wants to:
Show a message from the example addon
example.ping
```

## The page side

Nothing special. Topics of another mod are read like core ones, and its actions go through the same
`act` call:

```js
fvui.call('state.sub', { topics: ['example.counter'] });
fvui.state('example.counter', (value) => console.log(value));
await fvui.call('act', { id: 'example.ping', args: { text: 'Hello' } });
```

The pack manifest lists the ask ones:

```txt
"capabilities": ["state.sub", "example.ping"]
```

## Shipping

The mod jar goes into `mods/` next to fv-ui and fv-menu. The page is a normal UI pack, so it goes
into `<gamedir>/fvui/packs/<id>/` under a directory named exactly like the manifest `id`. [Distribution](/en/fv-ui/distribution) has the rest.

An addon whose page is optional is fine: register the topics and let a pack author use them.

## HUD addons

`fvhud` gets its own WebView and therefore its own active pack, so a HUD addon registers topics and
actions exactly like this one and ships a pack for the `hud` surface instead of a menu one. Nothing
in this chapter changes for it. [The HUD surface](/en/fv-hud/hud-surface) is the surface itself: the topics fvhud already owns,
the `hud.rects` island call and the layer file.

A mod that only wants its own bar on the HUD does not need a pack at all: register a GUI layer the
normal way and it keeps drawing, because fvhud cancels only the `minecraft:` ids it names.

## Server addons

`FvUiApi` is the client registry: it runs on the render thread and a dedicated server never reaches
it. The server half is `FvUiServerApi` in `fatevis.fvui.common`, which compiles on both sides and is
a no-op where there is no channel, so one addon jar can register both.

```txt
FvUiServerApi.topic("shop.balance", 40, () -> economy.total());
FvUiServerApi.action("shop.buy", (player, args) -> shop.buy(player, args), Commands.LEVEL_ALL, "Buy");
```

A page reads that under the `server.data.` prefix, here as `server.data.shop.balance`, and calls it through `server.act`. Every action id
needs a command level, and a pack needs the `server:data` capability before it may touch either.
[Servers](/en/fv-ui/server) is the whole server side: the channel, the limits, `/fvui`, and packs a server delivers.
