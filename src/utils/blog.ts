import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export type BlogGroup = {
	label: string;
	name: string;
	slug: string;
	posts: BlogPost[];
};

const collator = new Intl.Collator("en", { sensitivity: "base" });
const groupLabelOverrides: Record<string, string> = {
	"jetson-yolo": "Jetson YOLO",
	lumen: "Lumen",
	lumnn: "LumNN",
};

export function getPublishedPosts(posts: BlogPost[]) {
	return posts.filter((post) => !post.data.draft);
}

export function getPostGroupName(post: BlogPost) {
	return post.id.split("/")[0] ?? "blog";
}

export function getGroupSlug(groupName: string) {
	return groupName.toLowerCase();
}

export function formatGroupName(groupName: string) {
	const slug = getGroupSlug(groupName);
	const override = groupLabelOverrides[slug];

	if (override) {
		return override;
	}

	return groupName
		.split(/[-_]/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function getPostPath(post: BlogPost) {
	return post.id
		.split("/")
		.filter(Boolean)
		.map((segment) => segment.toLowerCase());
}

export function getPostHref(post: BlogPost) {
	return `/blog/${getPostPath(post).join("/")}/`;
}

export function getGroupHref(groupName: string) {
	return `/blog/${getGroupSlug(groupName)}/`;
}

export function sortPostsByOrder(posts: BlogPost[]) {
	return [...posts].sort((left, right) => {
		if (left.data.order !== right.data.order) {
			return left.data.order - right.data.order;
		}

		if (left.data.pubDate.valueOf() !== right.data.pubDate.valueOf()) {
			return left.data.pubDate.valueOf() - right.data.pubDate.valueOf();
		}

		return collator.compare(left.data.title, right.data.title);
	});
}

export function groupPosts(posts: BlogPost[]) {
	const groups = new Map<string, BlogPost[]>();

	for (const post of posts) {
		const groupName = getPostGroupName(post);
		const group = groups.get(groupName);

		if (group) {
			group.push(post);
			continue;
		}

		groups.set(groupName, [post]);
	}

	return [...groups.entries()]
		.map(([name, groupPosts]) => ({
			label: formatGroupName(name),
			name,
			slug: getGroupSlug(name),
			posts: sortPostsByOrder(groupPosts),
		}))
		.sort((left, right) => {
			const rightLatest = Math.max(...right.posts.map((post) => post.data.updatedDate?.valueOf() ?? post.data.pubDate.valueOf()));
			const leftLatest = Math.max(...left.posts.map((post) => post.data.updatedDate?.valueOf() ?? post.data.pubDate.valueOf()));

			if (leftLatest !== rightLatest) {
				return rightLatest - leftLatest;
			}

			return collator.compare(left.name, right.name);
		});
}

export function getGroupBySlug(groups: BlogGroup[], slug: string) {
	return groups.find((group) => group.slug === slug);
}

/** "@Lumen: Pragmatic Inference" → { kicker: "Lumen", main: "Pragmatic Inference" } */
export function splitTitle(title: string) {
	const match = title.match(/^@([^:：]+)[:：]\s*(.+)$/);

	if (!match) {
		return { kicker: undefined, main: title };
	}

	return { kicker: match[1].trim(), main: match[2].trim() };
}

export function getPostDate(post: BlogPost) {
	return post.data.updatedDate ?? post.data.pubDate;
}

/** Newest first; within a day, keep series order so part 1 sits above part 2. */
export function sortPostsByDate(posts: BlogPost[]) {
	return [...posts].sort((left, right) => {
		const delta = right.data.pubDate.valueOf() - left.data.pubDate.valueOf();

		if (delta !== 0) {
			return delta;
		}

		const group = collator.compare(getPostGroupName(left), getPostGroupName(right));

		return group !== 0 ? group : left.data.order - right.data.order;
	});
}

/** 2026.05.24 — the machine's way of writing a date. */
export function formatDate(date: Date) {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");

	return `${year}.${month}.${day}`;
}

/** Stable FNV-1a hash: the seed a post's painting is grown from. */
export function seedFor(value: string) {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return ((hash >>> 0) % 99991) + 1;
}
