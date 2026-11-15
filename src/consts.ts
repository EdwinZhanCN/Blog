// Everything about the site that isn't a post lives here.

export const SITE_TITLE = "Edwin Zhan";
export const SITE_DESCRIPTION = "Notes on systems, inference, and software design.";

export const AUTHOR = {
	name: "Edwin Zhan",
	fullName: "Zihao (Edwin) Zhan",
	email: "contact@edwinzhan.space",
};

export const NAV = [
	{ href: "/blog/", label: "Writing" },
	{ href: "/about/", label: "About" },
	{ href: "/resources/", label: "Resources" },
] as const;

export const SOCIALS = [
	{ href: "https://github.com/EdwinZhanCN", label: "GitHub" },
	{ href: "https://space.bilibili.com/592046389", label: "Bilibili" },
	{ href: "/rss.xml", label: "RSS" },
] as const;

/** The question the site opens with, and the honest state of the answer. */
export const QUESTION = {
	answer: "Not yet.",
};

/** Two sides of one record. Add a year, flip the disc. */
export const PLAYLISTS = [
	{
		side: "A",
		title: "2026's",
		year: "2026",
		src: "https://embed.music.apple.com/us/playlist/2026-s/pl.u-pMyllEmcWBV25My",
	},
	{
		side: "B",
		title: "2025's",
		year: "2025",
		src: "https://embed.music.apple.com/cn/playlist/2025-s/pl.u-qxylKqDI3jagdpJ?l=en",
	},
] as const;

/** What a post's `status` means to a reader. Unfinished is a state, not a failure. */
export const STATUS = {
	sketch: { label: "Sketch", note: "A sketch. Unfinished on purpose, published anyway." },
	inked: { label: "Inked", note: "Finished, as far as anything is." },
	shelved: { label: "Shelved", note: "The project stopped. The note stays." },
} as const;

export type Status = keyof typeof STATUS;
