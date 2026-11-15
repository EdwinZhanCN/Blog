#!/usr/bin/env node
/**
 * Start a note without touching frontmatter.
 *
 *   npm run new -- "WAL, revisited"                 → src/content/blog/Notes/wal-revisited.md
 *   npm run new -- "WAL, revisited" --in Lumilio-Photos
 *
 * It begins life as a draft and a sketch. Flip `draft` to false when you want it seen —
 * it does not have to be finished first.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const blog = join(root, "src/content/blog");

const args = process.argv.slice(2);
const flag = args.indexOf("--in");
const series = flag >= 0 ? args[flag + 1] : undefined;
const title = args.filter((_, index) => flag < 0 || (index !== flag && index !== flag + 1)).join(" ").trim();

if (!title) {
	console.error('Give the note a name:  npm run new -- "A title" [--in Series]');
	process.exit(1);
}

const existing = readdirSync(blog, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);
// Match an existing series folder whatever its casing; otherwise file it under the name given.
const folder = existing.find((name) => name.toLowerCase() === (series ?? "Notes").toLowerCase()) ?? series ?? "Notes";

const slug =
	title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "") || `note-${Date.now()}`;

const file = join(blog, folder, `${slug}.md`);
if (existsSync(file)) {
	console.error(`Already exists: ${file}`);
	process.exit(1);
}

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const siblings = existsSync(join(blog, folder)) ? readdirSync(join(blog, folder)).filter((name) => /\.mdx?$/.test(name)).length : 0;
const display = series ? `@${folder.replace(/-/g, " ")}: ${title}` : title;

mkdirSync(join(blog, folder), { recursive: true });
writeFileSync(
	file,
	`---
title: ${JSON.stringify(display)}
pubDate: ${today}
description:
order: ${siblings + 1}
status: sketch
draft: true
---

`,
);

console.log(`Created ${file.replace(`${root}/`, "")}`);
console.log("It is a draft: visible in `npm run dev`, absent from the built site until draft is false.");
