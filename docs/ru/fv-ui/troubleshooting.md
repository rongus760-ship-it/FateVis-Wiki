# Решение проблем

Один grep покрывает всё:

```txt
grep -E "fvui|fvmenu|fvearly" logs/latest.log
```

## Строки, которые стоит знать

| строка | что значит |
|---|---|
| `fvui: loaded native engine from ...` | какая нативная библиотека загружена, включая dev-переопределение |
| `fvui: native engine unavailable ...` | для этой платформы нативной библиотеки нет, игра работает как ванильная |
| `fvui[menu]: rendering through ... GL context` | путь с общим контекстом поднялся |
| `fvui: engine stopped` | чистое завершение, ожидается прямо перед «Stopping!» |
| `fvui: view menu uses pack <id> <version> (<source>, <root>)` | какой пак победил и откуда он |
| `fvui: pack <file>: <problem>` | проверка отклонила пак, по строке на проблему |
| `fvui: pack <id> for view menu is unknown, invalid or disabled, using <default>` | выбор откатился к штатному |
| `fvui: pack <id> asked for <cap>, which is not declared in its manifest` | добавьте его в `capabilities` |
| `fvui: pack <id> asked for <cap>, which is never granted` | id уровня `never`, работать не будет никогда |
| `fvui[menu]: <id> needs consent from <pack>` | вызов отклонён, запрос согласия в очереди |
| `fvui: pack <id> <what> on view menu (<root>)` | перезагружен, активирован или занял место после падения |
| `fvui[menu]: page crashed: <reason>` | движок сообщил, что документ мёртв |
| `fvui: pack <id> crashed and is disabled until its manifest changes: ...` | он в `disabled` в `packs.json` |
| `fvui[menu]: topic <id> started` / `stopped` | какой экран держит тему живой |
| `fvui: topic <id> failed` | поставщик бросил исключение, со стеком |
| `fvui[menu] console: <message>` | собственные `console.log`, `warn` и `error` страницы |
| `fvui[menu]: bridge call failed` | обработчик бросил исключение без кода, со стеком |
| `fvui: res.need N/M ready at epoch E` | существуют N из M запрошенных ресурсов |
| `fvui: res <path> not found` / `rejected` | опечатка или путь, выходящий из кэша |
| `fvui: res epoch N (M paths)` | перезагрузка ресурсов извлекла всё заново |
| `fvui: store.limit on <key>: ...` | запись в хранилище превысила лимит, файл не изменён |
| `fvui: bad <store.json>, starting empty: ...` | файл правили руками или он обрезан |
| `fvui: WebGL disabled: ...` | WebGL выключен на этот запуск, WebGPU это не затрагивает |
| `fvmenu: loading page over <overlay>, early window on\|off` | какой хост загрузки работал |
| `fvmenu: fv-earlywindow is installed but idle, ...` | `earlyWindowControl = false` в `config/fml.toml` |

## Частые поломки

**Мой пак не подхватывается.** Имя папки должно совпадать с `id` манифеста, а `id` — подходить под
`[a-z0-9_-]{3,64}`. Zip должен называться `<id>.zip`. Затем посмотрите строки проверки `fvui: pack ...`:
отсутствующий файл entry или диапазон `fvui`, не подходящий к установленной версии мода, иначе
пропускают пак молча. `-Dfvui.dev.pack` пропускает проверку имени папки, так что пак, работающий
в dev-запуске, после установки всё ещё может не заработать.

**Страница ничего не показывает или вместо неё штатное меню.** Страница упала при загрузке: ищите
`page crashed` и строки `console:` над ним. Упавший пак отключён в `packs.json`, пока не изменится
его манифест; троньте `fvui.pack.json`, чтобы вернуть его.

**Вызов отклоняется с `capability`, а запрос не появляется.** Этого id нет в списке
`capabilities` манифеста, см. строку `asked for`. Добавьте его — или, во время загрузки, подождите:
там нет экрана, на котором можно спросить.

**Вызов отклоняется с `origin`.** Документ — не страница `fvui://`. Это iframe с другой схемой,
адрес `data:` или dev-сервер без `-Dfvui.bridge.origin`.

**Тема так и не приходит.** На неё никто не подписался: должен выполниться `state.sub`. Ищите
строку `topic ... started`. Кроме того, тиковая тема не считается, пока идёт загрузка модов,
так что странице загрузки нужна push-тема.

**Значение никогда не меняется.** Поставщик каждый раз возвращает один и тот же изменяемый объект,
и сравнение его съедает. Возвращайте свежую копию.

**Правки не видны.** Файловые хосты не шлют заголовков кэширования. Нажмите F6 — он увеличивает `r` в
адресе страницы — и добавляйте этот `r` к относительным ссылкам, которые страница создаёт сама.

**Файл темы ничего не делает.** Это должен быть CSS без слоёв. Блок `@layer` проигрывает пресетам,
а подключается файл, только если манифест называет его в `theme` или страница подключает его сама.

**CSS-правило вообще ничего не делает.** Скорее всего, в нём есть `:has()`, который отбрасывает всё правило, или
нереализованное свойство. [Матрица поддержки Servo](/ru/fv-ui/servo).

**Картинки или видео не появляются.** Текстурам игры нужен `res.need`, внешние адреса недоступны,
а для `<video>` нужна нативная библиотека, собранная с медиа-опцией.

**Ошибка GL при выходе.** Это баг, а не шум. Запустите с `-PglTrace=true`, чтобы получить Java-стек
каждой ошибки GL.

## Где лежат файлы

| путь | что это |
|---|---|
| `<gamedir>/fvui/packs/<id>/` | пак |
| `<gamedir>/fvui/packs/<id>.zip` | пак в архиве |
| `<gamedir>/fvui/packs.json` | активный пак по видам, разрешения, отключённые паки |
| `<gamedir>/fvui_data/<id>/store.json` | собственные данные пака |
| `<gamedir>/config/fvmenu-skins.json` | каким экранам можно ставить скин |
| `<gamedir>/config/fml.toml` | `earlyWindowControl` для jar раннего окна |
| `<gamedir>/.fvui/web/` | штатный пак, распакованный из jar |
| `<gamedir>/.fvui/natives/<platform>/<stamp>/` | извлечённый нативный движок |
| `<gamedir>/.fvui/cache/packs/<id>-<stamp>/` | распакованный zip-пак |
| `<gamedir>/.fvui/cache/res/<epoch>/` | кэш ресурсов за `fvui://res/` |
| `<gamedir>/logs/latest.log` | всё перечисленное выше |

Удаление `.fvui` сбрасывает все извлечённые файлы и кэши. `fvui/packs.json` и
`fvui_data/` оно не трогает.

## Что приложить к баг-репорту

`logs/latest.log` и `logs/debug.log`, `crash-reports/`, любые `hs_err_pid*.log`, модель видеокарты и
версию драйвера, скриншот. Самые полезные строки —
`fvui: loaded native engine from ...`, `fvui: view menu uses pack ...`,
`fvmenu: loading page over ...` и то, появилась ли при выходе `fvui: engine stopped`.
