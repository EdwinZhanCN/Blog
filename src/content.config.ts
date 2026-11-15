import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			// The only two things a note needs to exist.
			title: z.string(),
			pubDate: z.coerce.date(),

			// Everything else can wait until you feel like it.
			// A key left empty in the frontmatter (`heroImage:`) is treated as absent, not as an error.
			description: z.string().nullish().transform((value) => value ?? ""),
			updatedDate: z.coerce.date().nullish().transform((value) => value ?? undefined),
			heroImage: z.union([image(), z.literal("")]).nullish(),
			draft: z.boolean().nullish().transform((value) => value ?? false),
			order: z.number().int().positive().nullish().transform((value) => value ?? 1),
			tags: z.array(z.string()).nullish().transform((tags) => tags ?? []),
			// sketch = unfinished on purpose · inked = done · shelved = the project stopped
			status: z.enum(["sketch", "inked", "shelved"]).nullish(),
			// Language of the prose, for typography. Notes here are Chinese unless they say otherwise.
			lang: z.string().nullish(),
		}),
});

export const collections = { blog };
