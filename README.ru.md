<p>
  <img src="assets/banner.png" alt="ayla-tools-web" width="1100">
</p>

# ayla-tools-web

Веб-поиск, загрузка URL, клонирование GitHub-репозиториев, извлечение PDF, разбор
YouTube-видео и анализ локальных видео для кодинг-агента [Pi](https://pi.dev)
**1.3.0**. Пакет подготовлен для самостоятельной установки.

[English](README.md) · [Семейство Ayla tools](https://github.com/kekma-dot/ayla-tools) · [MIT](LICENSE)

## Что это за репозиторий

`ayla-tools-web` — **поддерживаемый форк**
[pi-web-access](https://github.com/nicobailon/pi-web-access) за авторством
**Nico Bailon** (MIT). Это *не* оригинальный проект и не аффилированная с ним
сборка.

Изменения форка аддитивные и не зависят от чьего-либо профиля: контракт
`web_document` v1 для ограниченных неизменяемых снимков, границы хранения
снимков, усиление SSRF-защиты для удалённых загрузчиков и удаление авторских
runbook-ов, путей и предположений о профиле. Копирайт и лицензия upstream
сохранены дословно в [LICENSE](LICENSE); происхождение форка в машинночитаемом
виде — в [provenance.json](provenance.json).

В пакете **нет интеграции AGY или Antigravity**. Он не ищет внешние агентские
CLI, не запускает их и не требует их наличия.

## Быстрый старт

Требования: Pi **1.3.0** — проверенная базовая версия; более новые выпуски Pi
требуют повторной проверки — и Node.js **>= 22.19**. Больше ничего: ни личного
профиля Pi, ни конфигов с другой машины.

```bash
pi install git:github.com/kekma-dot/ayla-tools-web
```

Если нужен ещё и ограниченный инструмент `browse` (он работает поверх этих
инструментов и требует `web_document`), установите парный пакет:

```bash
pi install git:github.com/kekma-dot/ayla-tools-browse
```

Перезагрузите сессию, чтобы Pi подхватил пакет:

```
/reload
```

Чистой установке **ключи не нужны для старта**: прямая загрузка публичных
страниц работает без ключа, а zero-config поиск идёт через бесключевой
MCP-эндпоинт Exa (запросы только по HTTP) — внешний сервис, чью доступность и
лимиты этот репозиторий вживую не проверял. Провайдеры по подписке переиспользуют
вход ChatGPT/Codex или Kimi Code Plan только если вы действительно вошли в
аккаунт внутри Pi. Ключ провайдера добавляется только если вы выбрали этого
провайдера — см. [Поисковые бэкенды](#поисковые-бэкенды).

Для пакета `browse` один раз включите снимки:

```json
{
  "documentSnapshots": true
}
```

Положите это в `~/.pi/agent/web-search.json` (стандартный каталог агента Pi, либо
`$PI_CODING_AGENT_DIR`, если он задан). Если файл уже существует, добавьте ключ к
текущим настройкам, а не заменяйте файл. Затем снова выполните `/reload`.

## Инструменты

| Инструмент | Что делает |
| --- | --- |
| `web_search` | Поиск со ссылками на источники или ответ провайдера; результаты сохраняются для последующего чтения. |
| `fetch_content` | Загрузка и извлечение одного или нескольких URL (readable, raw или answer); GitHub-URL клонируются, а не скрейпятся. |
| `get_search_content` | Ограниченное постраничное чтение и `findText` по сохранённым результатам поиска и загрузки. |
| `source_check` | Артефакт доказательств с посегментными цитатами для утверждения. |
| `web_document` | Чтение неизменяемого снимка документа (контракт `browse` **v1**), только для codemode, регистрируется при `documentSnapshots: true`. |
| `web_enable` | Загрузчик, активирующий веб-инструменты по требованию; регистрируется при `toolActivation` `"auto"` или `"dynamic"` (но не `"eager"`), включая любой deferred-режим. |

Публичные имена инструментов настраиваются — см. [Инструменты и команды](#инструменты-и-команды).

## Конфигурация

Все настройки лежат в одном JSON-файле `~/.pi/agent/web-search.json`. Порядок
поиска: `$PI_CODING_AGENT_DIR`, затем `$XDG_CONFIG_HOME/pi`, затем
`~/.pi/agent`. Пакет не читает машинно-зависимых путей и чужого профиля.

```json
{
  "searchProvider": "auto",
  "documentSnapshots": true,
  "maxInlineContentChars": 30000,
  "fetch": { "defaultMode": "readable", "allowedModes": ["readable", "raw", "answer"] },
  "tools": {
    "webSearch": { "enabled": true },
    "fetchContent": { "enabled": true },
    "getSearchContent": { "enabled": true },
    "sourceCheck": { "enabled": true }
  },
  "commands": {
    "websearch": { "enabled": true },
    "curator": { "enabled": true },
    "search": { "enabled": true },
    "google-account": { "enabled": true }
  },
  "summaryGenerationDeadlineMs": 30000
}
```

`summaryGenerationDeadlineMs` ограничен значением `600000` (десять минут); если
модель суммаризации не успевает, после дедлайна возвращается детерминированная
сводка.

Ключи провайдеров кладутся в тот же файл (`openaiApiKey`, `braveApiKey`,
`exaApiKey`, `tinyfishApiKey`, …) или в соответствующую переменную окружения.
Ключ может читаться на момент запроса из источника `!command`, так что секрет
может оставаться только в менеджере секретов. `exaApiKey` необязателен: без него
zero-config поиск идёт через Exa MCP. Для поиска Jina задайте `jinaApiKey` или
`JINA_API_KEY`; запросы идут на `s.jina.ai`. Выбор бэкенда — `provider: "jina"`.

### Доверие и сеть

- Редиректы, DNS и проверки литеральных IP проходят через SSRF-защиту. Loopback,
  link-local и приватные диапазоны заблокированы, если вы намеренно не добавите
  `ssrf.allowRanges` (например, для диапазона fake-IP прокси) — по умолчанию
  список пуст.
- `ssrf.trustEnvProxy` пропускает только локальную DNS-проверку для хостов,
  идущих через `HTTP(S)_PROXY`; localhost и приватные литералы остаются
  заблокированными.
- Удалённые хостинговые загрузчики (Firecrawl, Crawl4AI, Jina reader, Datalab,
  Bright Data, собственный PDF-эндпоинт) требуют
  `fetchRouting.allowRemoteHostedProviders` для внешних HTTP(S)-целей.
- Доступ к cookie браузера для Gemini Web включается отдельно
  (`PI_ALLOW_BROWSER_COOKIES` или конфиг) и читает cookie через хост, а не из
  этого репозитория.

## Поисковые бэкенды

Доступность провайдера проверяется во время вызова. `auto` (по умолчанию) идёт по
порядку маршрутизации и останавливается на первом настроенном и рабочем
провайдере. `all` опрашивает только *eligible*-провайдеров ниже — он никогда не
тратит деньги на платный или opt-in бэкенд без явного указания.

### Доступны для `auto` / `all`

| Провайдер | Учётные данные | Примечания |
| --- | --- | --- |
| `searxng` | `searxngBaseUrl` или `SEARXNG_BASE_URL` | Собственный инстанс; пробуется первым для приватного поиска. |
| `openai` | `openaiApiKey` / `OPENAI_API_KEY` либо вход ChatGPT/Codex в Pi | Опционально `openaiResponsesUrl`, `openaiUseProviderBaseUrl`. |
| `exa` | опционально `exaApiKey` / `EXA_API_KEY` | Без ключа — через Exa MCP. |
| `brave` | `braveApiKey` / `BRAVE_API_KEY` | Опционально `braveBaseUrl`. |
| `parallel` | `parallelApiKey` / `PARALLEL_API_KEY` | |
| `tinyfish` | `tinyfishApiKey` / `TINYFISH_API_KEY` | |
| `search1api` | `search1apiApiKey` / `SEARCH1API_KEY` | |
| `searchinfinity` | `searchinfinityApiKey` / `SEARCHINFINITY_API_KEY` | |
| `querit` | `queritApiKey` / `QUERIT_API_KEY` | |
| `tavily` | `tavilyApiKey` / `TAVILY_API_KEY` | Опционально `tavilyBaseUrl`. |
| `firecrawl` | `firecrawlApiKey` / `FIRECRAWL_API_KEY` | Ещё и загрузчик; свой `firecrawlBaseUrl` работает без ключа. |
| `jina` | `jinaApiKey` / `JINA_API_KEY` | Поиск через `s.jina.ai`; ещё и reader-загрузчик. |
| `serpdive` | `serpdiveApiKey` / `SERPDIVE_API_KEY` | Платный за запрос, поэтому только при явном выборе. |
| `kagi` | `kagiApiKey` / `KAGI_API_KEY` | |
| `ollama` | `ollamaApiKey` / `OLLAMA_API_KEY` | |
| `perplexity` | `perplexityApiKey` / `PERPLEXITY_API_KEY` | |
| `gemini` | `geminiApiKey` / `GEMINI_API_KEY` либо Google ADC | Опционально `geminiBaseUrl`, ключ Cloudflare AI Gateway. |
| `bocha` | `bochaApiKey` / `BOCHA_API_KEY` | |

### Только явный выбор

Эти бэкенды никогда не используются через `auto` или `all`; укажите
`provider: "<name>"` сами.

| Провайдер | Учётные данные | Примечания |
| --- | --- | --- |
| `parallel-mcp` | аккаунт Parallel внутри Pi | MCP-транспорт, только явно. |
| `degoog` | `degoogBaseUrl` / `DEGOOG_URL` (по умолчанию публичный `https://degoog.org`), опционально ключ | Метапоиск. |
| `duckduckgo` | нет | Без ключа, best-effort HTML. |
| `kimi` | `/login kimi-coding` в Pi | Поиск Kimi Code Plan. |
| `anysearch` | `anysearchApiKey` / `ANYSEARCH_API_KEY` | |
| `xai` | `xaiApiKey` / `XAI_API_KEY` | Поиск Grok. |
| `mistral` | `mistralApiKey` / `MISTRAL_API_KEY` | |
| `brightdata` | `brightdataApiKey` / `BRIGHTDATA_API_KEY` | SERP-зона; ещё и unlocker-загрузчик. |
| `serpbase` | `serpbaseApiKey` / `SERPBASE_API_KEY` | |
| `serpapi` | `serpapiApiKey` / `SERPAPI_KEY` | |
| `serper` | `serperApiKey` / `SERPER_API_KEY` | |
| `serply` | `serplyApiKey` / `SERPLY_API_KEY` | |
| `you` | `youApiKey` / `YDC_API_KEY` | |
| `valyu` | `valyuApiKey` / `VALYU_API_KEY` | |
| `baizhi` | `baizhiApiKey` / `BAIZHI_API_KEY` | |
| `zai` | `zaiApiKey` / `ZAI_API_KEY` | |
| `xcrawl` | `xcrawlApiKey` / `XCRAWL_API_KEY` | |
| `keenable` | опционально `keenableApiKey` / `KEENABLE_API_KEY` | Есть tier без ключа. |
| `ceramic` | `ceramicApiKey` / `CERAMIC_API_KEY` | |
| `deepseek` | `deepseekApiKey` / `DEEPSEEK_API_KEY` | Платный за запрос. |

`searchProvider` (или `provider` в вызове) может быть массивом имён, чтобы искать
сразу по нескольким бэкендам. Провайдер без учётных данных возвращает ошибку, а
не тихо деградирует. `webSearch.allowedProviders` сужает весь набор, например до
`["exa", "brave"]`.

## Загрузка и извлечение

Сначала используется встроенный HTTP-путь (Readability, Defuddle, linkedom,
turndown). Специализированные маршруты:

- `fetchRouting.providers` — упорядоченный список вроде `["http", "firecrawl",
  "crawl4ai", "jina"]`; у каждого свои base URL и токены.
- GitHub-URL клонируются через GitHub API и читаются как настоящие файлы.
- Текст PDF берётся из `unpdf`, эндпоинта Datalab или Gemini — в зависимости от
  настроек; сканам всё равно нужен текстовый слой или эндпоинт извлечения.
- YouTube: Gemini Web при включённых cookie браузера, затем Gemini API, затем
  Perplexity. Локальные видео распознаются через `yt-dlp`/`ffmpeg`, если эти
  бинарники есть; их отсутствие даёт конкретную ошибку, а не тихий `null`.
- `fetch.defaultMode` — `readable` | `raw` | `answer`; `fetch.allowedModes`
  ограничивает то, что можно запросить.

## Контракт web_document v1

Парный пакет `browse` читает документы через `web_document`. Контракт намеренно
маленький и стабильный:

```json
{
  "contractVersion": 1,
  "ref": "d:<responseId>:<urlIndex>",
  "lines": [{ "number": 1, "start": 0, "end": 42, "text": "…" }],
  "links": [{ "id": 1, "url": "https://…" }],
  "nextLine": 2,
  "nextOffset": 42,
  "outputTruncated": false
}
```

Гарантии:

- Снимок неизменяем. Чтение никогда не перезагружает страницу; refresh создаёт
  новый снимок с новым ref.
- Ref читается только если его результат есть в ветке сессии вызывающего.
- Диапазоны — точные смещения в исходнике, сохраняются на Unicode и переносе
  гигантских строк; совпадения `findText` ограничены и постраничны.
- Окна ограничены `limit` и `maxOutputChars` (1 000–30 000 на вызов).
- Тела снимков переживают истечение freshness, а ограниченное LRU-вытеснение
  заменяет тело явной ошибкой, а не частичным текстом.
- Для регистрации `web_document` нужно `documentSnapshots: true`.

## Curator и суммаризация

`.curate`/`/curate` открывает локальную страницу curator-а для просмотра
результатов; `workflow: "summary-review"` заполняет её заранее, а
`workflow: "auto-summary"` генерирует сводку без открытия curator-а. Оба режима
указываются явно в вызове:

```json
{ "queries": ["…"], "workflow": "auto-summary" }
```

`summaryModel` выбирает модель для черновика; если он не задан, используется
настроенная модель суммаризации Pi. Медленный или упавший черновик никогда не
блокирует результаты поиска.

Удалённые сессии curator-а по умолчанию печатают URL вместо попытки открыть
браузер — это то, что нужно в Docker, WSL, SSH или headless-окружениях. Скопируйте
URL в браузер, у которого есть доступ к хосту Pi.

## Инструменты и команды

Каждый инструмент и команду можно отключить отдельно; `toolNames` позволяет
перейти на альтернативные публичные имена, если они конфликтуют с другим пакетом.
Для изменений регистрации инструментов и команд требуется перезапуск Pi (`/reload`
недостаточно для переименованных или отключённых инструментов).

```json
{
  "tools": { "sourceCheck": { "enabled": false } },
  "commands": { "curator": { "enabled": false } },
  "toolNames": { "webSearch": "web_search", "fetchContent": "fetch_content" }
}
```

`toolActivation` по умолчанию `"auto"`: свежая сессия с моделью, поддерживающей
изменение инструментов в середине диалога, начинается только с `web_enable`, и
веб-инструменты появляются после его вызова; модели без такой поддержки получают
инструменты сразу, а записанные сессии сохраняют объявленный набор. `"dynamic"`
всегда начинается только с загрузчика. `"toolExposure": "deferred"` дополнительно
держит веб-инструменты вне каждого запроса, пока не сработает `web_enable`, — он
принудительно включает dynamic-активацию и несовместим с
`"toolActivation": "eager"`.

## Использование из других агентов (MCP)

Те же инструменты поиска и загрузки работают как локальный MCP-сервер для Claude
Code, Codex, Cursor и других MCP-клиентов. Готовый stdio-сервер уже лежит в
`dist/`, поэтому Pi и сборка не нужны — только runtime-зависимости:

```bash
npm install --omit=dev      # runtime-зависимости для готового сервера
./dist/mcp-cli.js           # stdio MCP-сервер
```

`dist/` закоммичен и синхронизирован с исходниками. Пересобирать нужно только
после изменения кода:

```bash
npm install && npm run build   # dist/index.js и dist/mcp-cli.js
```

## Совместимость

- Публичный API расширений Pi **1.3.0**. Более старые версии 1.x не проверялись;
  `web_document` требует публичного API вложенных инструментов
  (`ctx.executeTool`).
- Пакеты, которые предоставляет хост (`@earendil-works/pi-ai`,
  `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`),
  объявлены **только как peers** и не бандлятся, поэтому расширение не может
  загрузить дубликат реестра классов.
- Runtime-зависимости объявлены в `dependencies`; Pi ставит их для git- и
  npm-источников.
- `pi.extensions` указывает на TypeScript-исходник (`./index.ts`), поэтому
  git-установка не зависит от того, что предсобранный бандл совпадает с
  исходником. Каталог `dist/` при этом коммитится и поставляется в пакете: MCP-
  сервер работает сразу после установки runtime-зависимостей.
- Разрешённый список файлов пакета (`files`) покрывает `dist`, исходники,
  README, `assets`, `LICENSE`, `provenance.json`, `CHANGELOG.md`, `SECURITY.md`;
  тесты, скрипты и evidence в пакет не попадают.
- Пакет помечен `"private": true` и ставится из Git. Под этим именем он в npm не
  публикуется; `pi-web-access` в npm — это upstream-проект.

## Разработка

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm test` запускает тест-раннер Node по TypeScript-исходникам и не требует
ключей провайдеров. Сеть нужна только для loopback HTTP-фикстуры
end-to-end проверки `browse` и для проверки установки из упакованного tarball,
которая тянет production-зависимости из npm-реестра. CI прогоняет typecheck,
тесты и сборку на Ubuntu и macOS с Node 24.

Release-гейты этого пакета, запускаются из этого каталога:

```bash
npm run verify:install   # pack, только production-зависимости, загрузка через загрузчик Pi 1.3
npm run build            # пересборка dist; проверка воспроизводимости закоммиченного бандла
```

## Лицензия

MIT. Копирайт upstream (c) 2025 **Nico Bailon**; изменения форка (c) 2026
kekma-dot. См. [LICENSE](LICENSE).

Standalone MCP-бандл включает TypeBox (MIT, Haydn Paterson); полный текст его
лицензии поставляется в [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES). Сохраняйте этот
файл при распространении бандлов. Установленные зависимости сохраняют свои лицензии.
