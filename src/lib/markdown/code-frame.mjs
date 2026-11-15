/**
 * Shiki transformer: carry a code block's language and optional title onto the <pre>,
 * so the page can frame it without guessing.
 *
 *   ```ts title="upload-context.tsx"
 */
export function codeFrame() {
	return {
		name: "code-frame",
		pre(node) {
			const raw = this.options.meta?.__raw ?? "";
			const title = raw.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/);
			const lang = this.options.lang;

			if (lang && lang !== "plaintext") node.properties["data-lang"] = lang;
			if (title) node.properties["data-title"] = title[1] ?? title[2] ?? title[3];
		},
	};
}
