import { animate, inView, scroll, stagger } from "motion";
import { mountCovers, paintCover } from "../lib/ink/covers";
import { mountField, type Field } from "../lib/ink/field";
import { toSeed } from "../lib/ink/painting";
import { mountScore } from "../lib/ink/scenes";

type Cleanup = () => void;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = matchMedia("(hover: hover)").matches;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

let cleanups: Cleanup[] = [];

/* ── Theme ────────────────────────────────────────────────────────────────── */

function setTheme(next: "light" | "dark", origin?: DOMRect) {
	const apply = () => {
		root.dataset.theme = next;
		try {
			localStorage.setItem("blog-theme", next);
		} catch {
			// The page can still change even if it can't remember.
		}
		document.dispatchEvent(new Event("themechange"));
	};

	if (reduced || !document.startViewTransition) {
		apply();
		return;
	}

	// The new paper opens out of the toggle as a circle.
	if (origin) {
		root.style.setProperty("--iris-x", `${origin.left + origin.width / 2}px`);
		root.style.setProperty("--iris-y", `${origin.top + origin.height / 2}px`);
	}
	root.dataset.switching = "";
	document.startViewTransition(apply).finished.finally(() => {
		delete root.dataset.switching;
	});
}

document.addEventListener("click", (event) => {
	const toggle = (event.target as Element).closest<HTMLElement>("[data-theme-toggle]");
	if (!toggle) return;
	setTheme(root.dataset.theme === "dark" ? "light" : "dark", toggle.getBoundingClientRect());
});

// Astro swaps <html> attributes on navigation; carry ours across.
document.addEventListener("astro:before-swap", (event) => {
	const next = (event as Event & { newDocument: Document }).newDocument.documentElement;
	next.dataset.theme = root.dataset.theme;
	next.classList.add("js");
	next.style.cssText = root.style.cssText;
});

/* ── Nav ──────────────────────────────────────────────────────────────────── */

function syncNav() {
	const links = document.querySelector<HTMLElement>("[data-nav-links]");
	const indicator = document.querySelector<HTMLElement>("[data-nav-indicator]");
	if (!links || !indicator) return;

	let active: HTMLAnchorElement | undefined;
	for (const link of links.querySelectorAll("a")) {
		const path = new URL(link.href).pathname;
		const current = location.pathname === path || location.pathname.startsWith(path);
		link.toggleAttribute("aria-current", false);
		if (current) {
			link.setAttribute("aria-current", "page");
			active = link;
		}
	}

	if (active) {
		indicator.style.width = `${active.offsetWidth}px`;
		indicator.style.transform = `translate3d(${active.offsetLeft}px, -50%, 0)`;
		indicator.style.opacity = "1";
	} else {
		indicator.style.opacity = "0";
	}
}

/* ── Arrivals ─────────────────────────────────────────────────────────────── */

function splitWords(element: HTMLElement) {
	if (element.classList.contains("is-split")) return;

	const walk = (node: Node) => {
		for (const child of [...node.childNodes]) {
			if (child.nodeType === Node.TEXT_NODE) {
				const fragment = document.createDocumentFragment();
				for (const part of (child.textContent ?? "").split(/(\s+)/)) {
					if (part === "") continue;
					if (/^\s+$/.test(part)) {
						fragment.append(" ");
						continue;
					}
					const word = document.createElement("span");
					word.className = "word";
					const inner = document.createElement("span");
					inner.textContent = part;
					word.append(inner);
					fragment.append(word);
				}
				child.replaceWith(fragment);
			} else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== "BR") {
				walk(child);
			}
		}
	};

	walk(element);
	element.classList.add("is-split");
}

function mountReveals(): Cleanup {
	const stops: Cleanup[] = [];

	for (const element of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
		const words = element.dataset.reveal === "words";
		const delay = Number(element.dataset.delay ?? 0);

		if (words) splitWords(element);
		if (reduced) continue;

		if (words) {
			const inner = element.querySelectorAll<HTMLElement>(".word > span");
			for (const word of inner) word.style.transform = "translateY(110%)";
			stops.push(
				inView(
					element,
					() => {
						animate(
							inner,
							{ transform: ["translateY(110%)", "translateY(0%)"] },
							{ duration: 1.25, ease: EASE_OUT, delay: stagger(0.05, { startDelay: delay }) },
						);
					},
					{ amount: 0.25 },
				),
			);
		} else {
			stops.push(
				inView(
					element,
					() => {
						animate(
							element,
							{ opacity: [0, 1], transform: ["translateY(16px)", "translateY(0px)"] },
							{ duration: 1.1, ease: EASE_OUT, delay },
						);
					},
					{ amount: 0.2 },
				),
			);
		}
	}

	return () => stops.forEach((stop) => stop());
}

/** A paragraph that inks itself in as you read down it. */
function mountScrub(): Cleanup {
	const stops: Cleanup[] = [];

	for (const element of document.querySelectorAll<HTMLElement>("[data-scrub]")) {
		if (reduced) continue;
		const words: HTMLElement[] = [];
		const walk = (node: Node) => {
			for (const child of [...node.childNodes]) {
				if (child.nodeType === Node.TEXT_NODE) {
					const fragment = document.createDocumentFragment();
					for (const part of (child.textContent ?? "").split(/(\s+)/)) {
						if (part === "") continue;
						if (/^\s+$/.test(part)) {
							fragment.append(" ");
							continue;
						}
						const span = document.createElement("span");
						span.textContent = part;
						span.style.opacity = "0.14";
						words.push(span);
						fragment.append(span);
					}
					child.replaceWith(fragment);
				} else if (child.nodeType === Node.ELEMENT_NODE) {
					walk(child);
				}
			}
		};
		if (!element.dataset.scrubbed) {
			walk(element);
			element.dataset.scrubbed = "true";
		}

		stops.push(
			scroll(
				(progress: number) => {
					const head = progress * (words.length + 4);
					for (let index = 0; index < words.length; index += 1) {
						words[index].style.opacity = String(0.14 + 0.86 * clamp(head - index));
					}
				},
				{ target: element, offset: ["start 0.88", "end 0.5"] },
			),
		);
	}

	return () => stops.forEach((stop) => stop());
}

/* ── The field ────────────────────────────────────────────────────────────── */

function mountHome(): Cleanup {
	const canvas = document.querySelector<HTMLCanvasElement>("[data-field]");
	if (!canvas) return () => {};

	const score = mountScore();
	let field: Field | undefined;

	const showSeed = (seed: number) => {
		const text = String(seed).padStart(5, "0");
		for (const node of document.querySelectorAll("[data-seed]")) node.textContent = text;
	};

	try {
		field = mountField(canvas, {
			seed: toSeed(Math.random() * 99991),
			scene: score.read,
			onPaint: showSeed,
		});
	} catch (error) {
		// No WebGL: the page is still a page. Paper, type, nothing else.
		console.warn(error);
		canvas.remove();
		score.destroy();
		return () => {};
	}

	const repaint = () => field?.repaint();
	const onKey = (event: KeyboardEvent) => {
		if (event.key.toLowerCase() !== "r" || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target;
		if (target instanceof Element && target.closest("input, textarea, [contenteditable]")) return;
		repaint();
	};
	const buttons = [...document.querySelectorAll<HTMLElement>("[data-repaint]")];
	for (const button of buttons) button.addEventListener("click", repaint);
	window.addEventListener("keydown", onKey);

	return () => {
		for (const button of buttons) button.removeEventListener("click", repaint);
		window.removeEventListener("keydown", onKey);
		score.destroy();
		field?.destroy();
	};
}

/* ── Depth ────────────────────────────────────────────────────────────────── */

/**
 * Things at different distances pass at different speeds.
 *
 * `data-depth="0.9"` moves an element at 0.9× the page, as if it were further away;
 * above 1 it is nearer. It sits exactly where the layout put it when its top edge is
 * 30% of the way down the viewport. Whatever is on screen when the page opens sits
 * true at the top of the page instead.
 *
 * `data-window` is a picture taller than its frame, drifting inside it as the frame passes.
 */
function mountDepth(): Cleanup {
	const movers = [...document.querySelectorAll<HTMLElement>("[data-depth]")];
	const pictures = [...document.querySelectorAll<HTMLElement>("[data-window]")];
	if (reduced || movers.length + pictures.length === 0) return () => {};

	let moving: { node: HTMLElement; rest: number; rate: number }[] = [];
	let framed: { node: HTMLElement; centre: number; span: number; room: number }[] = [];
	let raf = 0;

	const apply = () => {
		raf = 0;
		const scroll = window.scrollY;
		const view = window.innerHeight;
		const limit = view * 0.3;
		for (const { node, rest, rate } of moving) {
			node.style.translate = `0 ${clamp((rest - scroll) * rate, -limit, limit).toFixed(1)}px`;
		}
		for (const { node, centre, span, room } of framed) {
			node.style.translate = `0 ${(clamp((scroll + view / 2 - centre) / span, -1, 1) * room).toFixed(1)}px`;
		}
	};

	const measure = () => {
		for (const node of movers) node.style.translate = "";
		for (const node of pictures) node.style.translate = "";
		const scroll = window.scrollY;
		const view = window.innerHeight;
		moving = movers.map((node) => {
			const top = node.getBoundingClientRect().top + scroll;
			return {
				node,
				rest: top < view ? 0 : top - view * 0.3,
				rate: Number(node.dataset.depth) - 1,
			};
		});
		framed = pictures.map((node) => {
			const frame = (node.parentElement ?? node).getBoundingClientRect();
			return {
				node,
				centre: frame.top + scroll + frame.height / 2,
				span: (view + frame.height) / 2,
				room: Math.max(0, (node.offsetHeight - frame.height) / 2),
			};
		});
		apply();
	};

	const onScroll = () => {
		if (!raf) raf = requestAnimationFrame(apply);
	};

	measure();
	const observer = new ResizeObserver(measure);
	observer.observe(document.body);
	window.addEventListener("resize", measure);
	window.addEventListener("scroll", onScroll, { passive: true });

	return () => {
		cancelAnimationFrame(raf);
		observer.disconnect();
		window.removeEventListener("resize", measure);
		window.removeEventListener("scroll", onScroll);
		for (const node of movers) node.style.translate = "";
		for (const node of pictures) node.style.translate = "";
	};
}

/* ── The index: a painting follows the cursor ─────────────────────────────── */

function mountPeek(): Cleanup {
	const frame = document.querySelector<HTMLElement>("[data-peek-frame]");
	const canvas = frame?.querySelector("canvas");
	const rows = [...document.querySelectorAll<HTMLElement>("[data-peek]")];
	if (!frame || !canvas || rows.length === 0 || !canHover) return () => {};

	let raf = 0;
	let on = false;
	let x = 0;
	let y = 0;
	let targetX = 0;
	let targetY = 0;
	let painted = "";

	const tick = () => {
		const dx = targetX - x;
		x += dx * 0.13;
		y += (targetY - y) * 0.13;
		frame.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${clamp(dx * 0.05, -7, 7)}deg)`;
		raf = on || Math.abs(dx) > 0.5 ? requestAnimationFrame(tick) : 0;
	};

	const onMove = (event: PointerEvent) => {
		const size = frame.offsetWidth;
		targetX = Math.min(event.clientX + 28, window.innerWidth - size - 16);
		targetY = clamp(event.clientY - size / 2, 16, window.innerHeight - size - 16);
		if (!raf && on) raf = requestAnimationFrame(tick);
	};

	const enter = (event: PointerEvent) => {
		const row = event.currentTarget as HTMLElement;
		const key = `${row.dataset.peek}:${root.dataset.theme}`;
		if (key !== painted && paintCover(canvas, Number(row.dataset.peek))) painted = key;
		if (!on) {
			onMove(event);
			x = targetX;
			y = targetY;
		}
		on = true;
		frame.classList.add("is-on");
		if (!raf) raf = requestAnimationFrame(tick);
	};

	const leave = () => {
		on = false;
		frame.classList.remove("is-on");
	};

	for (const row of rows) {
		row.addEventListener("pointerenter", enter);
		row.addEventListener("pointerleave", leave);
	}
	window.addEventListener("pointermove", onMove, { passive: true });

	return () => {
		cancelAnimationFrame(raf);
		leave();
		for (const row of rows) {
			row.removeEventListener("pointerenter", enter);
			row.removeEventListener("pointerleave", leave);
		}
		window.removeEventListener("pointermove", onMove);
	};
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

function frameCode(prose: HTMLElement) {
	for (const pre of prose.querySelectorAll<HTMLPreElement>("pre")) {
		if (pre.parentElement?.classList.contains("code")) continue;

		const figure = document.createElement("figure");
		figure.className = "code";

		const bar = document.createElement("figcaption");
		bar.className = "code-bar";
		const name = document.createElement("span");
		name.textContent = pre.dataset.title ?? pre.dataset.lang ?? "text";
		if (pre.dataset.title) name.classList.add("is-file");

		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "code-copy";
		copy.textContent = "Copy";
		copy.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
				copy.textContent = "Copied";
			} catch {
				copy.textContent = "Press ⌘C";
			}
			window.setTimeout(() => (copy.textContent = "Copy"), 1600);
		});

		bar.append(name, copy);
		pre.replaceWith(figure);
		figure.append(bar, pre);
	}

	for (const table of prose.querySelectorAll("table")) {
		if (table.parentElement?.classList.contains("table-scroll")) continue;
		const scroller = document.createElement("div");
		scroller.className = "table-scroll";
		table.replaceWith(scroller);
		scroller.append(table);
	}
}

function mountZoom(prose: HTMLElement): Cleanup {
	let overlay: HTMLElement | undefined;

	const close = () => {
		const current = overlay;
		if (!current) return;
		overlay = undefined;
		current.classList.remove("is-open");
		window.setTimeout(() => current.remove(), 400);
	};

	const open = (image: HTMLImageElement) => {
		overlay = document.createElement("div");
		overlay.className = "zoom";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-label", image.alt || "Image");
		const copy = document.createElement("img");
		copy.src = image.currentSrc || image.src;
		copy.alt = image.alt;
		overlay.append(copy);
		document.body.append(overlay);
		requestAnimationFrame(() => overlay?.classList.add("is-open"));
	};

	const onClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		if (overlay) {
			close();
			return;
		}
		if (target instanceof HTMLImageElement && prose.contains(target)) open(target);
	};
	const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();

	document.addEventListener("click", onClick);
	document.addEventListener("keydown", onKey);
	window.addEventListener("scroll", close, { passive: true });

	return () => {
		document.removeEventListener("click", onClick);
		document.removeEventListener("keydown", onKey);
		window.removeEventListener("scroll", close);
		overlay?.remove();
	};
}

function mountReading(): Cleanup {
	const prose = document.querySelector<HTMLElement>("[data-prose]");
	if (!prose) return () => {};

	const stops: Cleanup[] = [];
	frameCode(prose);
	stops.push(mountZoom(prose));

	// A hairline of ink across the top: how far down the page you are.
	const bar = document.querySelector<HTMLElement>("[data-progress]");
	if (bar) {
		stops.push(
			scroll(
				(progress: number) => {
					bar.style.transform = `scaleX(${progress})`;
				},
				{ target: prose, offset: ["start 0.5", "end 0.9"] },
			),
		);
	}

	// Contents: mark the section being read.
	const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc] a")];
	if (links.length > 0) {
		const byId = new Map(links.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
		const headings = [...prose.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]")];
		const mark = () => {
			let current: HTMLElement | undefined;
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= 140) current = heading;
			}
			for (const link of links) link.removeAttribute("aria-current");
			if (current) byId.get(current.id)?.setAttribute("aria-current", "true");
		};
		let queued = false;
		const onScroll = () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				mark();
			});
		};
		mark();
		window.addEventListener("scroll", onScroll, { passive: true });
		stops.push(() => window.removeEventListener("scroll", onScroll));
	}

	return () => stops.forEach((stop) => stop());
}

/* ── Life cycle ───────────────────────────────────────────────────────────── */

function mount() {
	syncNav();
	cleanups = [
		mountReveals(),
		mountScrub(),
		mountHome(),
		mountDepth(),
		mountCovers(),
		mountPeek(),
		mountReading(),
	];
}

function unmount() {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
}

document.addEventListener("astro:page-load", mount);
document.addEventListener("astro:before-swap", unmount);
window.addEventListener("resize", syncNav);
