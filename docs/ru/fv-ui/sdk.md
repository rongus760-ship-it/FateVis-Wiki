# JS SDK

`@fvui/sdk` — это мост из главы [Мост](/ru/fv-ui/bridge), поверх которого добавлены типы, кэш тем, подсчёт подписок и мок
для браузера. Ничего из этого не обязательно: пак может вызывать `window.fvui` напрямую, как это делает `packs/example/`.
SDK существует, чтобы страница на фреймворке не писала заново учёт подписок.

## Пакеты

| пакет | что в нём | peer |
|---|---|---|
| `@fvui/sdk` | мост, сигналы, темы, хранилище пака, ресурсы, звук, тема оформления, мок | нет |
| `@fvui/vue` | `useGame`, `useStore`, `useRes`, `useSignal`, `permissionNeeded` | vue ^3.5 |
| `@fvui/svelte` | `gameStore`, `packStore`, `resStore`, `toStore`, `permissionNeeded` | svelte ^5 |
| `@fvui/react` | `useGame`, `useStore`, `useRes`, `useSignal`, `usePermissionNeeded` | react ^18 или ^19 |

Все четыре — ESM с `.d.ts`, собираются tsup, а их версия равна `mod_version` в
`mods/gradle.properties`. Один номер на мод, диапазон `fvui` в манифесте и пакеты.

## Установка

В 0.1.0 их нет в npm. Внутри дерева fv-ui это npm-воркспейсы папки `web/`; пак вне дерева
подключает их по пути:

```txt
"dependencies": {
  "@fvui/sdk": "file:../../web/sdk/core",
  "@fvui/vue": "file:../../web/sdk/vue"
}
```

`npm run build` в `web/` должен быть выполнен хотя бы раз, потому что пакеты используются в
собранном виде. Когда их опубликуют, замените оба на `"^0.1.0"`.

Адаптер — это `file:`-зависимость вашего пака, но свой фреймворк он находит внутри дерева SDK,
поэтому на странице может оказаться две копии фреймворка. Именно для этого каждый шаблон задаёт
`resolve.dedupe` в конфиге Vite; шаблон React без этого не работает.

## Сигналы

Один примитив, который оборачивает каждый адаптер:

```txt
interface Signal<T> {
  get(): T
  subscribe(cb: (value: T) => void): () => void
}
```

`derive(signal, map)` — представление другого сигнала только для чтения. Число подписчиков
сигнала темы и есть счётчик, который видит игра: первый подписчик шлёт `state.sub`, последний —
`state.unsub`, а подписка и отписка в одном тике взаимно уничтожаются ещё до вызова моста. Сигнал,
выданный `topic(id)` или `storeSignal(key)`, — одна кэшированная ячейка на id, и он сохраняет
идентичность на всё время жизни страницы, что и нужно `useSyncExternalStore`; у `derive()` этого нет.

## Мост

```txt
native                     true in game, false when the mock stands in
call(method, args)         raw bridge method
act(id, args)              game action, rejects with {code, message}
skinAct(action)            flow layout input replayed on the real widgets
loadingAct(action)         presses a button the loading screen already shows
trackIslands(m, measure)   measures island rects per frame and sends the batch when they move
islandRect(el, rest)       rounded bounds of an element, the unit island rects are in
sub(topics) / unsub(ids)   raw subscription, `topic()` is the typed way in
state(key, cb) / on(name, cb)
errorCode(error)           "capability", "limit", "error"
```

## Данные игры

```txt
topic(id)                  Signal of a topic, typed by the Topics map
setTopic(id, value)        fills a topic locally, for demo pages and mode switches
```

`Topics` в `topics.ts` написан вручную, а не сгенерирован. Мод добавляет свои темы через слияние
объявлений:

```txt
declare module '@fvui/sdk' {
  interface Topics { 'example.counter': number }
}
```

Отсутствие id ядра в этой карте ловит `tools/check-dk.mjs`, а не генератор кода: формы вывода Gson
нельзя интроспектировать, а сторонние темы нам всё равно неизвестны.

Поле `kind` у прямоугольника-острова говорит, что игра в нём рисует: `item`, `text`, `face` и `tooltip` на
виде HUD, `entity` и `grid` на виде меню. `text` — одна перенесённая строка чата или
таб-листа, `face` — голова игрока, `tooltip` — компонент подсказки, под который страница зарезервировала место; см.
[Экран HUD](/en/fv-hud/hud-surface).

SDK также несёт ванильную подсказку как один элемент, который монтирует каждый экран, так что
геометрия рамки существует в одном месте:

```js
import { mountTooltip } from '@fvui/sdk'
const off = mountTooltip(host, { unit: () => screen.unit })
```

## Хранилище пака

```txt
storeReady()               resolves with the pack version that wrote the file
storeSignal(key)           Signal of one key, reads the whole file once
setStore(key, value)       writes through, updates the page at once
removeStore(key)
isLimitError(error)        true for a write over 16 KB per value, 256 KB per file or 512 keys
```

Весь файл — это один запрос, так что после первого чтения ключ — простой поиск. `storeReady()` —
сигнал к миграции на стороне страницы: версия, с которой он разрешается, — та, что писала последней.

## Права

```txt
gated(id, args)            resolves null instead of rejecting when the grant is missing
isCapabilityError(error)
permissionNeeded           Signal of the id the game last refused, null while nothing is pending
```

Вызов никогда не удерживается открытым на время нативного экрана согласия, поэтому страница
продолжает работать, а следующее нажатие просто проходит. Уровни — в главе [Права](/ru/fv-ui/capabilities).

## Ресурсы, звук, тема

```txt
resUrl(path)               Signal of a fvui://res/ url, follows res.epoch
resUrls(paths)             res.need for paths the manifest does not list
sound.click(), sound.back(), sound.hover(), sound.music(id)
UI_SOUNDS                  the vanilla ids the sound bridge allows without sound.any
bootTheme(mount)           preset and pack theme from the page url, then mount
setPreset(name), applyTheme(state), PRESETS
```

`sound.hover()` ограничен по частоте и выключен, пока не задан ключ хранилища `ui.hoverSound`: звук на
каждое движение указателя — дело вкуса. `bootTheme` монтирует после того, как файл темы загрузился, дал ошибку или
прошла одна секунда, так что хост, который никогда не отвечает, не стоит странице первого кадра.

## Мок для браузера

`@fvui/sdk` ставит замену, когда `window.fvui` нет, — благодаря этому `npm run dev` работает в
обычном браузере. Он отвечает на `state.sub`, `store.get`, `store.set`, `store.remove` и
`res.need` и несёт тестовое состояние титула, миры, серверы и настройки.

```txt
installMock({ topics, actions })   topic values and action handlers of the page
mockPush(key, value)               push a topic to the page
mockEmit(name, payload)            fire an ordered event, e.g. a mode switch
```

Страница различает их по `native`, а не определением возможностей.

## Адаптеры

Vue:

```js
const state = useGame('title.state')          // ComputedRef, undefined until the first push
const worlds = useGame('worlds', [])          // with a fallback
const runs = useStore('example.runs', 0)
const url = useRes('minecraft/textures/block/dirt.png')
```

Svelte:

```js
const title = gameStore('title.state')        // readable, $title auto-subscribes in markup
const runs = packStore('example.runs', 0)     // writable, a write goes through store.set
const url = resStore('minecraft/textures/block/dirt.png')
```

React:

```js
const state = useGame('title.state')
const runs = useStore('example.runs', 0)
const url = useRes('minecraft/textures/block/dirt.png')
const needed = usePermissionNeeded()
```

Каждый адаптер — около 30 строк и ничего не знает об игре: кэш, подсчёт подписок и
пакетирование живут в одном месте, в `@fvui/sdk`. Vue отписывается на `onScopeDispose`, Svelte — на последнем
подписчике стора, React — при размонтировании. Правило во всех трёх одно: подписывайтесь в том
компоненте, который показывает данные, а не в корне, чтобы игра перестала считать тему, на которую никто не смотрит.

## Тесты

`npm test` в `web/` прогоняет 26 тестов vitest на моке: подсчёт подписок и взаимно уничтожающуюся
пару sub/unsub, `seed`, который заполняет только невиданные темы, полный цикл хранилища и отказ по лимиту,
`gated` при ошибке прав, путь таймаута `bootTheme` и одну подписку на тему в каждом
из трёх адаптеров.
