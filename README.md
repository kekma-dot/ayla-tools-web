<p>
  <img src="assets/banner.png" alt="ayla-tools-web" width="1100">
</p>

# ayla-tools-web

Web search, URL fetching, GitHub cloning, PDF extraction, YouTube video
understanding and local video analysis for the [Pi](https://pi.dev) coding agent.

[Русский](README.ru.md) · [Ayla tools family](https://github.com/kekma-dot/ayla-tools) · [MIT](LICENSE)

A maintained fork of [pi-web-access](https://github.com/nicobailon/pi-web-access)
by Nico Bailon. See [License](#license).

## Install

Requirements: Pi 1.3.0, Node.js >= 22.19.

```bash
pi install git:github.com/kekma-dot/ayla-tools-web
```

The bounded `browse` tool is a separate package that reads documents through this
one:

```bash
pi install git:github.com/kekma-dot/ayla-tools-browse
```

Reload the session:

```
/reload
```

`browse` reads documents through `web_document`, which the engine registers only
with snapshots on. Merge this key into `~/.pi/agent/web-search.json` (or
`$PI_CODING_AGENT_DIR/web-search.json`) without replacing your settings, then
reload again:

```json
{
  "documentSnapshots": true
}
```

A clean install needs no keys: public page fetching works keyless, and zero-config
search uses Exa's keyless MCP endpoint, which handles HTTP queries only. That
endpoint is an external service, so its availability and rate limits are outside
this repository. Subscription providers reuse a ChatGPT/Codex or Kimi Code Plan
login only when you are signed in inside Pi. Add a key when you want a different
provider, see [Search backends](#search-backends).

Pi 1.3.0 is the tested baseline. Newer Pi releases need re-verification.

## Tools

| Tool | What it does |
| --- | --- |
| `web_search` | Source-linked results or a provider answer; results are stored for later retrieval. |
| `fetch_content` | Fetch and extract URLs (readable, raw, or answered); GitHub URLs are cloned, not scraped. |
| `get_search_content` | Bounded paging and `findText` over stored search or fetch results. |
| `source_check` | Evidence artifact with passage-level citations for a claim. |
| `web_document` | Immutable document snapshots (contract v1), codemode-only, registered when `documentSnapshots` is `true`. |
| `web_enable` | Activates the web tools on demand; registered when `toolActivation` is `"auto"` or `"dynamic"`. |

Tool names are configurable, see [Tools and commands](#tools-and-commands).

## Configuration

One JSON file: `~/.pi/agent/web-search.json`. Resolution order is
`$PI_CODING_AGENT_DIR`, then `$XDG_CONFIG_HOME/pi`, then `~/.pi/agent`.

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

`summaryGenerationDeadlineMs` is capped at `600000`; after the deadline a slow
summary model falls back to a deterministic summary.

Provider keys go in the same file (`openaiApiKey`, `braveApiKey`, `exaApiKey`,
`tinyfishApiKey`, ...) or in the matching environment variable. A key may also
be read at request time from a `!command` source, so a secret manager can stay
the only copy. `exaApiKey` is optional: without it, zero-config search goes
through Exa MCP. Jina search uses `jinaApiKey` or `JINA_API_KEY` and queries
`s.jina.ai`; select it with `provider: "jina"`.

### Trust and network

- Redirects, DNS resolution and literal-IP checks go through the SSRF guard.
  Loopback, link-local and private ranges are blocked unless you add
  `ssrf.allowRanges` (for a fake-IP proxy range, for example); the default is
  empty.
- `ssrf.trustEnvProxy` skips only the local DNS preflight for hostnames routed
  through `HTTP(S)_PROXY`; localhost and private literals stay blocked.
- Remote hosted page fetchers (Firecrawl, Crawl4AI, Jina reader, Datalab, Bright
  Data, a custom PDF endpoint) need `fetchRouting.allowRemoteHostedProviders` for
  remote HTTP(S) targets, so page content leaves the machine only when you allow
  it.
- Browser cookies for Gemini Web are opt-in (`PI_ALLOW_BROWSER_COOKIES` or
  config) and are read through the host, never stored in this repository.

## Search backends

Availability is checked at call time. `auto` (default) walks the routing order
and stops at the first configured provider that is healthy. `all` queries only
the eligible providers below; it never spends money on a paid or opt-in backend
unless you name it.

### Eligible for `auto` / `all`

| Provider | Credential | Notes |
| --- | --- | --- |
| `searxng` | `searxngBaseUrl` or `SEARXNG_BASE_URL` | Self-hosted; tried first for private search. |
| `openai` | `openaiApiKey` / `OPENAI_API_KEY`, or ChatGPT/Codex sign-in inside Pi | Optional `openaiResponsesUrl`, `openaiUseProviderBaseUrl`. |
| `exa` | optional `exaApiKey` / `EXA_API_KEY` | Keyless fallback through Exa MCP. |
| `brave` | `braveApiKey` / `BRAVE_API_KEY` | Optional `braveBaseUrl`. |
| `parallel` | `parallelApiKey` / `PARALLEL_API_KEY` | |
| `tinyfish` | `tinyfishApiKey` / `TINYFISH_API_KEY` | |
| `search1api` | `search1apiApiKey` / `SEARCH1API_KEY` | |
| `searchinfinity` | `searchinfinityApiKey` / `SEARCHINFINITY_API_KEY` | |
| `querit` | `queritApiKey` / `QUERIT_API_KEY` | |
| `tavily` | `tavilyApiKey` / `TAVILY_API_KEY` | Optional `tavilyBaseUrl`. |
| `firecrawl` | `firecrawlApiKey` / `FIRECRAWL_API_KEY` | Also a fetch backend; self-hosted `firecrawlBaseUrl` works without a key. |
| `jina` | `jinaApiKey` / `JINA_API_KEY` | Search via `s.jina.ai`; also a reader fetch backend. |
| `serpdive` | `serpdiveApiKey` / `SERPDIVE_API_KEY` | Billed per search, so only used when selected. |
| `kagi` | `kagiApiKey` / `KAGI_API_KEY` | |
| `ollama` | `ollamaApiKey` / `OLLAMA_API_KEY` | |
| `perplexity` | `perplexityApiKey` / `PERPLEXITY_API_KEY` | |
| `gemini` | `geminiApiKey` / `GEMINI_API_KEY`, or Google ADC | Optional `geminiBaseUrl`, Cloudflare AI Gateway key. |
| `bocha` | `bochaApiKey` / `BOCHA_API_KEY` | |

### Explicit-only backends

Pass `provider: "<name>"` yourself; `auto` and `all` never use these.

| Provider | Credential | Notes |
| --- | --- | --- |
| `parallel-mcp` | Parallel account inside Pi | MCP transport. |
| `degoog` | `degoogBaseUrl` / `DEGOOG_URL` (public `https://degoog.org` by default), optional key | Metasearch. |
| `duckduckgo` | none | Keyless, best-effort HTML endpoint. |
| `kimi` | `/login kimi-coding` in Pi | Kimi Code Plan search. |
| `anysearch` | `anysearchApiKey` / `ANYSEARCH_API_KEY` | |
| `xai` | `xaiApiKey` / `XAI_API_KEY` | Grok search. |
| `mistral` | `mistralApiKey` / `MISTRAL_API_KEY` | |
| `brightdata` | `brightdataApiKey` / `BRIGHTDATA_API_KEY` | SERP zone; also an unlocker fetch backend. |
| `serpbase` | `serpbaseApiKey` / `SERPBASE_API_KEY` | |
| `serpapi` | `serpapiApiKey` / `SERPAPI_KEY` | |
| `serper` | `serperApiKey` / `SERPER_API_KEY` | |
| `serply` | `serplyApiKey` / `SERPLY_API_KEY` | |
| `you` | `youApiKey` / `YDC_API_KEY` | |
| `valyu` | `valyuApiKey` / `VALYU_API_KEY` | |
| `baizhi` | `baizhiApiKey` / `BAIZHI_API_KEY` | |
| `zai` | `zaiApiKey` / `ZAI_API_KEY` | |
| `xcrawl` | `xcrawlApiKey` / `XCRAWL_API_KEY` | |
| `keenable` | optional `keenableApiKey` / `KEENABLE_API_KEY` | Keyless tier available. |
| `ceramic` | `ceramicApiKey` / `CERAMIC_API_KEY` | |
| `deepseek` | `deepseekApiKey` / `DEEPSEEK_API_KEY` | Billed per search. |

`searchProvider` (or `provider` per call) may be an array to query several
backends at once. A provider without credentials returns an error instead of
degrading silently. `webSearch.allowedProviders` narrows the whole set, for
example to `["exa", "brave"]`.

## Fetch and extraction

The built-in HTTP path runs first (Readability, Defuddle, linkedom, turndown).
Specialized routes:

- `fetchRouting.providers` is an ordered list such as `["http", "firecrawl",
  "crawl4ai", "jina"]`; each entry has its own base URL and token settings.
- GitHub URLs are cloned through the GitHub API and read as real files.
- PDF text comes from `unpdf`, a Datalab endpoint, or Gemini depending on what is
  configured. Scanned PDFs still need a text layer or an extraction endpoint.
- YouTube: Gemini Web when browser cookies are enabled, then Gemini API, then
  Perplexity. Local video files are transcribed with `yt-dlp`/`ffmpeg` when those
  binaries exist; a missing binary produces a specific error.
- `fetch.defaultMode` is `readable`, `raw` or `answer`; `fetch.allowedModes`
  limits what callers may ask for.

## web_document contract v1

`browse` reads documents through this tool. The payload:

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

Guarantees:

- A snapshot is immutable. Reading it never refetches; a refresh creates a new
  snapshot with a new ref, readable only on the caller's session branch.
- Ranges are exact source offsets, preserved across Unicode and giant-line
  continuation; `findText` matches are bounded and paginated.
- Windows are bounded by `limit` and `maxOutputChars` (1 000 to 30 000 per call).
- Bodies survive freshness expiry. When bounded LRU eviction removes one, the
  reader gets an explicit error instead of partial text.

## Curator and summaries

`.curate` and `/curate` open a local curator page for reviewing results.
`workflow: "summary-review"` prefills it. Use `workflow: "auto-summary"` to
generate a summary without opening the curator:

```json
{ "queries": ["…"], "workflow": "auto-summary" }
```

`summaryModel` picks the drafting model; without it the configured Pi summary
model is used, and a slow or failed draft never blocks the results.

Remote curator sessions print the URL instead of trying to open a browser by default.
In Docker, WSL, SSH, or headless environments, use the printed URL.
Copy it into a browser that can reach the Pi host.

## Tools and commands

Every tool and command can be switched off. `toolNames` can opt into alternate public tool names
when a name collides with another package. Pi restart is required for tool and command registration changes;
`/reload` is not enough for renamed or disabled tools.

```json
{
  "tools": { "sourceCheck": { "enabled": false } },
  "commands": { "curator": { "enabled": false } },
  "toolNames": { "webSearch": "web_search", "fetchContent": "fetch_content" }
}
```

`toolActivation` defaults to `"auto"`: a fresh session whose model supports
mid-conversation tool changes starts with only `web_enable` and gains the web tools
after calling it, while models without that support keep them eagerly and recorded
sessions keep their declared set. `"dynamic"` always starts with just the loader.
`"toolExposure": "deferred"` also keeps the web tools off every request until
`web_enable` runs; it forces dynamic activation and excludes `"eager"`.

## Use from other agents (MCP)

The stdio server ships in `dist/`, so it needs neither Pi nor a build, only its
runtime dependencies:

```bash
npm install --omit=dev      # runtime dependencies for the bundled server
./dist/mcp-cli.js           # stdio MCP server
```

Rebuild `dist/` only after changing the code: `npm install && npm run build`.

## Compatibility

- Pi 1.3.0 public extension API. Older 1.x versions are untested; `web_document`
  needs the public nested-tool API (`ctx.executeTool`).
- Host-provided packages (`@earendil-works/pi-ai`,
  `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`) are
  peers only and never bundled. Runtime dependencies come from `dependencies`,
  which Pi installs for git and npm sources.
- `pi.extensions` points at `./index.ts`, so a git install does not depend on a
  prebuilt bundle; `dist/` is committed and shipped for the MCP server.
- The package is `"private": true` and installed from Git. The npm name
  `pi-web-access` belongs to the upstream project.

## Development

```bash
npm install && npm run typecheck && npm test && npm run build
```

CI runs typecheck, tests and build on Ubuntu and macOS with Node 24. Pi 1.3.0 is
the tested baseline.

## License

MIT. Upstream copyright (c) 2025 Nico Bailon, fork modifications (c) 2026
kekma-dot. See [LICENSE](LICENSE) and [provenance.json](provenance.json).

The standalone MCP bundle includes TypeBox (MIT, Haydn Paterson); its license
ships in [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES). Keep that file with
redistributed bundles. Other dependencies keep their own licenses.
