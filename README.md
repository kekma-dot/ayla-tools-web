<p>
  <img src="assets/banner.png" alt="ayla-tools-web" width="1100">
</p>

# ayla-tools-web

Web search, URL fetching, GitHub repo cloning, PDF extraction, YouTube video
understanding, and local video analysis for the [Pi](https://pi.dev) coding agent
**1.3.0**, packaged for standalone installation.

[Русский](README.ru.md) · [Ayla tools family](https://github.com/kekma-dot/ayla-tools) · [MIT](LICENSE)

## What this repository is

`ayla-tools-web` is a **maintained fork** of
[pi-web-access](https://github.com/nicobailon/pi-web-access) by **Nico Bailon**
(MIT). It is *not* the original project and not affiliated with it.

Changes in this fork are additive and profile-independent: the `web_document`
contract v1 for bounded immutable snapshots, snapshot-retention bounds, SSRF
hardening around remote fetchers, and removal of any author-specific runbooks,
paths and profile assumptions. Upstream copyright and license are kept verbatim
in [LICENSE](LICENSE); the fork's origin is machine-readable in
[provenance.json](provenance.json).

There is **no AGY or Antigravity integration** in this package. It does not scan
for external agent CLIs, does not shell out to them, and needs no such tool.

## Quickstart

Requirements: Pi **1.3.0** — the tested baseline; newer Pi releases need
re-verification — and Node.js **>= 22.19**. Nothing else: no personal Pi
profile, no config files from another machine.

```bash
pi install git:github.com/kekma-dot/ayla-tools-web
```

If you also want the bounded `browse` tool (it is a thin layer over these tools
and needs `web_document`), install the companion package too:

```bash
pi install git:github.com/kekma-dot/ayla-tools-browse
```

Reload the session so Pi loads the new package:

```
/reload
```

A clean install needs **no keys to start**: direct public-page fetching works
keyless, and zero-config search goes through Exa's keyless MCP endpoint
(HTTP-only queries) — an external service whose availability and rate limits
this repository does not live-qualify. Subscription-backed providers reuse a
ChatGPT/Codex or Kimi Code Plan login only when you are actually signed in
inside Pi. Add a provider key only if you choose that provider — see
[Search backends](#search-backends).

For the `browse` package, add the snapshot switch once:

```json
{
  "documentSnapshots": true
}
```

Put it in `~/.pi/agent/web-search.json` (the standard Pi agent directory, or
`$PI_CODING_AGENT_DIR` when you set one). If the file already exists, merge the
key into your current settings instead of replacing the file. Then `/reload`
again.

## Tools

| Tool | What it does |
| --- | --- |
| `web_search` | Source-linked search results or a provider answer; results are stored for later retrieval. |
| `fetch_content` | Fetch and extract one or more URLs (readable, raw, or answered); GitHub URLs are cloned, not scraped. |
| `get_search_content` | Bounded paging and `findText` over stored search or fetch results. |
| `source_check` | Evidence artifact with passage-level citations for a claim. |
| `web_document` | Immutable document snapshot reader (`browse` contract **v1**), codemode-only, registered when `documentSnapshots` is `true`. |
| `web_enable` | Loader that activates the web tools on demand; registered when `toolActivation` is `"auto"` or `"dynamic"` (never `"eager"`), including every deferred setup. |

Public tool names are configurable — see [Tools and commands](#tools-and-commands).

## Configuration

All settings live in one JSON file, `~/.pi/agent/web-search.json`. Resolution
order: `$PI_CODING_AGENT_DIR`, then `$XDG_CONFIG_HOME/pi`, then `~/.pi/agent`.
Nothing in the package reads a machine-specific path or an author's profile.

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

`summaryGenerationDeadlineMs` is capped at `600000` (ten minutes); a slow summary
model falls back to a deterministic summary after the deadline.

Provider keys go in the same file (`openaiApiKey`, `braveApiKey`, `exaApiKey`,
`tinyfishApiKey`, …) or in the matching environment variable. Keys may also be
read at request time from a `!command` source, so a secret manager can stay the
only copy. `exaApiKey` is optional: without it, zero-config search uses Exa MCP.
For Jina search, set `jinaApiKey` or `JINA_API_KEY`; requests go to `s.jina.ai`.
Selecting that backend is `provider: "jina"` — the tool enum uses the bare name
`jina`.

### Trust and network posture

- Redirects, DNS resolution, and literal-IP checks run through the SSRF guard.
  Loopback, link-local, and private ranges stay blocked unless you deliberately
  add `ssrf.allowRanges` (for a fake-IP proxy range) — the default is empty.
- `ssrf.trustEnvProxy` only skips the local DNS preflight for hostnames routed
  through `HTTP(S)_PROXY`; localhost and private literals stay blocked.
- Remote hosted page fetchers (Firecrawl, Crawl4AI, Jina reader, Datalab,
  Bright Data, a custom PDF endpoint) require
  `fetchRouting.allowRemoteHostedProviders` for remote HTTP(S) targets.
- Browser-cookie access for Gemini Web is opt-in (`PI_ALLOW_BROWSER_COOKIES` or
  config) and reads cookies through the host, never from this repository.

## Search backends

Provider availability is checked at call time. `auto` (default) walks the routing
order and stops at the first provider that is configured and healthy. `all` fans
out only over the *eligible* providers below — it never spends money on an
opt-in or paid backend without you asking for it by name.

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
| `serpdive` | `serpdiveApiKey` / `SERPDIVE_API_KEY` | Billed per search, so it is only used when selected. |
| `kagi` | `kagiApiKey` / `KAGI_API_KEY` | |
| `ollama` | `ollamaApiKey` / `OLLAMA_API_KEY` | |
| `perplexity` | `perplexityApiKey` / `PERPLEXITY_API_KEY` | |
| `gemini` | `geminiApiKey` / `GEMINI_API_KEY`, or Google ADC | Optional `geminiBaseUrl`, Cloudflare AI Gateway key. |
| `bocha` | `bochaApiKey` / `BOCHA_API_KEY` | |

### Explicit-only backends

These are never used by `auto` or `all`; pass `provider: "<name>"` yourself.

| Provider | Credential | Notes |
| --- | --- | --- |
| `parallel-mcp` | Parallel account inside Pi | MCP transport, explicit only. |
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

`searchProvider` (or `provider` per call) may also be an array of provider names
to search several backends at once. Providers without credentials return an
error instead of silently degrading. `webSearch.allowedProviders` narrows the
whole set, for example to `["exa", "brave"]`.

## Fetch and extraction backends

Extraction is attempted with the built-in HTTP path first (Readability,
Defuddle, linkedom, turndown). Specialized routes:

- `fetchRouting.providers` — ordered list such as `["http", "firecrawl",
  "crawl4ai", "jina"]`; each entry has its own base URL/token settings.
- GitHub URLs are cloned with the GitHub API and read as real files.
- PDF text comes from `unpdf`, a Datalab endpoint, or Gemini — depending on what
  is configured; scanned PDFs still need a text layer or an extraction endpoint.
- YouTube: Gemini Web when browser cookies are enabled, then Gemini API, then
  Perplexity. Local video files are transcribed with `yt-dlp`/`ffmpeg` when those
  binaries exist; missing binaries produce a specific error, never a silent null.
- `fetch.defaultMode` — `readable` | `raw` | `answer`; `fetch.allowedModes`
  limits what callers may ask for.

## web_document contract v1

The `browse` companion package reads documents through `web_document`. The
contract is deliberately small and stable:

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
  snapshot with a new ref.
- A ref is only readable when its result is on the caller's session branch.
- Ranges are exact source byte offsets, preserved across Unicode and
  giant-line continuation; `findText` matches are bounded and paginated.
- Windows are bounded by `limit` and `maxOutputChars` (1 000–30 000 per call).
- Snapshot bodies survive freshness expiry, and bounded LRU eviction replaces an
  evicted body with an explicit error instead of partial text.
- `documentSnapshots` must be `true` for `web_document` to be registered.

## Curator and summary workflows

`.curate`/`/curate` opens a local curator page for reviewing results;
`workflow: "summary-review"` prefills it, while `workflow: "auto-summary"` will
generate a summary without opening the curator. Both are explicit per call:

```json
{ "queries": ["…"], "workflow": "auto-summary" }
```

`summaryModel` picks the drafting model; the configured Pi summary model is used
when it is not set. A failed or slow draft never blocks the search results.

Remote curator sessions print the URL instead of trying to open a browser by default, which is what you want in Docker, WSL, SSH, or headless environments. Copy it into a browser that can reach the Pi host to finish the review.

## Tools and commands

Every tool and command can be switched off individually; `toolNames` can opt into alternate public tool names if they collide with another package. Pi restart is required for tool and command registration changes — `/reload` is not enough for renamed or disabled tools.

```json
{
  "tools": { "sourceCheck": { "enabled": false } },
  "commands": { "curator": { "enabled": false } },
  "toolNames": { "webSearch": "web_search", "fetchContent": "fetch_content" }
}
```

`toolActivation` defaults to `"auto"`: a fresh session with a model that
supports mid-conversation tool changes starts with only `web_enable`, and the
web tools appear after the model calls it; models without that support keep the
web tools eagerly available, and recorded sessions keep their declared tools.
`"dynamic"` always starts with just the loader. `"toolExposure": "deferred"`
additionally keeps the web tools off every request until `web_enable` runs — it
forces dynamic activation and cannot be combined with `"toolActivation": "eager"`.

## Use from other agents (MCP)

The bundled stdio server ships in `dist/`, so no Pi installation and no build
step are needed to run it — only its runtime dependencies:

```bash
npm install --omit=dev      # runtime dependencies for the bundled server
./dist/mcp-cli.js           # stdio MCP server
```

`dist/` is committed and kept in sync with the source. Rebuild it only after
you change the code:

```bash
npm install && npm run build   # dist/index.js and dist/mcp-cli.js
```

## Compatibility

- Pi **1.3.0** public extension API. Older 1.x versions are untested; the
  `web_document` tool needs the public nested-tool API (`ctx.executeTool`).
- Host-provided packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`,
  `@earendil-works/pi-tui`, `typebox`) are declared as **peers only** and never
  bundled, so the extension cannot load a duplicate class registry.
- Runtime dependencies are declared in `dependencies`; Pi installs them for git
  and npm sources.
- `pi.extensions` points at TypeScript source (`./index.ts`), so a git install
  never depends on a prebuilt bundle staying in sync with the source. The `dist/`
  bundle is committed anyway, and ships in the package, so the MCP server works
  right after its runtime dependencies are installed.
- The package `files` allowlist covers `dist`, sources, both READMEs, `assets`,
  `LICENSE`, `provenance.json`, `CHANGELOG.md` and `SECURITY.md`; tests, scripts
  and the upstream contract evidence stay out of the package.
- The package is `"private": true` and is installed from Git. It is not published
  to npm under this name; `pi-web-access` on npm is the upstream project.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm test` runs the Node test runner against the TypeScript source and needs no
provider keys. It reaches the network only for the loopback HTTP fixture in the
browse end-to-end check and for the packed-install check, which resolves
production dependencies from the npm registry. CI runs typecheck, tests and
build on Ubuntu and macOS with Node 24.

Release gates used to qualify this package, run from this directory:

```bash
npm run verify:install   # pack, install production deps only, load through the Pi 1.3 loader
npm run build            # rebuild dist; verifies the committed bundle is reproducible
```

## License

MIT. Upstream copyright (c) 2025 **Nico Bailon**; fork modifications
(c) 2026 kekma-dot. See [LICENSE](LICENSE).
