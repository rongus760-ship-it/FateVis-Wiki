# Матрица поддержки Servo

Страницы работают на Servo 0.5.0, а не на Chromium. Это современный движок с дырами в конкретных местах, и
дыры молчаливые: нереализованное свойство разбирается и ничего не делает. Эта глава — набор
правил; журналом движка остаётся `docs/prototype-servo.md`.

`isSecureContext` равен true; `structuredClone`, `queueMicrotask`, `MessageChannel` и `MessagePort`,
custom elements, shadow DOM, `MutationObserver`, `ResizeObserver` и `IntersectionObserver` —
всё работает. Синтаксис ES2022, `fetch` адресов `fvui://` и `@font-face` работают.

## Настройки, которые включает движок

В servo 0.5 они по умолчанию выключены и задаются в `native/src/engine.rs`:

```txt
layout_grid_enabled            CSS grid
dom_intersection_observer_enabled
dom_fontface_enabled           @font-face
dom_webgl2_enabled
dom_webgpu_enabled             only in a build with the webgpu feature
```

`FVUI_SERVO_PREFS=name=true,other=12` переопределяет настройки для эксперимента, а
`-PservoPrefs=` передаёт их в dev-запуск. Это для проб, а не для релиза: пак
настройку задать не может.

## Селекторы {#selectors}

| работает | не работает |
|---|---|
| `:is()`, `:where()`, вложенность через `&` | `:has()` |

`parse_has` в servo-парсере stylo возвращает false, поэтому правило с `:has()` отбрасывается целиком,
вместе со всем, что в том же правиле. Ни частичного применения, ни ошибки нет.

Container queries выключены (`layout_container_queries_enabled` по умолчанию false и не задаётся), так что
`@container` никогда не срабатывает. Media queries работают.

## Нереализованные свойства {#unimplemented-properties}

Они разбираются и игнорируются (`servo_pref = "layout.unimplemented"` в stylo 0.20). Те, что
бьют по интерфейсу:

```txt
appearance, -moz-default-appearance
user-select
text-overflow
scrollbar-width, scrollbar-color
scroll-behavior
overscroll-behavior-x / -y / -block / -inline
backdrop-filter
mask-image, mask-clip, mask-composite, mask-mode, mask-origin,
mask-position-x, mask-position-y, mask-repeat, mask-size, mask-type
contain
counter-increment, counter-reset
color-scheme, forced-color-adjust
touch-action
zoom
font-size-adjust
text-underline-offset, text-underline-position, text-decoration-inset, text-orientation
animation-timeline, animation-composition, animation-range-start, animation-range-end
offset-path
view-transition-name, view-transition-class
position-area, position-try-fallbacks
corner-*-shape, math-depth, math-style
```

Следствия, которые стоит проговорить:

- обрезка текста — это бюджет символов в JS или `overflow: hidden`, но никогда не многоточие.
- нумерованный список на CSS-счётчиках рисуется без номеров. Нумеруйте в разметке.
- элементы форм сохраняют вид по умолчанию; `appearance: none` ничего не делает, так что стилизуйте `div`,
  а не воюйте с нативным элементом.
- `user-select` не мешает перетаскиванию выделять текст. Если это важно, используйте `draggable="false"` и
  обработчик `selectstart`.
- anchor positioning, view transitions и анимации по прокрутке недоступны.

`clip-path` разбирается, но тоже не применяется.

## Раскладка {#layout}

- дорожки grid вида `repeat(auto-fill, minmax(min(...), 1fr))` получают неверный размер. Используйте flex-wrap.
- ширина в процентах внутри flex-строки может схлопнуться. Используйте фиксированные px.
- прокручиваемый контейнер внутри колоночного flexbox не растягивается. Задайте `width: 100%`.
- `display: grid` и `display: flex` на `<button>` игнорируются. Используйте `div role="button"` с
  обработчиком keydown.

## Анимация и эффекты {#animation-and-effects}

| работает | не работает |
|---|---|
| CSS keyframes и CSS transitions | Web Animations API, отсутствует намеренно |
| компоненты переходов фреймворков (Vue `Transition` и подобные) | SMIL, SVG с анимацией внутри `<img>` |
| CSS-анимация целого элемента `<svg>` или его обёртки | инлайн-SVG, изменённый после вставки — через CSS, класс, атрибут или `setAttribute` |
| замена целого узла `<svg>`: он растеризуется заново | `shadowBlur` у `canvas` |
| canvas 2D, GSAP, canvas-рендерер lottie | svg-рендерер lottie, любая библиотека, определяющая WAAPI |
| CSS `filter`, `mix-blend-mode` | `backdrop-filter`, `mask-image` |

`dom_web_animations_enabled` намеренно остаётся выключенным. Если его включить, API существует и ничего не делает, так что
библиотека, которая проверяет его наличие, отдаёт значения заглушке, и не двигается вообще ничего. Не используйте
`motion/mini` и всё остальное, что работает только через WAAPI.

`filter: blur()` на анимированном содержимом размывается заново каждый кадр — примерно в восемь раз дороже кадра
для плывущего фона. Запекайте размытые изображения заранее.

Canvas 2D: `setTransform`, `drawImage` с под-прямоугольниками источника, `imageSmoothingEnabled = false`,
операции композиции, включая multiply и destination-in, и радиальные градиенты — всё работает.

Четыре ловушки canvas; все найдены при создании карточек серверов M15, и у каждой обход в одну строку:

| ловушка | что происходит | что делать вместо |
|---|---|---|
| `clearRect(x, y, w, h)` | очищает **весь** canvas, какой бы прямоугольник ни дали, так что нарисованное лицо стирается срезом угла | `globalCompositeOperation = 'destination-out'` и `fillRect` |
| второй `getContext('2d')` | отвечает пустым контекстом, так что нарисованный canvas, прочитанный через новый хэндл, приходит пустым | держите тот контекст, который дал первый вызов |
| canvas как источник текстуры WebGPU | `copyExternalImageToTexture` оставляет текстуру нулевой и ничего не пишет в лог; `<img>` на `data:` ведёт себя так же, `createImageBitmap` и `toBlob` никогда не вызывают колбэк | `getImageData` в `DataTexture`, который загружается правильно |
| `DataTexture` в three | не загружается вообще | задайте `texture.needsUpdate = true`; сам себя помечает только `CanvasTexture` |

Текстура из `<img>` с настоящим URL загружается нормально.

## Тайминг и ввод {#timing-and-input}

- `requestAnimationFrame` работает на фиксированных 125 Гц, а не на частоте кадров хоста. При 60 fps страница рисует около
  четырёх кадров на кадр игры. Анимируйте по прошедшему времени, а не шагом на кадр.
- `mouseenter` не срабатывает на синтетические движения указателя, которые шлёт игра. Используйте `mouseover`.
- Печатные клавиши приходят как `charTyped`; нажатие клавиши несёт только именованные клавиши.
- Скрытие вида сразу показывает прозрачный кадр, поэтому хост держит вид
  видимым при смене экранов.

## Медиа {#media}

`<video>` и `<audio>` играют только в нативной библиотеке, собранной с `--features media`. Такая сборка линкует ещё 12
разделяемых библиотек (9 GStreamer, 3 GLib) и требует рантайм GStreamer с плагинами на
машине игрока, поэтому она идёт отдельным необязательным jar и никогда не по умолчанию: `fv-ui-media`,
ставится **вместо** `fv-ui`, пока только Linux. Файл-маркер `media` рядом с библиотекой —
то, что читает `ServoNative.media()`; `-Dfvui.media=true` отвечает за собранную вручную.

Без такой сборки каждый `canPlayType` отвечает `""` — это и есть способ определения: `@fvui/elements`
проверяет один раз, сообщает результат через `media.probe`, а элемент `video` рисует вместо этого постер.
Полный ответ, с нативной стороны и со стороны страницы, — тема `media.available`
(`{native, probed, types, ok}`), так что пак или редактор могут сказать «установите fv-ui-media», а не
рисовать чёрный прямоугольник.

Звук в медиа-сборке идёт в приёмник GStreamer, а не через OpenAL, поэтому ни один ползунок громкости игры
сам по себе на него не влияет. Элемент `video` поэтому при монтировании читает `options.read` и масштабирует свою
громкость по ползункам музыки и общей громкости; это масштаб при старте, а не живое слежение, и звуки
страницы, которые должны слушаться ползунков, должны идти через `sound.play`.

Измерено на этой машине (GStreamer 1.28.5): webm VP9 с дорожкой Opus играет, `video/webm;
codecs="vp9"` отвечает `probably`, а `video/mp4` отвечает `""` без плагина H.264. Один риск, который
относится к медиа-сборке, а не к нам: GStreamer сканирует системную папку плагинов в процессе
игры, и плагин, упавший там, роняет игру вместе с собой (один раз наблюдалось с
`/usr/lib/gstreamer-1.0/libgstnvcodec.so`, код выхода 139 во время пересборки реестра). Ещё одна причина,
почему медиа-библиотека ставится только по желанию.

## WebGPU и WebGL

| API | состояние | что нужно |
|---|---|---|
| WebGPU | поддерживается, включён по умолчанию | ничего |
| three.js `WebGPURenderer` | поддерживается, самый дешёвый путь к 3D | ничего |
| WebGL1 и WebGL2 | работают, но не поддерживаются | `__GLVND_DISALLOW_PATCHING=1` в окружении лаунчера на NVIDIA |
| three.js `WebGLRenderer` | работает с дефектом | то же, и PBR-материалы рисуются белыми |

WebGPU нужен безопасный контекст и хост, к которому привязывается его поток, а пользовательская схема сама по себе этого
не получает; `native/patches/servo-url` даёт `fvui://` настоящий origin-кортеж, поэтому `navigator.gpu`
существует, а `requestAdapter()` отвечает. Со страницы ничего включать не нужно.

WebGL рисует в поверхности surfman, которые GL-контекст игры не может импортировать, поэтому каждый кадр читается обратно
и загружается заново: около +3.4 мс на кадр игры при 1600x900 с полноэкранным canvas и ничего
измеримого без него. На NVIDIA EGL-контекст surfman нельзя создать рядом с GLX-контекстом
игры, если `__GLVND_DISALLOW_PATCHING=1` не было в окружении до инициализации libGL.
Внутри игры ничто не происходит достаточно рано, так что это остаётся настройкой лаунчера, а без неё WebGL
отказывает чисто: `getContext("webgl")` возвращает null, а в логе появляется

```txt
fvui: WebGL disabled: surfman context creation panicked
```

Поэтому страница, которой нужно 3D, предпочитает WebGPU и считает WebGL запасным вариантом. `WebGPURenderer`
молча откатывается на WebGL2, когда `navigator.gpu` нет, так что пишите бэкенд в лог:

```js
const renderer = new THREE.WebGPURenderer();
await renderer.init();
fvui.call('dev.log', 'backend webgpu=' + renderer.backend.isWebGPUBackend);
```

`MeshStandardMaterial` из three.js на `WebGLRenderer` рисуется выжженно-белым, а на
`WebGPURenderer` с той же сценой — правильно. Избегайте PBR-материалов на пути WebGL.

Замена страницы меню на 3D-страницу стоит от +45 до +105 MB RSS. Бюджета памяти на пак пока
нет, так что обрезайте шрифты и держите один фон.

## Чек-лист перед выбором библиотеки {#checklist-before-picking-a-library}

- использует ли она `:has()` где-нибудь в своих стилях? Правило отбрасывается целиком.
- анимирует ли она через Web Animations API или проверяет его наличие?
- опирается ли её вид на `appearance`, `text-overflow` или `scrollbar-*`?
- нужны ли ей container queries?
- несёт ли она собственный CSS-reset с `color-scheme` или `touch-action`? Безвредно, но он не
  сделает того, чего ожидал автор.

Штатный пак и шаблоны намеренно не несут никакой библиотеки компонентов.

## Линтер ограничений

Каждое ограничение выше — это ещё и одно правило таблицы, по которой панель кода в игре помечает строки и
которую `tools/check-quirks.mjs` прогоняет без игры, так что пак, собранный вне игры, получает те же строки. Таблица
ниже напечатана из этого источника (`node tools/check-quirks.mjs --table`), а
`--check-doc` падает, когда они расходятся. **error** значит, что ничего не рисуется или вызов отклоняется,
**warn** — что рисуется иначе. Ни то ни другое не мешает сохранению. Сообщения приведены так, как их печатает линтер, — на английском.

```sh
node tools/check-quirks.mjs src/Title.svelte      one file
node tools/check-quirks.mjs                       every pack source in the tree
```

<DemoLint />

<!-- quirks:begin -->
| rule | where | what | chapter |
|---|---|---|---|
| `css.has` | css | error: stylo 0.20 drops the whole rule containing :has(), not only the selector | [#selectors](#selectors) |
| `css.text-overflow` | css | warn: no text-overflow: clip with overflow hidden or a character budget | [#unimplemented-properties](#unimplemented-properties) |
| `css.backdrop-filter` | css | warn: no backdrop-filter: bake the blur or let the Java pass draw it | [#animation-and-effects](#animation-and-effects) |
| `css.mask` | css | warn: the mask-* family is unimplemented: use a pre-cut sprite | [#unimplemented-properties](#unimplemented-properties) |
| `css.clip-path` | css | warn: clip-path parses and is never applied: crop the asset | [#unimplemented-properties](#unimplemented-properties) |
| `css.appearance` | css | warn: appearance does nothing: style a div instead of a native control | [#unimplemented-properties](#unimplemented-properties) |
| `css.user-select` | css | warn: user-select does nothing: use draggable="false" and a selectstart handler | [#unimplemented-properties](#unimplemented-properties) |
| `css.unimplemented` | css | warn: on the [Servo support matrix](/ru/fv-ui/servo) unimplemented list: it parses and is ignored | [#unimplemented-properties](#unimplemented-properties) |
| `css.border-image` | css | error: border-image draws nothing: a nine slice is a sprite at an integer scale | [#unimplemented-properties](#unimplemented-properties) |
| `css.container` | css | error: container queries are off in servo 0.5: @container never matches | [#selectors](#selectors) |
| `css.mix-blend-mode` | css | warn: mix-blend-mode is listed as working but is unverified at GUI scale: check a frame | [#animation-and-effects](#animation-and-effects) |
| `css.blur-anim` | css | warn: blur on animated content re-blurs every frame, about eight times the cost | [#animation-and-effects](#animation-and-effects) |
| `css.auto-fill` | css | warn: auto-fill minmax tracks are mis-sized: use flex-wrap | [#layout](#layout) |
| `css.flex-percent` | css | warn: a percentage width inside a flex row can collapse: use fixed px | [#layout](#layout) |
| `css.button-display` | css | warn: flex and grid on a &lt;button> are ignored: use div role="button" | [#layout](#layout) |
| `js.waapi` | js | error: no Web Animations API: use CSS keyframes or a transition | [#animation-and-effects](#animation-and-effects) |
| `js.motion-mini` | js | error: WAAPI-only and svg-renderer libraries do nothing here: use the canvas renderer | [#animation-and-effects](#animation-and-effects) |
| `js.mouseenter` | js, html | warn: mouseenter does not fire for the synthetic pointer: use mouseover | [#timing-and-input](#timing-and-input) |
| `js.clipboard` | js | error: no clipboard API: the editor path is editor.clipboard.get and editor.clipboard.set | [#timing-and-input](#timing-and-input) |
| `js.exec-command` | js | error: document.execCommand does not exist in servo 0.5 | [#timing-and-input](#timing-and-input) |
| `js.composition` | js, html | warn: no IME composition events: CJK text is typed outside the game | [#timing-and-input](#timing-and-input) |
| `js.idle` | js | error: requestIdleCallback is missing: use a timeout | [#timing-and-input](#timing-and-input) |
| `js.caret-point` | js | error: no pixel to text offset API: a caret cannot be placed from a click by hand | [#timing-and-input](#timing-and-input) |
| `js.range-rects` | js | warn: a sub-node Range returns an empty rect list: measure the whole element | [#timing-and-input](#timing-and-input) |
| `js.worker` | js | warn: the Worker constructor exists but end to end is unproved: keep a main thread path | [#timing-and-input](#timing-and-input) |
| `js.raf-counter` | js | warn: rAF runs at a fixed 125 Hz: animate against elapsed time, never per frame | [#timing-and-input](#timing-and-input) |
| `js.net` | js | error: net:fetch and net:ws are on the NEVER set: read game data as topics | [#checklist-before-picking-a-library](#checklist-before-picking-a-library) |
| `js.svg-attr` | js | warn: an inline &lt;svg> does not update after insertion: replace the whole node | [#animation-and-effects](#animation-and-effects) |
| `html.video` | html | warn: &lt;video> plays only in the media native: give it a poster for the default one | [#media](#media) |
| `html.button-layout` | html | warn: a flex or grid class on a &lt;button> is ignored: use div role="button" | [#layout](#layout) |
| `html.form-control` | html | warn: a native form control keeps its default look: appearance does nothing | [#unimplemented-properties](#unimplemented-properties) |
<!-- quirks:end -->
