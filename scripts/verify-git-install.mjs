#!/usr/bin/env node
// Release gate: emulate a fresh public Git install (production dependencies only, no build step)
// and prove the packaged extension still loads in Pi 1.3 and the packaged MCP bin runs.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(new URL("..", import.meta.url).pathname);
const work = await mkdtemp(join(tmpdir(), "ayla-tools-git-install-"));
const out = (message) => console.log(message);

try {
	execFileSync("npm", ["pack", "--pack-destination", work, "--silent"], { cwd: repo, stdio: ["ignore", "ignore", "inherit"] });
	const tarball = join(work, JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).name.replace(/^@[^/]+\//, "") + "-" + JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version + ".tgz");
	assert.ok(existsSync(tarball), tarball);

	mkdirSync(join(work, "app"), { recursive: true });
	execFileSync("npm", ["init", "-y"], { cwd: join(work, "app"), stdio: "ignore" });
	// Pi installs Git packages and their production dependencies; devDependencies (esbuild,
	// typescript, the SDK) are absent, and no build step runs.
	execFileSync("npm", ["install", "--omit=dev", "--omit=peer", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
		cwd: join(work, "app"),
		stdio: ["ignore", "ignore", "inherit"],
	});

	const installed = join(work, "app", "node_modules", "ayla-tools-web");
	assert.ok(existsSync(join(installed, "dist", "mcp-cli.js")), "committed dist must ship in the package");
	assert.ok(existsSync(join(installed, "index.ts")));
	assert.ok(!existsSync(join(installed, "node_modules")));

	// The Pi host provides the peer packages; mirror that with the qualified 1.3.0 install.
	const hostModules = join(repo, "node_modules");
	for (const name of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui", "typebox"]) {
		const target = join(hostModules, name);
		const link = join(work, "app", "node_modules", name);
		mkdirSync(join(link, ".."), { recursive: true });
		if (!existsSync(link)) symlinkSync(target, link, "dir");
	}

	// 1. The extension entry loads through the real Pi 1.3 loader from the installed package.
	const loadScript = `
		import { createModels, fauxProvider } from "@earendil-works/pi-ai";
		import { createAgentSession, DefaultResourceLoader, SessionManager } from "@earendil-works/pi-coding-agent";
		const faux = fauxProvider({});
		const models = createModels();
		models.setProvider(faux.provider);
		const modelRuntime = new Proxy(models, { get(t, p) { if (p === "hasConfiguredAuth") return () => true; if (p === "checkAuth") return async () => ({ type: "api_key", key: "test" }); if (p === "isUsingOAuth" || p === "isUsingSubscription") return () => false; const v = Reflect.get(t, p, t); return typeof v === "function" ? v.bind(t) : v; } });
		const loader = new DefaultResourceLoader({ cwd: process.cwd(), agentDir: process.cwd(), additionalExtensionPaths: [${JSON.stringify(join(installed, "index.ts"))}] });
		await loader.reload();
		const { session, extensionsResult } = await createAgentSession({ cwd: process.cwd(), agentDir: process.cwd(), model: faux.getModel(), modelRuntime, resourceLoader: loader, sessionManager: SessionManager.inMemory(process.cwd()), sessionStartEvent: { type: "session_start", reason: "startup" }, noTools: "builtin" });
		await session.bindExtensions({});
		console.log(JSON.stringify({ errors: extensionsResult.errors.map(String) }));
		session.dispose();
	`;
	const loaded = spawnSync(process.execPath, ["--input-type=module"], {
		cwd: join(work, "app"),
		input: loadScript,
		encoding: "utf8",
		env: { ...process.env, PI_CODING_AGENT_DIR: join(work, "app"), FAUX_API_KEY: "test" },
	});
	assert.equal(loaded.status, 0, loaded.stderr);
	assert.deepEqual(JSON.parse(loaded.stdout).errors, []);
	out("extension loads through Pi 1.3 loader from a production-only install: ok");

	// 2. dist/index.js runs with the installed production dependencies only (peer host present).
	const distScript = `
		import { pathToFileURL } from "node:url";
		const mod = await import(pathToFileURL(${JSON.stringify(join(installed, "dist", "index.js"))}).href);
		console.log(typeof mod.default);
	`;
	const distRun = spawnSync(process.execPath, ["--input-type=module"], {
		cwd: join(work, "app"), input: distScript, encoding: "utf8",
		env: { ...process.env, PI_CODING_AGENT_DIR: join(work, "app") },
	});
	assert.equal(distRun.status, 0, distRun.stderr);
	assert.equal(distRun.stdout.trim(), "function");
	out("dist/index.js imports from a production-only install: ok");

	// 3. The MCP bin runs standalone (typebox bundled) and answers MCP over stdio.
	const mcp = spawnSync(process.execPath, [join(installed, "dist", "mcp-cli.js")], {
		cwd: join(work, "app"),
		input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gate", version: "1" } } })}\n`,
		encoding: "utf8",
		timeout: 20000,
		env: { ...process.env, PI_CODING_AGENT_DIR: join(work, "app") },
	});
	assert.ok(mcp.stdout.includes('"serverInfo"'), `mcp-cli did not answer initialize: ${mcp.stdout} ${mcp.stderr}`);
	assert.equal(mcp.stdout.split("\n").filter(Boolean).every((line) => { try { JSON.parse(line); return true; } catch { return false; } }), true, "stdout must stay JSON-RPC only");
	out("dist/mcp-cli.js answers MCP initialize on a production-only install: ok");
} finally {
	await rm(work, { recursive: true, force: true });
}
