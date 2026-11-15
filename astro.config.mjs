// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";
import { remarkCallouts } from "./src/lib/markdown/callouts.mjs";
import { codeFrame } from "./src/lib/markdown/code-frame.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://edwinzhan.space",
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [remarkCallouts],
		shikiConfig: {
			// Token colours come from CSS variables (see styles/prose.css),
			// so code follows the paper/ink theme instead of fighting it.
			theme: "css-variables",
			transformers: [codeFrame()],
		},
	},
	adapter: cloudflare(),
});
