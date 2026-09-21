# Документ раскладки и codegen

Документ раскладки — один JSON-файл, описывающий весь пак: его экраны, элементы, где они
стоят, что читают и что делают. `@fvui/codegen` превращает его в обычный пак на Svelte, а
редактор из M8b правит тот же файл. Интерпретатора времени выполнения нет: пак, который вы отдаёте, — это код, так что
то, что рисует редактор, и то, что рисует игра, — одни и те же компоненты.

```txt
layout.json  --  fvui-codegen build  -->  a Svelte project whose dist/ is the pack
```

Три правила действуют везде ниже:

- **`format` — единственный барьер совместимости.** Неизвестный формат отклоняется, его никогда не угадывают и не мигрируют.
- **Ничто не «не поддерживается».** Функция, которая ещё не вышла, помечена *later* и называет шаг, на котором
  выйдет, — в сообщении валидатора и в инспекторе редактора. Генератор всё равно отказывается её выводить,
  так что пак не может нести вызов, который молча провалился бы во время работы.
- **Набор открыт.** Типы элементов, id действий и вызовы в выражениях растут без повышения
  `format`, см. «Как растёт формат» ниже.

## 1. Форма

```json
{
  "format": 1,
  "id": "my-pack", "version": "1.0.0", "name": "My Pack", "fvui": ">=0.1.0",
  "meta": { ... },                     editor state, carried through untouched
  "tokens": { "--glow": "#ffb347" },   become theme.css
  "presets": { "high-contrast": {...} },
  "assets": [{ "id": "plate", "file": "art/plate.png", "w": 148, "h": 248, "preload": true }],
  "res": ["minecraft/textures/gui/sprites/icon/language.png"],
  "sounds": { "menu": "sounds/menu.ogg" },
  "backdrop": { "loading": "art/loading-bg.png" },
  "fonts": ["@fontsource/geologica/latin-400.css"],
  "deps": { "@fontsource/geologica": "^5.3.0" },
  "vars": { "picked": "none" },
  "types": { "cobble:ball": { "from": "@cobble/elements", "component": "Ball", "props": ["species"] } },
  "prefabs": { "PlateButton": { "params": [...], "root": {...} } },
  "surfaces": { "title": { "canvas": {...}, "layouts": [...] } }
}
```

`id`, `version`, `name`, `authors`, `license`, `description` и `fvui` дословно попадают в сгенерированный
манифест, так что они не могут разойтись. `assets[].preload` выводит тег `<link rel=preload as=image>`.
`meta` — единственное место, где живёт состояние редактора, так что сгенерированный код никогда его не несёт.

Один экран на каждую запись `PackManifest.SURFACES`: `title`, `loading`, `skin`, `hud`, `editor`. Пауза —
не экран: это раскладка `skin`, у которой `target.screen` равен `PauseScreen`.

## 2. Раскладки, наложение и нацеливание

Экран хранит список раскладок.

```txt
"title": {
  "canvas": { "mode": "fit", "baseW": 1920, "baseH": 1057, "unit": 2 },
  "layouts": [
    { "id": "main", "stack": true, "index": 0, "backgrounds": [...], "focus": {...}, "root": {...} },
    { "id": "april", "requires": "month() == 4 && day() == 1", "priority": 10, "root": {...} }
  ]
}
```

| поле | что делает |
|---|---|
| `stack` | раскладка рисуется *вместе* с другими наложенными, по порядку `index`, меньшие первыми |
| `index` | порядок наложения, layout index оригинала |
| `priority` | между исключающими раскладками (без наложения): побеждает первое совпадение по приоритету |
| `requires` | требование на всю раскладку, грамматика из раздела 6 |
| `enabled` | выключенная раскладка остаётся в документе; её переключает `editor.layout.set` (later, M8b шаг 12) |
| `random` | `{group, oncePerSession}`, одна из группы выбирается при каждой загрузке меню (later, M12) |
| `target` | на какой экран отвечает раскладка |
| `timelines` | аниматоры на всю раскладку, один набор дорожек на несколько элементов, раздел 8 |
| `canvas` | переопределяет холст экрана |
| `backgrounds` | стек фонов, снизу вверх |
| `focus` | `{order: [<element id>...], wrap: true}` |
| `title` | собственный заголовок экрана |
| `root` | единственный элемент, дочерние элементы которого и есть дерево |

Наложенные корни становятся соседними поддеревьями под одним `<Root>` в порядке документа, так что элемент `native` может
стоять между двумя нашими: «рисовать свои элементы за ванильными» здесь не флаг, а место, куда вы
ставите элемент.

`target` — это `{screen, id, class, superclass, mod, titleKey, layout, inGame, phase, include, exclude,
custom, replace}`. Совпасть должно каждое заданное поле.

| поле | что сопоставляет |
|---|---|
| `screen` | имя класса, которое сообщает игра, `PauseScreen`. Единственная строка оригинала, по-прежнему принимается |
| `id` | полное имя класса |
| `class` | шаблон имени класса, где `*` — что угодно, `net.minecraft.*.OptionsScreen` |
| `superclass` | любой класс в цепочке экрана, так что `OptionsSubScreen` отвечает за целое семейство |
| `mod` | id мода класса экрана, по пакету: `minecraft`, `neoforge` или второй сегмент имени поставщика |
| `titleKey` | ключ перевода заголовка экрана |
| `phase` | одна из пяти фаз загрузки |
| `include` / `exclude` | универсальные белый и чёрный списки, exclude побеждает |
| `replace` | рисуется вместо этого экрана — переопределение, скрытое за переключателем advanced |
| `custom` | эта раскладка — собственный экран пака, см. ниже |

`class`, `superclass` и `mod` читают поля `classes` и `mod` из `SkinScreen`, которые модель
скинов сообщает рядом с id. Правило, где не названо ни одно из них, — простая форма с именем класса, и она ничего не стоит.

### Собственные экраны

```txt
"target": { "custom": { "id": "credits", "title": "Credits", "allowEsc": true,
                        "pauseGame": false, "popup": true, "worldBackground": false,
                        "overlay": 0.6 } }
```

Собственный экран — это раскладка экрана **skin**, потому что именно экрану отвечает экран
skin. Он открывается через `{ "open": "custom:credits" }`, а генератор кладёт шесть настроек в
этот вызов, так что хост читает их из действия, и ни один блок манифеста их не несёт. `popup` сохраняет
кадр под собой, `worldBackground` сохраняет мир, а `overlay` — затемнение, которым экран заливает
то или другое. Esc закрывает его только с `allowEsc`, потому что `WebScreen.shouldCloseOnEsc` равен false для
любой страницы.

Цель с `layout: "flow"` принимается и генерирует раскладку **mirror** с предупреждением, где назван M9f:
flow-скины — это вручную подогнанный CSS с обходами для servo и императивными измерениями
(`web/menu/src/skin/flow/`), и генератор, выводящий такой CSS, потерял бы их.

`canvas.mode` — это способ вычисления `--u`: `fit` — блок автомасштаба FancyMenu
(`min(W/baseW, H/baseH) * unit`), `gui` следует за GUI scale игрока через тему `gui.scale`
и откатывается на собственный автомасштаб ванили, `css` приравнивает одну единицу к одному CSS-пикселю — то, что нужно
странице HUD.

## 3. Элементы

`{id, type, name, geo, style?, visibleIf?, when?, once?, opacity?, on?, timeline?, children?, ...type fields}`

`id` — шесть символов `[a-z0-9]`, выдаётся один раз и никогда не используется повторно. Он выводится как `data-fv="<id>"`,
и именно по нему работают CSS, отмена, экземпляры префабов и определение ручных правок. `name` —
подпись в панели слоёв, в сгенерированный код она никогда не попадает.

| тип | поля | во что рендерится |
|---|---|---|
| `group` | `clip`, дочерние элементы | `<Box>`, div. Фигуры и желоба полос прогресса — это group со `style` |
| `image` | `asset` или `res` или `url`, `fit`, `pixelated`, `alt` | `<Img>` |
| `text` | `text`, `align`, `wrap`, `budget`, `scrim`, `shadow` | `<Text>`; `budget` — лимит символов, servo не рисует многоточие |
| `rich` | `source`, `align` | `<Rich>`, простой текст до Component to HTML (M10) |
| `button` | `label`, `hoverLabel`, `sprite`, `hoverSprite`, `icon`, `disabled`, `tooltip`, `sound` | `<Button>`, `div role=button`: servo игнорирует flex на настоящей кнопке |
| `slideshow` | `assets`, `duration`, `fade`, `randomize`, `pauseHidden`, `fit` | `<Slideshow>` |
| `ticker` | `lines` или `source`, `interval`, `fade`, `randomize`, `align`, `wrap` | `<Ticker>` |
| `splash` | `source`, `scale`, `bounce`, `rotate` | `<Splash>`, с автоподгонкой по ванильному образцу |
| `bar` | `value`, `direction`, `indeterminate` | `<Bar>`, одна привязанная доля |
| `slider` | `value`, `kind`, `min`, `max`, `step`, `round`, `values`, `label`, `sprite`, `handle`, `store` | `<Slider>` |
| `checkbox` | `checked`, `label`, `sprite`, `checkSprite`, `store` | `<Checkbox>` |
| `input` | `value`, `filter`, `max`, `hint`, `store` | `<Input>` |
| `tooltip` | `text`, `follow`, `target`, `wrap` | `<Tooltip>` |
| `dragger` | `store`, `axis`, дочерние элементы | `<Dragger>`, смещение сохраняется |
| `cursor` | `asset`, `hotspotX`, `hotspotY`, `scope` | `<Cursor>`, CSS `cursor: url()` |
| `audio` | `tracks`, `mode`, `loop`, `volume`, `autoplay` | `<Audio>`, ничего не рисует |
| `music` | `menu`, `world` | `<Music>`, переключатель ванильной музыки, ничего не рисует |
| `item` | `stack`, `count`, `decorations` | `<Item>`, контракт острова |
| `entity` | `entity`, `scale`, `yOffset`, `crouching`, `follow` | `<Entity>`, контракт острова |
| `grid` | `spacing` | `<Grid>`, сетка статуса чанков |
| `native` | селектор `widget`, `mode`, `label` | `<Native>`, ванильный виджет — повторённый, размещённый или скрытый |
| `prefab` | `prefab`, `args` | сгенерированный компонент префаба |
| `compass` | `yaw`, `range`, `cardinals`, `needle`, `markers`, `entities` | `<Compass>` поверх `player.pos`, `hud.markers` и `world.entities` |
| `overlay` | `kind`, `density`, `speed`, `color`, `src` | `<Overlay>`, один декоративный оверлей в собственной рамке |
| `shader` | `source`, `color` | `<Shader>`, поверхность WebGL с плоским запасным вариантом |
| `video` | `src`, `poster`, `loop`, `autoplay`, `muted`, `volume`, `fit` | работает с библиотекой `-media`, без неё — постер |
| `frame` | `url`, `scroll` | работает, только страница `fvui://`: остальное отклоняет проверка origin моста |
| `model` | `model` | later: нужен новый вид острова |

`item`, `entity` и `grid` рендерятся только там, где их рисует хост. У вида редактора начиная с M12 есть
собственный хост островов, так что в игре они настоящие и на холсте; `item` к тому же
принимает напрямую id `item` — благодаря этому превью работает на титульном экране, где нет
инвентаря, из которого можно прочитать ключ слота. Вне игры браузерный харнесс по-прежнему показывает запечённую иконку.

`on.click` и `on.hover` уместны только на `group`, `button` и `native`: у всего остального нет
обработчика указателя, и валидатор говорит, на какой тип их поставить.

## 4. Геометрия

```txt
"geo": { "anchor": "top-right", "x": -271, "y": 16, "w": 252, "h": 158, "units": "gui" }
```

Девять якорей плюс `parent`: `top-left`, `top`, `top-right`, `left`, `center`, `right`,
`bottom-left`, `bottom`, `bottom-right`. `parent` значит, что начало координат — левый верхний угол родителя, а работу делает
вложенность DOM. Смещения со знаком и всегда отсчитываются от левого верхнего угла, даже при правом или нижнем
якоре, — класс якоря нормализует это, записывая `right: calc((0 - x - w) * --u)`.

`units` — это `gui` (кратные `--u`), `css` (сырые CSS-пиксели, что приравнивает `--u` к 1 для этого элемента
и его дочерних) или `pct` (проценты от родителя). `w` и `h` могут быть `"auto"`.

| поле | что делает |
|---|---|
| `sticky` | `center` или `edge`: держит собственный центр или край элемента на точке якоря — единственный способ отцентрировать рамку, ширина которой неизвестна |
| `clamp` | `true` или поле в GUI-единицах: элемент остаётся на экране. Корень делает один проход после раскладки и после изменения размера |
| `rotate`, `tiltX`, `tiltY` | градусы, ручки поворота и наклона |

Любое из `x`, `y`, `w`, `h`, `rotate`, `tiltX` и `tiltY` может быть привязкой, а не числом —
это Advanced Positioning и Advanced Sizing поверх одного компилятора, а не второй
язык плейсхолдеров.

Выводимый CSS — один класс якоря плюс пользовательские свойства:

```txt
.fv-root [data-fv="a3k9pq"] { --x: 740; --y: -43; --w: 148; --h: 248 }
```

Статическое поле попадает в `<surface>.layout.css`, привязанное едет во встроенном `style` элемента.
То, что перетаскивание — это запись двух пользовательских свойств, а не перекомпиляция, и делает редактор быстрым, и
поэтому геометрия живёт в отдельном файле.

`transform` принадлежит геометрии, поэтому `style.css` не может его задавать: поворот, наклон, sticky и смещение clamp —
одна цепочка, которую пишет генератор, и дорожка таймлайна с transform сворачивается в ту же цепочку.

`style` — это `{tokens?, css?, class?}`. `css` проверяется по тому, чего stylo 0.20 не реализует
(`text-overflow`, `appearance`, `user-select`, `mask-*`, `backdrop-filter`, `contain`, `zoom`,
`clip-path`, `border-image`), и по тому, чем владеет геометрия; первое — предупреждение, второе —
ошибка.

## 5. Привязки

Любое строковое или числовое поле может быть объектом, а не литералом:

```json
{ "topic": "loading.info", "path": "grid.diameter", "scale": -1, "offset": -11, "fallback": 0 }
{ "topic": "title.state", "path": "player", "format": "hello {}", "fallback": "player" }
```

| поле | что делает |
|---|---|
| `topic` | id зарегистрированной темы; `path` идёт по ключам и индексам внутри неё |
| `store` | ключ хранилища пака |
| `lang` | ключ перевода, читается из карты подписей, которую несёт `title.state` |
| `res` | путь ресурса игры, адрес `fvui://res/`, который следует за `res.epoch` |
| `var` | переменная документа |
| `expr` | одно выражение грамматики ниже, для отрицания или сравнения |
| `param` | только внутри префаба: значение одного из его параметров |
| `const` | литерал, чтобы аргумент префаба мог нести его там, где ожидается привязка |
| `format` | только позиционные `{}`, заполняются из этой привязки, затем из `args` |
| `scale`, `offset`, `round` | числа: умножить, прибавить, затем округлить до стольких знаков |
| `map` | таблица «значение → строка», применяется до `format` |
| `fallback` | чем читается отсутствующее значение |

`format` — позиционный и больше ничего: языка выражений внутри строк нет — это
ловушка псевдо-JSON-плейсхолдеров из дорожной карты, и она остаётся закрытой. Арифметика — это `scale` и `offset`,
чего хватает отцентрированной сетке чанков (`-d`, `2d`) и процентам (`x100`).

Привязка компилируется в один стор из `@fvui/svelte` и одно чтение через `$`, а сгенерированный экран
подписывается на каждую тему ровно один раз на весь экран, так что раскладка, которая монтируется позже, рисуется из
значения, которое уже есть.

## 6. `visibleIf`, `when` и `requires`

Одна замороженная грамматика, один компилятор. Пак встраивает скомпилированную строку в `$derived`, редактор
вычисляет ту же строку через `new Function`, так что условие не может значить две разные вещи.

```txt
expr := or ; or := and ('||' and)* ; and := cmp ('&&' cmp)*
cmp  := unary (('=='|'!='|'<'|'<='|'>'|'>=') unary)? ; unary := '!' unary | primary
primary := number | string | true | false | null | path | call | '(' expr ')'
path := root ('.' ident | '[' int ']' | '[' string ']')*
root := topic | store | var | window | time | pack | session
```

Никаких присваиваний, никакого доступа к членам вне корней, никаких собственных функций документа. `== null` и
`!= null` остаются нестрогими, так что отсутствующее значение читается как отсутствующее. `topic.title.state.splash` разбивается по
самому длинному известному id темы; `topic['my.addon.topic'].field` — явная форма для id, о котором этот набор инструментов
не слышал.

Вызовы: `hour() minute() second() day() month() year() weekday() has(<mod id>) seen(<key>)
contains(a, b) starts(a, b) ends(a, b) lower(s) upper(s) len(x) num(x) abs(n) round(n) min(a, b)
max(a, b)`.

`window` — это `{w, h, u, aspect}`, `time` — системные часы (настенные часы, их и читает
`is_realtime_hour`), `session` — флаг сессии, `pack` — `{id, version, name}`.

Выражение с `time` или `hour()` перечитывается по 60-секундному тику, так что правило по часу срабатывает, когда
час меняется.

`visibleIf` переключает `hidden`, а элемент остаётся смонтированным. `when` оборачивает его в `{#if}`, так что его
подписок не существует, пока он выключен: выбирайте `when` для всего, у чего есть остров или таймер.
`once: "session"` монтирует элемент один раз за игровую сессию — `load_once_per_session`
оригинала.

## 7. События, шаги и действия

```txt
"on": { "click": [{ "sound": "click" }, { "act": "open", "args": { "screen": "singleplayer" } }] }
```

События: `click`, `hover`, `mount`, `unmount`, `change` (значение — аргумент обработчика), `tick`
и `listen`, который висит на упорядоченном событии игры, названном в поле `event` элемента:

```json
{ "type": "text", "event": "player.damage", "on": { "listen": [{ "sound": "hit" }] } }
```

Раскладка слушает и без элемента — в этой форме пишет редактор:

```txt
"listen": { "player.damage": [{ "sound": "hit" }], "topic:hud.player": [{ "set": "hp", "value": ... }] }
```

`topic:<id>` срабатывает всякий раз, когда меняется эта тема, — это большинство из 85 типов слушателей оригинала
без собственного канала. Список событий — в главе [Темы и действия](/ru/fv-ui/topics-actions).

Шаг — одно из:

| шаг | что делает |
|---|---|
| `{act, args}` | любой id зарегистрированного действия |
| `{sound, pitch, volume}` | `click`, `back`, `hover` или полный id звука, которому нужен `sound.any` |
| `{music, fade}` | игра держит её между экранами; `null` возвращает музыку ванили |
| `{store, value}` | пишет ключ хранилища пака |
| `{set, value}` | пишет переменную документа |
| `{open}` / `{link}` | сахар поверх `open` и `link.open` |
| `{skin}` | данные для `skin.act` |
| `{call}` | только внутри префаба: вызывает один из его параметров `action` |
| `{if, then, else}` | по грамматике раздела 6 |
| `{delay, then}` | выполняет `then` через заданное число секунд |
| `{later, then}` | то же, читается как боковая ветка |
| `{group, then}` | папка: только группирует в дереве, шаги выполняются на месте |
| `{comment}` | заметка, выводится как комментарий в сгенерированном коде |

Это весь набор операторов оригинала минус `while`, который намеренно оставлен за бортом (FM#1357):
бесконечный цикл в скрипте меню — это зависание, а оригинал ограничивает его тремя секундами, вместо
того чтобы отказать.

Каждый id `act` сопоставляется с правом, которое ему нужно, а генератор объединяет их в сгенерированном
`fvui.pack.json` — это закрывает ловушку, когда пак, забывший объявить право, видит отказ вызова
вообще без запроса. Id из набора NEVER проваливает генерацию с указанием id и пути в документе; id,
который формат резервирует, проваливает её с указанием шага, на котором он выйдет.

Зарезервированные id — ни один не реализован, но все названы, чтобы документ можно было написать под них
и получить отказ с причиной: `pack.file.*` (`read`, `write`, `list`, `delete`, `pick`, уровень always
внутри `fvui_data/<pack id>/`), `files.*` (`read`, `write`, `copy`, `move`, `rename`, `delete`,
`unzip`, `reveal`, уровень ask с корнем в каталоге игры и списком запретов), `clipboard.read`,
`net.request`, `media.*` и `music.vanilla`. Каждый из них ждёт M11, чьи правила распространения
решают, что серверному паку нельзя давать никогда, поэтому у них стоит «M12b после M11».
`process.exec` зарезервирован и намеренно отклонён: паритет 3.3, пункт 5.

## 8. Таймлайны

```txt
"timeline": [{ "track": "opacity", "from": 0.02, "to": 1, "delay": 2, "dur": 2.5,
               "ease": "linear", "once": "session", "stagger": 0.15 }]
```

Дорожки `opacity`, `x`, `y`, `scale`, `rotate`, `blur`, `var`, плюс сырая дорожка `keys` из
`[{t, value, ease}]`, где `value` — CSS-объявление. Дорожка `var` называет пользовательское свойство, которое
пишет (`{"track": "var", "name": "--fv-glow", "from": 0, "to": 1}`); stylo интерполирует
незарегистрированное пользовательское свойство дискретно, так что дорожка var читается как переключатель, если свойство,
которое она питает, само не анимируется. В servo 0.5 нет Web Animations API, и он намеренно
остаётся выключенным, поэтому дорожки компилируются в `@keyframes` плюс одно сокращённое `animation:` в
`.layout.css`. Все дорожки transform одного элемента делят одну анимацию, потому что свойство
`transform` одно.

- `once: "session"` помещает анимацию под класс `.fv-intro`, который корень ставит по session
  storage: возврат из Options рисует всю раскладку сразу.
- `stagger` выводит `animation-delay: calc(<delay>s + var(--i) * <stagger>s)` и `--i` для каждого дочернего элемента, так что
  колонка из шести кнопок — это одна дорожка, а не шесть.
- `random` разбрасывает старт каждой цели по заданному числу секунд. Смещение — это хеш
  id элемента, а не бросок при каждой загрузке меню, так что холст и пак совпадают, а эталонный вывод
  воспроизводим; бросок при каждой загрузке потребовал бы записи во время работы на каждом анимированном узле.
- `ease` — имя пресета или буквальная кривая `cubic-bezier()` / `steps()`. Пресеты лежат в
  `web/layout-schema/src/ease.ts`: linear, четыре ключевых слова CSS, а также sine, quad, cubic, expo и
  back в вариантах in/out/in-out, плюс `step-start` и `step-end`. У Element Animator оригинала их нет.
- Блок `@media (prefers-reduced-motion: reduce)` и блок `.fv-reduced` выводятся всегда;
  второй — потому что у харнесса нет настроек рабочего стола, и `?motion=reduce` должен до него дойти.

### Аниматоры

```txt
"timelines": [{ "id": "intro", "targets": ["rowone", "rowtwo"],
                "tracks": [{ "track": "opacity", "dur": 0.5, "ease": "back-out", "stagger": 0.12 }] }]
```

Аниматор уровня раскладки управляет сразу несколькими элементами — это Element Animator
оригинала. Его `stagger` считает цели в том порядке, в каком они перечислены, а не дочерние элементы, и
смещение разрешается в задержку, а не остаётся на `--i`. Элемент, у которого есть собственный
`timeline` *и* который входит в аниматор, получает одно объединённое сокращённое `animation`: два правила на одном
селекторе молча отбросили бы первое.

## 9. Фоны

`backgrounds` — стек, снизу вверх, и самый нижний должен быть непрозрачным: под ним лежит чёрный
подложечный слой.

| вид | поля | состояние |
|---|---|---|
| `color` | `color` | работает |
| `image` | `asset`, `fit`, `keepAspect`, `pixelated`, `blur` | работает |
| `slideshow` | `assets`, `duration`, `fade`, `randomize` | работает |
| `animation` | `assets`, `fps` | работает, папка кадров с заданной частотой |
| `panorama` | `assets`, `duration` | работает, CSS-куб из шести граней в ванильном порядке |
| `world` | - | работает: страница оставляет прозрачную основу, а игра рисует то, что за ней |
| `browser` | `src` | работает, вложенная страница |
| `shader` | `src` | работает, поверхность WebGL; вид без контекста откатывается на `color` |
| `video` | `src` — клип, `assets[0]` — постер | работает с библиотекой `-media`, без неё — постер |

Декоративные оверлеи — список рядом с фонами; они рисуются поверх всего и никогда не участвуют в проверке попадания:

```txt
"overlays": ["snow", "lights"]
```

Девять из десяти оверлеев оригинала рисуются — `confetti`, `firefly`, `fireworks`, `leaves`, `rain`, `snow`,
`lights`, `browser` и `shader` — как один компонент `Overlay` с видом, а не по типу элемента
на каждый. Питомец намеренно пропущен. Тот же компонент можно разместить как тип элемента `overlay`,
когда оверлей относится к одной рамке, а не ко всей раскладке.

`darken` — ванильное затемнение. `blur` отмечает ванильное размытие: в stylo нет `backdrop-filter`,
так что размытая основа — это запечённое изображение или собственный проход игры.

## 10. Префабы

```txt
"prefabs": { "PlateButton": { "params": [{ "name": "label", "type": "string" },
                                         { "name": "onClick", "type": "action" }],
                              "root": { ...tree, "label": { "param": "label" } } } }
```

Генерируется как `src/prefabs/PlateButton.svelte` с одним типизированным пропом на параметр. Экземпляр — это
элемент `prefab`, несущий `args`, и корневая рамка принадлежит ему: `id`, `anchor` и класс экземпляра
приходят как пропсы, а всё ниже сохраняет собственные id и геометрию префаба в `prefabs.layout.css`.

Параметр — это `string`, `number`, `boolean`, `asset`, `assets`, `lines`, `action` или `binding`, а
`{param}` может стоять везде, где стоял бы литерал, включая поля-списки и поля-объекты. Редактор несёт
стартовую библиотеку в `web/editor/prefabs/`: Button, Panel, Slideshow, ServerCard и пять полос-иконок SpiffyHUD
(HeartBar, FoodBar, ArmorBar, AirBar, MountBar) поверх темы `hud.player` из M5 — поэтому
эти пять не являются типами элементов.

Отсоединение экземпляра встраивает поддерево префаба с уже подставленными аргументами и свежими
id; побеждает рамка экземпляра, потому что именно её перетаскивал автор.

## 11. Как растёт формат

Ничто из этого не повышает `format`:

- **Типы элементов.** Тип с пространством имён `<ns>:<name>` либо объявлен в блоке `types` документа
  (`{from, component, props}`), либо зарегистрирован плагином редактора через `registerType`.
  Генератор выводит импорт из `from`: путь с `./` разрешается относительно корня пака, так что написанный
  вручную компонент в `elements/` становится `import Clock from '../elements/Clock.vue'` в
  экране. Компонент `.vue`, `.tsx` или `.jsx` монтируется через адаптер `Foreign` из `@fvui/elements`,
  а его фреймворк, плагин vite и запись `resolve.dedupe` добавляются в сгенерированный
  проект. В любом случае сгенерированный пак зависит от компонента и никогда — от плагина или панели;
  способ написать такой в игре — [Панель кода](/ru/fv-menu/code-editor).
- **Id действий.** Работает любой зарегистрированный id; генератор добавляет его в `capabilities`.
- **Темы.** `KNOWN_TOPICS` — реестр, засеянный встроенным списком и пополняемый из
  `api.catalogue`, так что тема аддона разбивается в правильном месте.
- **Вызовы в выражениях.** Добавление вызова — минорное изменение инструментов. Документ с вызовом, которого более старый
  генератор не знает, проваливает проверку с `unknown call <name>()`, а не компилируется неправильно, а
  `.fvui-codegen.json` записывает набор вызовов, которые документ действительно использовал.

## 12. Сгенерированный пак

```html
<out>/
  package.json vite.config.ts svelte.config.js tsconfig.json index.html
  .fvui-codegen.json          generator version, document hash, call set, per file hash
  pack/fvui.pack.json         generated: id, version, entries, theme, capabilities, res, sounds
  pack/theme.css              generated from the document tokens and presets
  pack/layout.json            the document itself, so a built pack reopens in the editor
  pack/art/ pack/sounds/      copied assets
  src/main.ts src/mode.ts src/App.svelte src/styles.css
  src/<Surface>.svelte        generated, hand editable
  src/<surface>.layout.css    generated, machine owned
  src/prefabs/<Name>.svelte   generated
  src/vars.ts                 document variables
```

`src/styles.css` несёт палитру токенов по умолчанию в блоке `@layer fvui`: каждое пользовательское свойство,
которое читает `@fvui/elements`, так что документ, не объявивший `tokens`, всё равно рисуется в цвете. Неопределённое
пользовательское свойство недействительно на этапе вычисленного значения, что рисуется как чёрное на чёрном, а обычный `:root`
темы пака побеждает слой, не подгоняясь под него.

При проверке в игре редактор пишет рядом с этим деревом ещё и **загружаемую** страницу ([Редактор раскладки](/ru/fv-menu/editor)): те же
компоненты, скомпилированные на странице, один `page.css`, загрузочный модуль `page.js` и runtime-чанк. Это
читает игра; а это дерево правит автор.

`pack/` едет в `dist/` так же, как в любом шаблоне, так что `npm install && npm run build` делает
`dist/` паком. Вывод побайтно одинаков для одного документа на любой машине: порядок элементов — порядок дерева
документа, id берутся из документа, импорты отсортированы по пути модуля, один фиксированный форматтер чисел,
никаких меток времени и абсолютных путей. Генератор сам печатает с отступом в два пробела; `--prettier` запускает
prettier, если он установлен у автора.

## 13. CLI

```txt
npx fvui-codegen build layout.json out/ [--assets=<dir>] [--deps=workspace|file] [--sdk=<path>]
                                       [--force] [--prettier]
npx fvui-codegen check out/
```

`build` проверяет, затем пишет. `--assets` говорит, откуда читать файлы ассетов, когда они не
лежат рядом с документом. `--deps=file` направляет `@fvui/sdk`, `@fvui/svelte` и `@fvui/elements` на
checkout вместо воркспейса.

`check` заново хеширует каждый файл из списка `.fvui-codegen.json` и сообщает одно из трёх состояний:

- все хеши совпадают: обычная правка.
- изменился `<surface>.layout.css`: им владеет машина, так что следующая сборка его перезапишет и скажет об этом.
- изменился `<Surface>.svelte`: этот экран находится в **keep code**. Следующая сборка его не трогает
  (`--force` перезаписывает, предварительно записав `.bak`), а геометрия и стиль по-прежнему генерируются рядом,
  потому что они трогают только `.layout.css`. В редакторе дерево слоёв и инспектор там становятся
  только для чтения в части структуры.

Пак без `layout.json` открывается только для чтения: редактор никогда не восстанавливает документ из
кода, потому что ничто из того, что он мог бы восстановить, не было бы надёжным. Неизвестный `format` отклоняется с обоими
номерами версий.

## 14. Карта понятий FancyMenu

Полный перечень — `docs/plans/m8-parity.md`; здесь сказано, чем каждое понятие является у нас. Ничто в этой
таблице не «не поддерживается»: строка, которая ещё не вышла, называет свой шаг.

### Элементы

| FancyMenu | здесь | состояние |
|---|---|---|
| Button (`custom_button`) | `button` с `on.click` | работает; `mimicbutton` — это `{act: "open"}` или нажатие через `{skin}` |
| Slider (`slider_v2`) | `slider`, `on.change` видит значение | работает |
| Checkbox | `checkbox` | работает |
| Text Input Field | `input` | работает |
| Tooltip | `tooltip` | работает |
| Item | `item` | работает, остров |
| JSON-модель блока или предмета | `model` | later: нужен новый вид острова |
| Image | `image`, nine-slice и оттенок через `style.css` | работает |
| Text (`text_v2`) | `text`, markdown как `rich` | работает; настоящий markdown — с Component to HTML, M10 |
| Video (`video`, `video_rinku`) | `video` | работает с библиотекой `-media`, без неё — кадр-постер |
| GLSL-шейдер | `shader`, а также фон и оверлей `shader` | работает, WebGL с плоским запасным вариантом |
| Slideshow | `slideshow` | работает |
| Фигуры: прямоугольник и круг | `group` со `style` (`background`, `border-radius`) | работает |
| Splash text | `splash` | работает, с подгонкой по ванильному образцу |
| Player entity (`player_entity_v2`) | `entity` | работает, остров |
| Browser | фон и оверлей `browser`, а также элемент `frame` для страницы `fvui://` | работает |
| Element animator | `timeline` на элементе, `stagger` для смещения по целям | работает; дорожки на несколько целей — M8c, шаг 15 |
| Ticker | `ticker` плюс `on.tick` | работает |
| Audio (`audio_v2`) | элемент `audio` или шаги `{music}` / `{sound}` | работает |
| Music controller | `music` | работает для музыки меню; `music.vanilla` зарезервирован для переключения в мире |
| Progress bar | `bar` | работает |
| Dragger | `dragger` | работает |
| Cursor | `cursor` | работает |
| Ванильный виджет (`vanilla_button`) | `native`, `mode` mirror, place или hide | работает; переопределение подписи и спрайта — M8c, шаг 13 |
| Полоса загрузки Drippy в ванильном стиле | `bar`, привязанный к `loading.progress` | работает |
| Полосы-иконки, слот, зеркало SpiffyHUD | `image` плюс `group` плюс привязка к темам HUD из M5 | работает |
| Компас SpiffyHUD | `compass` поверх `player.pos`, `hud.markers` и `world.entities` | работает |
| Удаление оверлеев и ластик SpiffyHUD | правило `hud.overlay` | later: удалению нужно правило ванильного оверлея, ластику — проход со stencil |
| Player entity v1, Video [Rinku] | - | устарели в оригинале, заново не реализованы |

### Требования

92 семейства требований FancyMenu здесь — одна грамматика: `visibleIf` на элементе, `requires` на
раскладке, `{if}` в скрипте.

| семейство FancyMenu | здесь |
|---|---|
| `is_realtime_hour/_minute/_day/_month/_week_day/_year` | `hour()`, `minute()`, `day()`, `month()`, `weekday()`, `year()` |
| `is_mod_loaded` | `has('<mod id>')` |
| `once_per_session` | `seen('<key>')`, `once: "session"` |
| `is_window_width/_height`, `_bigger_than`, `is_fullscreen` | `window.w`, `window.h`, `window.aspect` |
| `is_gui_scale` | `topic['gui.scale'].guiScale` |
| `is_language` | `topic.title.state.language` |
| `is_server_ip`, `is_server_online` | `topic['server.address'].address`, `contains()` |
| `is_multiplayer`, `is_singleplayer`, `is_world_loaded` | `topic['server.address']`, `topic['screen.id']` |
| `is_variable_value` | `var.<name>` |
| `is_number`, `is_text` | операторы сравнения, `num()`, `lower()`, `contains()` |
| `is_element_hovered`, `is_button_active` | CSS `:hover` и `:focus`, которым привязка вообще не нужна |
| `is_menu_title`, `is_any_screen_open`, `is_debug_overlay_enabled` | `topic['screen.id']`, `topic.title.state` |
| семейства игрока, мира, режима игры, эффектов, биома, измерения, погоды, ездового животного, инвентаря (около 45) | `topic['player.state']`, `topic['player.pos']`, `topic['player.inventory']`, `topic['world.weather']`, `topic['world.entities']`, `topic['player.gamemode']` |
| `is_entity_nearby`, `is_slot_filled_with` | `contains(pluck(<list>, 'id'), '<id>')` |
| `is_os_*` | `topic.sys.os` |
| `is_resource_pack_enabled` | `contains(topic['res.packs'], '<id>')` |
| `file_exists`, `is_internet_connection_available` | первое — `pack.file.exists` или `files.exists`; второе ждёт сетевого разрешения, которое остаётся never |
| `is_scheduler_running` | локально для страницы: элемент ticker владеет собственным таймером |

### Действия

| FancyMenu | здесь |
|---|---|
| `opengui`, `closegui`, `back_to_last_screen` | `{open}`, `{act: "open"}`, `{skin: {action: "back"}}` |
| `loadworld`, `joinserver` | `{act: "world.play"}`, `{act: "server.join"}` |
| `set_variable`, `clear_variables` | `{set}` поверх `vars` |
| `enable_layout`, `disable_layout`, `toggle_layout` | `Layout.enabled` плюс `editor.layout.set`, later M8b шаг 12 |
| `play_audio`, `stop_all_action_audios`, управление аудио- и видеоэлементами | `{sound}`, `{music}`, элемент `audio` плюс `music.next`, `music.prev`, `music.toggle` и `music.volume`; видеополовина — `media.play`, `media.pause`, `media.seek` и `media.volume` |
| `openlink` | `{link}`, одно разрешение ask плюс подтверждение на каждый вызов |
| `copytoclipboard` | `{act: "clipboard.write"}`, уровень ask |
| `sendmessage`, `paste_to_chat`, `display_in_chat_client_side` | `{act: "game.chat"}`, уровень ask |
| `execute_command_as_integrated_server` | `{act: "game.command"}`, уровень ask |
| `quitgame` | `{act: "quit"}`, уровень ask |
| `reloadmenu`, `reload_resource_packs` | `{act: "pack.reload"}` и `{act: "resourcepacks.reload"}` |
| `edit_minecraft_option` | `{act: "options.write"}`, уровень ask, или собственный блок `options` раскладки |
| `show_toast`, `print_to_log` | `{act: "toast.show"}` и `{act: "log.write"}` |
| `mimicbutton`, `mimic_keybind` | `{skin: {action: "press", id}}`, селектор `native` |
| `manage_resource_pack` | `{act: "resourcepacks.set"}`, уровень ask |
| десять действий `*_file_in_game_dir`, `download_file_to_game_dir`, `select_file_to_game_dir` | `pack.file.*` и `files.*`, зарезервированы по политике паритета 3.3, M12b после M11 |
| `send_http_request`, четыре действия с удалёнными серверами | `net.request` зарезервирован; `net:fetch` и `net:ws` остаются в наборе NEVER |
| `start_scheduler`, `stop_scheduler` | `{act: "sched.start"}` и `{act: "sched.stop"}` поверх элемента ticker |
| аддон System Interactions, уровень процессов | `process.exec`, зарезервирован и намеренно отклонён |
| исполняемые блоки: `if`, `else if`, `else`, `delay`, `execute later`, папка, комментарий | `{if}`, `{delay}`, `{later}`, `{group}`, `{comment}` |
| `while` | намеренно не сопоставлен (FM#1357): запасной выход — Svelte, исправленный руками |

### Плейсхолдеры

180 плейсхолдеров FancyMenu здесь — типизированные привязки, потому что тема — это форма, а не строка.
Группы и что привязывать:

| группа | сколько | здесь |
|---|---|---|
| Сведения о Minecraft и модах (`mcversion`, `loadername`, `loadedmods`, `totalmods`, ...) | 9 | `topic.title.state` и `topic['loading.info']` |
| GUI, ввод и окно (`guiwidth`, `guiscale`, `screenid`, `mouseposx`, ...) | 13 | `window.w` и `window.h`, `topic['gui.scale']`, `topic['screen.id']`, `topic['screen.title']`, `topic['screen.hover']`; положение указателя локально для страницы, и привязка ему не нужна |
| Реальные время и дата (`realtimehour`, `unix_time`, ...) | 7 | `time.*` и вызовы часов |
| Сервер (`servermotd`, `serverping`, `serverplayercount`, ...) | 5 | `topic.servers[n]`, `topic['server.address']` и `topic['server.ping']` с ключом по адресу. M15 добавил в строку `address`, `motdHtml`, `motdRuns`, `accent` и `accent2` и перевёл `icon` с адреса `data:` на `fvui://servericon/<key>.png?v=<epoch>`; оба годятся как источник для `img`, так что менять нужно только документ, который сравнивал префикс как строку |
| Личность игрока (`playername`, `playeruuid`, `lastdeathmessage`) | 3 | `topic.title.state.player`; uuid и сообщение о смерти остаются названными пробелами |
| Мир и состояние игрока в игре (здоровье, голод, броня, эффекты, координаты, босс, биом, ...) | 69 | `topic['hud.player']`, `topic['hud.effects']`, `topic['hud.bossbars']`, `topic['world.time']` для половины HUD, плюс пятнадцать тем из главы [Темы и действия](/ru/fv-ui/topics-actions) для остального |
| Состояние аудио и видео | 13 | привязки к `media.state` с ключом по id элемента: `<id>.playing`, `<id>.position`, `<id>.duration`, `<id>.volume`, `<id>.paused`, `<id>.src`, `<id>.frame` |
| Система (`osname`, `javaver`, `fps`, `usedram`, `gpuinfo`, `clipboard_content`, `webtext`, ...) | 19 | `topic.sys` отвечает за машинную половину, а `topic['loading.progress'].memory` — за память; `fps`, `clipboard_content` и `webtext` остаются названными пробелами |
| Математика, строки и данные (`calc`, `math_*`, `*_case_text`, `replace_text`, `base64_*`, `json`, `nbt_data_get`, ...) | 42 | `scale`, `offset`, `round`, `format`, `map` на привязке плюс набор вызовов: `lower`, `upper`, `len`, `num`, `abs`, `round`, `min`, `max`, `contains`, `starts`, `ends`. Остальное — темы или вызовы в TODO, а не пробелы формата |
| `getvariable` | 1 | `var.<name>` |

Пробел в этой таблице — это недостающая *тема*, а не недостающая функция формата: новая тема читается в
день регистрации, без изменений в генераторе.

Редактор несёт ту же таблицу как список с поиском: в выборе привязок есть вкладка «placeholder
search» с ключами по именам оригинала, так что автор при миграции набирает `playerposx` и получает
типизированную привязку, а не ищет путь темы. [Редактор раскладки](/ru/fv-menu/editor).

### Настройки раскладки

| FancyMenu | здесь |
|---|---|
| универсальная раскладка, белый и чёрный списки | раскладка без `target` плюс `requires` |
| `layout_index`, наложение | `stack` и `index` |
| `is_enabled`, `.txt.disabled` | `enabled` |
| `randommode`, `randomgroup`, `randomonlyfirsttime` | `random: {group, oncePerSession}`, later M8c |
| `setscale`, `autoscale` с `basewidth`/`baseheight` | `canvas.mode` с `baseW`, `baseH`, `unit` |
| `setopenaudio`, `setcloseaudio` | `on.mount` и `on.unmount` с `{music}` или `{sound}` |
| фоны меню, наложение, сохранение пропорций | `backgrounds`, `keepAspect` |
| ванильное затемнение и размытие фона | `darken` и `blur` |
| `custom_menu_title` | `Layout.title`, later M8c шаг 18 |
| текстуры шапки и подвала прокручиваемых списков | later, M8c шаг 17 |
| идентификаторы экранов, собственные GUI-экраны | `target.screen`, `target.id`, `target.custom`, later M8c шаг 18 |
| группы слоёв, состояние сворачивания | `meta`, панель слоёв |
| декоративные оверлеи (снег, дождь, светлячки, конфетти, ...) | `overlays` у раскладки или элемент `overlay`; питомец пропущен |
| настройка ванильных виджетов (скрыть, сдвинуть, переименовать, текстуры) | `native` с `mode` и `geo` |
| анимации: `.fma`, `.afma`, контейнеры кадров APNG | `background.kind: "animation"` поверх списка кадров или анимированный источник, который декодирует движок |
| вступительная анимация игры | later, M12 |

## 15. Разобранные примеры

`web/showcase-gen/layout.json` — это `web/showcase` в виде документа: та же раскладка титула, те же
якоря, те же поэтапные проявления, слайд-шоу, правило по дню на кнопке музыки и сценарий
`link.open`. `web/showcase-b-gen/layout.json` — это `web/showcase-b`: оверлей загрузки с апрельским
вариантом, экран загрузки уровня с островами сущности и чанков и сеткой чанков, рамка которой —
привязанное выражение, и раскладка паузы как виджеты `native`, перенесённые на сетку оригинала.

Оба отрендерены рядом с написанными вручную паками в харнессе без игры в трёх разрешениях;
расхождения лежат в `.work/m8a/ab.md`.
