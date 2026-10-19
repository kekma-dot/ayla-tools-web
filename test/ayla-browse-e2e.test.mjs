// End-to-end browse contract check: a real HTTP server, the registered fetch_content tool,
// and the codemode-only web_document reader. Proves navigation between two pages, immutable
// snapshot bodies after the origin changes, branch-scoped references, and that the default
// SSRF policy (no allowRanges) still refuses a loopback target.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, after } from "node:test";

const root = await mkdtemp(join(tmpdir(), "ayla-browse-e2e-"));
process.env.PI_CODING_AGENT_DIR = root;
process.env.PI_WEB_ACCESS_CACHE_ROOT = root;
await writeFile(join(root, "web-search.json"), JSON.stringify({
	documentSnapshots: true,
	fetchRouting: { providers: ["http"] },
	ssrf: { allowRanges: ["127.0.0.1/32"] },
	proxy: "",
}));

const { default: initialize } = await import("../index.ts");
const storage = await import("../storage.ts");

let body = "<p>FIRSTLINE946 is the current release note.</p>";
const server = createServer((req, res) => {
	if (req.url?.startsWith("/second")) {
		res.writeHead(200, { "content-type": "text/html" }).end(
			"<html><head><title>Second</title></head><body><article><p>SECOND946 follows the link.</p></article></body></html>",
		);
		return;
	}
	res.writeHead(200, { "content-type": "text/html" }).end(
		`<html><head><title>Start</title></head><body><article>${body}<p><a href="/second">next page</a></p></article></body></html>`,
	);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

function startHost() {
	const tools = new Map(), handlers = new Map(), entries = [];
	initialize({
		registerTool(tool) { tools.set(tool.name, tool); },
		registerCommand() {},
		registerShortcut() {},
		on(event, handler) { handlers.set(event, [...(handlers.get(event) ?? []), handler]); },
		appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); },
	});
	const ctx = { hasUI: false, sessionManager: { getBranch: () => entries }, ui: { setWidget() {}, notify() {} } };
	return {
		tools,
		call: (name, params) => tools.get(name).execute(`${name}-call`, params, undefined, undefined, ctx),
		emit: async (event) => { for (const handler of handlers.get(event) ?? []) await handler({ type: event }, ctx); },
	};
}

const host = startHost();
after(async () => {
	await new Promise((resolve) => server.close(resolve));
	storage.clearResults();
	await rm(root, { recursive: true, force: true });
});

test("fetch_content -> web_document navigates two real pages and keeps immutable snapshot bodies", async () => {
	await host.emit("session_start");
	const first = await host.call("fetch_content", { url: `${origin}/start` });
	assert.notEqual(first.isError, true, first.content[0].text);
	const firstId = first.details.responseId;
	assert.ok(firstId, "fetch_content must return a snapshot reference");

	assert.ok(host.tools.has("web_document"), "web_document is registered when documentSnapshots is true");
	const read = await host.call("web_document", { responseId: firstId });
	const doc = read.structuredContent;
	assert.equal(doc.contractVersion, 1);
	assert.match(doc.lines.map((line) => line.text).join("\n"), /FIRSTLINE946/);
	const link = doc.links.find((entry) => entry.url.endsWith("/second"));
	assert.ok(link, "the snapshot exposes numbered HTTP links for navigation");

	// The origin changes after the fetch; the snapshot must not follow it.
	body = "<p>MUTATED946 replaced the note.</p>";
	const reread = await host.call("web_document", { responseId: firstId });
	const rereadText = reread.structuredContent.lines.map((line) => line.text).join("\n");
	assert.match(rereadText, /FIRSTLINE946/);
	assert.doesNotMatch(rereadText, /MUTATED946/);

	// Navigation is a second fetch, and each snapshot keeps its own body.
	const second = await host.call("fetch_content", { url: `${origin}/second` });
	const secondId = second.details.responseId;
	assert.ok(secondId && secondId !== firstId);
	assert.match((await host.call("web_document", { responseId: secondId })).structuredContent.lines.map((line) => line.text).join("\n"), /SECOND946/);
	assert.match((await host.call("web_document", { responseId: firstId })).structuredContent.lines.map((line) => line.text).join("\n"), /FIRSTLINE946/);

	const unknown = await host.call("web_document", { responseId: "notOnThisBranch946" });
	assert.equal(unknown.isError, true);
	assert.match(unknown.content[0].text, /not available on this branch/);
	await host.emit("session_shutdown");
});

test("default SSRF policy still refuses a loopback target end to end", () => {
	const cleanRoot = join(root, "no-allow-ranges");
	const child = spawnSync(process.execPath, ["--input-type=module"], {
		encoding: "utf8",
		cwd: new URL("..", import.meta.url).pathname,
		env: { ...process.env, PI_CODING_AGENT_DIR: cleanRoot, PI_WEB_ACCESS_CACHE_ROOT: cleanRoot },
		input: `
			import { mkdir, writeFile } from "node:fs/promises";
			await mkdir(${JSON.stringify(cleanRoot)}, { recursive: true });
			await writeFile(${JSON.stringify(join(cleanRoot, "web-search.json"))}, JSON.stringify({ fetchRouting: { providers: ["http"] }, proxy: "" }));
			const { default: initialize } = await import("./index.ts");
			const tools = new Map(), entries = [];
			initialize({ registerTool(tool) { tools.set(tool.name, tool); }, registerCommand() {}, registerShortcut() {}, on() {}, appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); } });
			const ctx = { hasUI: false, sessionManager: { getBranch: () => entries }, ui: { setWidget() {}, notify() {} } };
			const result = await tools.get("fetch_content").execute("probe", { url: ${JSON.stringify(`${origin}/start`)} }, undefined, undefined, ctx);
			console.log(JSON.stringify({ isError: result.isError === true, text: result.content[0].text.slice(0, 400) }));
		`,
	});
	assert.equal(child.status, 0, child.stderr);
	const result = JSON.parse(child.stdout);
	assert.equal(result.isError, true, result.text);
	assert.match(result.text, /Blocked/);
	assert.doesNotMatch(result.text, /FIRSTLINE946/);
});
