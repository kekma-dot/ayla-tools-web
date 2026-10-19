import { createHash } from "node:crypto";
import { marked } from "marked";
import type { ExtractedContent } from "./extract.ts";
import { findTextMatches, type FindMode } from "./content-find.ts";

/** Additive contract consumed by the independently loadable browse extension. */
export type DocumentView = {
	contractVersion: 1;
	ref: string;
	requestedUrl: string;
	finalUrl: string;
	title: string;
	fetchedAt: number;
	hash: string;
	contentKind: string;
	extractionStatus: string;
	completeness: "unknown";
	warnings: string[];
	status?: number;
	lineCount: number;
	lines: Array<{ number: number; text: string; start: number; end: number }>;
	links: Array<{ id: number; text: string; url: string }>;
	anchor?: { fragment: string; line: number | null };
	matches?: number;
	nextLine: number | null;
	nextOffset: number | null;
	outputTruncated: boolean;
};

/** Resolve surviving explicit heading permalinks, never guess an HTML id from its title. */
function fragmentOffset(page: ExtractedContent, fragment: string): number | undefined {
	let base: URL;
	try { base = new URL(page.finalUrl ?? page.url); } catch { return undefined; }
	base.hash = "";
	let cursor = 0;
	// ponytail: top-level extracted headings only; source-DOM mapping is needed for stripped/custom anchors.
	for (const token of marked.lexer(page.content)) {
		const start = page.content.indexOf(token.raw, cursor);
		if (start < 0) continue;
		cursor = start + token.raw.length;
		if (token.type !== "heading") continue;
		let found = false;
		marked.walkTokens([token], child => {
			if (child.type !== "link" || !/^[#¶§🔗\s\u200B\u2060]*$/u.test(child.text)) return;
			try {
				const target = new URL(child.href, base);
				const id = decodeURIComponent(target.hash.slice(1));
				target.hash = "";
				if (id === fragment && target.href === base.href) found = true;
			} catch { /* Invalid page-supplied links are not anchors. */ }
		});
		if (found) return start;
	}
	return undefined;
}

export function documentView(page: ExtractedContent, responseId: string, index: number, fetchedAt: number,
	params: { lineno?: number; limit?: number; offset?: number; findText?: string | string[]; findMode?: FindMode }): DocumentView {
	let startLine = params.lineno ?? 1;
	const budget = params.limit ?? 6000;
	if (!Number.isSafeInteger(startLine) || startLine < 1) throw new Error("lineno must be a positive integer");
	if (!Number.isSafeInteger(budget) || budget < 1 || budget > 30000) throw new Error("document limit must be 1..30000 chars");
	if (params.offset !== undefined && (!Number.isSafeInteger(params.offset) || params.offset < 0 || params.offset > page.content.length)) throw new Error("Invalid document offset");
	const content = page.content;
	const starts = [0];
	for (let i = 0; i < content.length; i++) if (content[i] === "\n") starts.push(i + 1);
	if (startLine > starts.length) throw new Error(`lineno exceeds ${starts.length}`);
	const lineOf = (offset: number) => {
		let low = 0, high = starts.length;
		while (low + 1 < high) { const mid = (low + high) >>> 1; if (starts[mid] <= offset) low = mid; else high = mid; }
		return low;
	};
	let anchor: DocumentView["anchor"];
	if (params.lineno === undefined && params.offset === undefined && params.findText === undefined) {
		let hash = "";
		try { hash = new URL(page.url).hash.slice(1); } catch { /* Legacy/local snapshots need no URL anchor. */ }
		if (hash) {
			let fragment = hash;
			try { fragment = decodeURIComponent(hash); } catch { /* Preserve the malformed fragment in diagnostics. */ }
			const offset = fragmentOffset(page, fragment);
			anchor = { fragment, line: offset === undefined ? null : lineOf(offset) + 1 };
			if (anchor.line !== null) startLine = anchor.line;
		}
	}
	const queries = params.findText === undefined ? undefined : Array.isArray(params.findText) ? params.findText : [params.findText];
	const hits = queries ? findTextMatches(content, queries, params.findMode ?? "case-insensitive") : undefined;
	const cursor = params.offset ?? starts[startLine - 1];
	const remainingHits = hits?.filter(hit => hit.end > cursor).sort((a, b) => a.start - b.start);
	const selected = remainingHits ? [...new Set(remainingHits.map(hit => Math.max(lineOf(hit.start), lineOf(cursor))))].slice(0, 81) : undefined;
	const lines: DocumentView["lines"] = [];
	let used = 0, nextLine: number | null = null, nextOffset: number | null = null;
	const firstLine = params.offset !== undefined ? lineOf(params.offset) : startLine - 1;
	// Iterate only the bounded window; do not allocate an index array for every line.
	const candidates = selected ?? Array.from({ length: Math.min(81, starts.length - firstLine) }, (_, i) => firstLine + i);
	for (const line of candidates) {
		if (used >= budget || lines.length >= 80) { nextLine = line + 1; nextOffset = starts[line]; break; }
		const end = line + 1 < starts.length ? starts[line + 1] - 1 : content.length;
		let start = Math.max(starts[line], params.offset ?? 0);
		if (hits) start = Math.max(start, (remainingHits!.find(hit => lineOf(hit.start) === line)?.start ?? start) - 200);
		let shownEnd = Math.min(end, start + budget - used);
		if (/[\uDC00-\uDFFF]/.test(content[start] ?? "")) start++;
		if (/[\uDC00-\uDFFF]/.test(content[shownEnd] ?? "")) shownEnd--;
		// An atomic code point must make progress even with a one-unit budget.
		if (shownEnd <= start && start < end) shownEnd = Math.min(end, start + ((content.codePointAt(start) ?? 0) > 0xffff ? 2 : 1));
		lines.push({ number: line + 1, text: content.slice(start, shownEnd), start, end: shownEnd });
		used += shownEnd - start + 12;
		if (shownEnd < end) { nextLine = line + 1; nextOffset = shownEnd; break; }
	}
	return {
		contractVersion: 1, ref: `d:${responseId}:${index}`, requestedUrl: page.url, finalUrl: page.finalUrl ?? page.url,
		title: page.title, fetchedAt, hash: createHash("sha256").update(content).digest("hex"),
		contentKind: page.contentKind ?? "provider_excerpt", extractionStatus: page.extractionStatus ?? (page.error ? "unavailable" : "ok"),
		completeness: "unknown", warnings: [...(page.warnings ?? []), ...(page.error ? [page.error] : [])],
		...(page.status !== undefined ? { status: page.status } : {}), lineCount: starts.length, lines,
		links: (page.links ?? []).slice(0, 256), ...(anchor ? { anchor } : {}), ...(hits ? { matches: hits.length } : {}), nextLine, nextOffset,
		outputTruncated: nextOffset !== null,
	};
}

export function formatDocument(view: DocumentView, linkLimit = 30): string {
	const label = (value: string, limit: number) => value.length <= limit ? value : value.slice(0, limit) + "…";
	return [
		`${label(view.title || view.finalUrl, 100)}\n${label(view.finalUrl, 180)}\nref: ${view.ref}; fetched: ${new Date(view.fetchedAt).toISOString()}; sha256: ${view.hash}`,
		`Untrusted ${view.contentKind}; extraction: ${view.extractionStatus}; completeness: ${view.completeness}; ${view.lineCount} lines.${view.status ? ` HTTP ${view.status}.` : ""}`,
		...view.warnings.slice(0, 1).map(warning => `Warning: ${label(warning, 160)}`),
		...(view.warnings.length > 1 ? [`${view.warnings.length - 1} additional warnings in structured metadata.`] : []),
		...(view.anchor ? [`Fragment #${label(view.anchor.fragment.replace(/[\u0000-\u001F\u007F]/g, " "), 160)}: ${view.anchor.line === null ? "not found in extracted snapshot; showing document start (use find)." : `L${view.anchor.line}`}`] : []),
		...(view.matches !== undefined ? [`Matches: ${view.matches}`] : []),
		...(view.outputTruncated ? [`Continue ref ${view.ref} at lineno ${view.nextLine}, offset ${view.nextOffset}.`] : []),
		...view.lines.map(line => `L${line.number} [chars ${line.start}-${line.end}]: ${line.text}`),
		...view.links.slice(0, linkLimit).map(link => `[${link.id}] ${label(link.text, 100)}: ${link.url}`),
		...(view.links.length > linkLimit ? [`Only ${linkLimit} of ${view.links.length} link labels shown; all ids remain available to click.`] : []),
	].join("\n");
}

/** Bound the actual delivered window, never slice text independently of its ranges. */
export function renderDocument(view: DocumentView, maxChars = 30000): { view: DocumentView; text: string } {
	if (!Number.isSafeInteger(maxChars) || maxChars < 1000 || maxChars > 30000) throw new Error("Document output budget must be 1000..30000 chars");
	const bounded = { ...view, lines: view.lines.map(line => ({ ...line })) };
	let linkLimit = 30;
	let text = formatDocument(bounded, linkLimit);
	if (text.length > maxChars) { linkLimit = 0; text = formatDocument(bounded, linkLimit); }
	while (text.length > maxChars && bounded.lines.length) {
		const line = bounded.lines.at(-1)!;
		if (bounded.lines.length > 1) {
			bounded.lines.pop();
			bounded.nextLine = line.number; bounded.nextOffset = line.start;
		} else {
			let keep = Math.max(0, line.text.length - (text.length - maxChars) - 100);
			if (/[\uDC00-\uDFFF]/.test(line.text[keep] ?? "")) keep--;
			if (keep <= 0) throw new Error("Document metadata exceeds output budget; request a larger response");
			line.text = line.text.slice(0, keep); line.end = line.start + keep;
			bounded.nextLine = line.number; bounded.nextOffset = line.end;
		}
		bounded.outputTruncated = true;
		text = formatDocument(bounded, linkLimit);
	}
	if (text.length > maxChars) throw new Error("Document metadata exceeds output budget");
	return { view: bounded, text };
}
