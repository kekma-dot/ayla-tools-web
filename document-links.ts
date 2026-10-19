import type { ExtractedContent } from "./extract.ts";

/** Parse real Markdown tokens, including reference links; never execute page HTML. */
export async function markdownDocumentLinks(content: string, baseUrl: string): Promise<NonNullable<ExtractedContent["links"]>> {
	const { marked } = await import("marked");
	const links: NonNullable<ExtractedContent["links"]> = [];
	marked.walkTokens(marked.lexer(content), token => {
		if (token.type !== "link" || links.length >= 256) return;
		try {
			const url = new URL(token.href, baseUrl);
			if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.href.length <= 4096) {
				links.push({ id: links.length + 1, text: token.text.slice(0, 200), url: url.href });
			}
		} catch {}
	});
	return links;
}
