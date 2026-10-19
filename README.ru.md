<p>
  <img src="assets/banner.png" alt="ayla-tools-web" width="1100">
</p>

# ayla-tools-web

Веб-поиск, загрузка URL, клонирование GitHub-репозиториев, извлечение PDF, разбор
YouTube-видео и анализ локальных видео для кодинг-агента [Pi](https://pi.dev).

[English](README.md) · [Семейство Ayla tools](https://github.com/kekma-dot/ayla-tools) · [MIT](LICENSE)

Поддерживаемый форк [pi-web-access](https://github.com/nicobailon/pi-web-access) за
авторством Nico Bailon. См. [Лицензия](#лицензия).

## Установка

Требования: Pi 1.3.0, Node.js >= 22.19.

```bash
pi install git:github.com/kekma-dot/ayla-tools-web
```

Ограниченный инструмент `browse` поставляется отдельным пакетом и читает
документы через этот:

```bash
pi install git:github.com/kekma-dot/ayla-tools-browse
```

Затем перезагрузите сессию:

```
/reload
```

`browse` читает документы через `web_document`, а движок регистрирует его
только при включённых снимках. Добавьте ключ в `~/.pi/agent/web-search.json` (или
`$PI_CODING_AGENT_DIR/web-search.json`), не заменяя текущие настройки, и
перезагрузите снова:

```json
{
  "documentSnapshots": true
}
```

Чистой установке ключи не нужны. Прямая загрузка публичных страниц работает без
ключа, а zero-config поиск идёт через бесключевой MCP-эндпоинт Exa, который
обслуживает только HTTP-запросы; это внешний сервис, его доступность и лимиты вне
этого репозитория. Провайдеры по подписке переиспользуют вход ChatGPT/Codex или
Kimi Code Plan только если вы уже вошли в аккаунт внутри Pi. Ключ нужен, если вы
выбрали другого провайдера, см. [Поисковые бэкенды](#поисковые-бэкенды).

Pi 1.3.0: проверенная базовая версия. Более новые выпуски Pi требуют повторной
проверки.

## Инструменты

| Инструмент | Что делает |
| --- | --- |
| `web_search` | Результаты со ссылками на источники или ответ провайдера; результаты сохраняются для последующего чтения. |
| `fetch_content` | Загрузка и извлечение URL (readable, raw или answer); GitHub-URL клонируются, а не скрейпятся. |
| `get_search_content` | Ограниченное постраничное чтение и `findText` по сохранённым результатам. |
| `source_check` | Артефакт доказательств с посегментными цитатами для утверждения. |
| `web_document` | Неизменяемые снимки документов (контракт v1), только для codemode, регистрируется при `documentSnapshots: true`. |
| `web_enable` | Активирует веб-инструменты по требованию; регистрируется при `toolActivation` `"auto"` или `"dynamic"`. |

Имена инструментов настраиваются, см. [Инструменты и команды](#инструменты-и-команды).

## Конфигурация

Один JSON-файл: `~/.pi/agent/web-search.json`. Порядок поиска:
`$PI_CODING_AGENT_DIR`, затем `$XDG_CONFIG_HOME/pi`, затем `~/.pi/agent`.

```json
{
  "searchProvider": "auto",
  "documentSnapshots": true,
  "maxInlineContentChars": 30000,
  "fetch": { "defaultMode": "readable", "allowedModes": ["readable", "raw", "answer"] },
  "tools": { "webSearch": { "enabled": true }, "fetchContent": { "enabled": true },
             "getSearchContent": { "enabled": true }, "sourceCheck": { "enabled": true } },
  "commands": { "websearch": { "enabled": true }, "curator": { "enabled": true },
                "search": { "enabled": true }, "google-account": { "enabled": true } },
  "summaryGenerationDeadlineMs": 30000
}
```

`summaryGenerationDeadlineMs` ограничен `600000`; после дедлайна медленная модель
суммаризации заменяется детерминированной сводкой.

Ключи провайдеров кладутся в тот же файл (`openaiApiKey`, `braveApiKey`,
`exaApiKey`, `tinyfishApiKey`, ...) или в соответствующую переменную окружения.
Ключ может читаться на момент запроса из источника `!command`, так что секрет
может оставаться только в менеджере секретов. `exaApiKey` необязателен: без него
zero-config поиск идёт через Exa MCP. Для Jina задайте `jinaApiKey` или
`JINA_API_KEY`, запросы идут на `s.jina.ai`, выбор: `provider: "jina"`.

### Доверие и сеть

- Редиректы, DNS и проверки литеральных IP проходят через SSRF-защиту. Loopback,
  link-local и приватные диапазоны заблокированы, если вы не добавите
  `ssrf.allowRanges` (например, для диапазона fake-IP прокси); по умолчанию
  список пуст.
- `ssrf.trustEnvProxy` пропускает только локальную DNS-проверку для хостов,
  идущих через `HTTP(S)_PROXY`; localhost и приватные литералы остаются
  заблокированными.
- Удалённым хостинговым загрузчикам (Firecrawl, Crawl4AI, Jina reader, Datalab,
  Bright Data, собственный PDF-эндпоинт) нужен
  `fetchRouting.allowRemoteHostedProviders` для внешних HTTP(S)-целей, поэтому
  содержимое страниц уходит с машины только с вашего разрешения.
- Cookie браузера для Gemini Web включаются отдельно (`PI_ALLOW_BROWSER_COOKIES`
  или конфиг) и читаются через хост, а не хранятся в этом репозитории.

## Поисковые бэкенды

Доступность проверяется во время вызова. `auto` (по умолчанию) идёт по порядку
маршрутизации и останавливается на первом настроенном и рабочем провайдере. `all`
опрашивает только eligible-провайдеров ниже: платный или opt-in бэкенд не
тратится без явного указания.

### Доступны для `auto` / `all`

| Провайдер | Учётные данные | Примечания |
| --- | --- | --- |
| `searxng` | `searxngBaseUrl` или `SEARXNG_BASE_URL` | Свой инстанс; пробуется первым для приватного поиска. |
| `openai` | `openaiApiKey` / `OPENAI_API_KEY` либо вход ChatGPT/Codex в Pi | Опционально `openaiResponsesUrl`, `openaiUseProviderBaseUrl`. |
| `exa` | опционально `exaApiKey` / `EXA_API_KEY` | Без ключа работает через Exa MCP. |
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

Укажите `provider: "<name>"` сами: `auto` и `all` их не используют.

| Провайдер | Учётные данные | Примечания |
| --- | --- | --- |
| `parallel-mcp` | аккаунт Parallel внутри Pi | MCP-транспорт. |
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
сразу по нескольким бэкендам. Провайдер без учётных данных возвращает ошибку, а не
деградирует молча. `webSearch.allowedProviders` сужает весь набор, например до
`["exa", "brave"]`.

## Загрузка и извлечение

Сначала работает встроенный HTTP-путь (Readability, Defuddle, linkedom, turndown).
Специализированные маршруты:

- `fetchRouting.providers` задаёт упорядоченный список вроде `["http", "firecrawl",
  "crawl4ai", "jina"]`; у каждого свои base URL и токены.
- GitHub-URL клонируются через GitHub API и читаются как настоящие файлы.
- Текст PDF берётся из `unpdf`, эндпоинта Datalab или Gemini в зависимости от
  настроек. Сканам всё равно нужен текстовый слой или эндпоинт извлечения.
- YouTube: Gemini Web при включённых cookie браузера, затем Gemini API, затем
  Perplexity. Локальные видео распознаются через `yt-dlp`/`ffmpeg`, если эти
  бинарники есть; их отсутствие даёт конкретную ошибку.
- `fetch.defaultMode` принимает `readable`, `raw` или `answer`; `fetch.allowedModes`
  ограничивает то, что можно запросить.

## Контракт web_document v1

`browse` читает документы через этот инструмент. Ответ:

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
- Диапазоны заданы точными смещениями в исходнике и сохраняются на Unicode и переносе
  гигантских строк; совпадения `findText` ограничены и постраничны.
- Окна ограничены `limit` и `maxOutputChars` (от 1 000 до 30 000 на вызов).
- Тела снимков переживают истечение freshness. Когда ограниченное LRU-вытеснение
  удаляет тело, читатель получает явную ошибку, а не частичный текст.

## Curator и суммаризация

`.curate` и `/curate` открывают локальную страницу curator-а для просмотра
результатов. `workflow: "summary-review"` заполняет её заранее, а
`workflow: "auto-summary"` генерирует сводку без открытия страницы. Оба режима
указываются в вызове:

```json
{ "queries": ["…"], "workflow": "auto-summary" }
```

`summaryModel` выбирает модель для черновика; без него используется настроенная
модель суммаризации Pi. Медленный или упавший черновик не блокирует результаты
поиска.

Удалённые сессии curator-а печатают URL вместо открытия браузера: это нужно в
Docker, WSL, SSH и на headless-хостах. Откройте URL в браузере, у которого есть
доступ к хосту Pi.

## Инструменты и команды

Каждый инструмент и команду можно отключить. `toolNames` переводит инструмент на
другое публичное имя, если оно конфликтует с другим пакетом. Изменения
регистрации требуют перезапуска Pi; `/reload` недостаточно для переименованных или
отключённых инструментов.

```json
{
  "tools": { "sourceCheck": { "enabled": false } },
  "commands": { "curator": { "enabled": false } },
  "toolNames": { "webSearch": "web_search", "fetchContent": "fetch_content" }
}
```

`toolActivation` по умолчанию `"auto"`: свежая сессия с моделью, которая умеет
менять инструменты в середине диалога, начинается только с `web_enable` и получает
веб-инструменты после его вызова. Модели без такой поддержки получают инструменты
сразу, записанные сессии сохраняют объявленный набор. `"dynamic"` всегда
начинается только с загрузчика. `"toolExposure": "deferred"` дополнительно держит
веб-инструменты вне каждого запроса, пока не сработает `web_enable`; он
принудительно включает dynamic-активацию и несовместим с
`"toolActivation": "eager"`.

## Использование из других агентов (MCP)

stdio-сервер уже лежит в `dist/`, поэтому Pi и сборка не нужны, требуются только
runtime-зависимости:

```bash
npm install --omit=dev      # runtime-зависимости для готового сервера
./dist/mcp-cli.js           # stdio MCP-сервер
```

Пересобирайте `dist/` только после изменения кода:

```bash
npm install && npm run build
```

## Совместимость

- Публичный API расширений Pi 1.3.0. Более старые версии 1.x не проверялись;
  `web_document` требует публичного API вложенных инструментов
  (`ctx.executeTool`).
- Пакеты хоста (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`,
  `@earendil-works/pi-tui`, `typebox`) объявлены только как peers и не бандлятся.
  Runtime-зависимости лежат в `dependencies`, Pi ставит их для git- и
  npm-источников.
- `pi.extensions` указывает на TypeScript-исходник (`./index.ts`), поэтому
  git-установка не зависит от предсобранного бандла. `dist/` при этом закоммичен и
  поставляется для MCP-сервера.
- Пакет помечен `"private": true` и ставится из Git. Имя `pi-web-access` в npm
  принадлежит upstream-проекту.

## Разработка

```bash
npm install && npm run typecheck && npm test && npm run build
```

CI прогоняет typecheck, тесты и сборку на Ubuntu и macOS с Node 24. Pi 1.3.0
проверен как базовая версия.

## Лицензия

MIT. Копирайт upstream (c) 2025 Nico Bailon, изменения форка (c) 2026 kekma-dot.
См. [LICENSE](LICENSE) и [provenance.json](provenance.json).

Standalone MCP-бандл включает TypeBox (MIT, Haydn Paterson); его лицензия
поставляется в [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES). Сохраняйте этот файл
при распространении бандлов. Остальные зависимости сохраняют свои лицензии.
