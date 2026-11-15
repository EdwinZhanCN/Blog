/**
 * Obsidian-style callouts.
 *
 *   > [!note] Optional title
 *   > Body text.
 *
 * becomes <aside class="callout" data-callout="note">. Anything Obsidian renders
 * as a callout renders as one here, so a note looks the same in the vault and on the site.
 */

const MARKER = /^\[!([A-Za-z]+)\][+-]?[ \t]*(.*)$/;

function visit(node, fn) {
	if (!node || typeof node !== "object") return;
	fn(node);
	if (Array.isArray(node.children)) {
		for (const child of node.children) visit(child, fn);
	}
}

export function remarkCallouts() {
	return (tree) => {
		visit(tree, (node) => {
			if (node.type !== "blockquote") return;

			const first = node.children?.[0];
			if (first?.type !== "paragraph") return;

			const lead = first.children?.[0];
			if (lead?.type !== "text") return;

			const [firstLine, ...rest] = lead.value.split("\n");
			const match = firstLine.match(MARKER);
			if (!match) return;

			const kind = match[1].toLowerCase();
			const title = match[2].trim() || kind;

			// Drop the marker line from the body.
			lead.value = rest.join("\n");
			if (lead.value === "") {
				first.children.shift();
				if (first.children[0]?.type === "break") first.children.shift();
			}
			if (first.children.length === 0) node.children.shift();

			node.children.unshift({
				type: "paragraph",
				data: { hName: "p", hProperties: { className: ["callout-title"] } },
				children: [{ type: "text", value: title }],
			});

			node.data = {
				...(node.data ?? {}),
				hName: "aside",
				hProperties: { className: ["callout"], "data-callout": kind },
			};
		});
	};
}
