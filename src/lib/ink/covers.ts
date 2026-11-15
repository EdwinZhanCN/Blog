import { Ink } from "./core";
import { coverPainting, readPalette, toSeed } from "./painting";

/**
 * Still paintings: one per post, one per series, each decided entirely by its seed.
 * A single hidden WebGL canvas paints all of them; the visible canvases are plain 2D copies.
 */

let studio: { canvas: HTMLCanvasElement; ink: Ink } | null = null;
let failed = false;

function getStudio() {
	if (studio || failed) return studio;
	try {
		const canvas = document.createElement("canvas");
		studio = { canvas, ink: new Ink(canvas) };
		canvas.addEventListener("webglcontextlost", () => {
			studio = null;
		});
	} catch {
		failed = true;
	}
	return studio;
}

export function paintCover(target: HTMLCanvasElement, seedValue: number) {
	const room = getStudio();
	if (!room) return false;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	// clientWidth ignores transforms, so a scaled-down frame still gets a full-size painting.
	const cssW = target.clientWidth || Number(target.dataset.size) || 320;
	const cssH = target.clientHeight || cssW;
	const width = Math.round(Math.min(cssW * dpr, 1400));
	const height = Math.round(Math.min(cssH * dpr, 1400));

	room.canvas.width = width;
	room.canvas.height = height;
	room.ink.paint(width, height, coverPainting(toSeed(seedValue)), readPalette(), {
		time: 0,
		tear: 0,
		density: 0.015,
		grain: 0.03,
	});

	target.width = width;
	target.height = height;
	const context = target.getContext("2d");
	if (!context) return false;
	context.drawImage(room.canvas, 0, 0);
	target.dataset.painted = "true";
	return true;
}

/** Paint every `canvas[data-cover]` as it approaches the viewport; repaint when the theme flips. */
export function mountCovers(root: ParentNode = document) {
	const canvases = [...root.querySelectorAll<HTMLCanvasElement>("canvas[data-cover]")];
	if (canvases.length === 0) return () => {};

	const seen = new Set<HTMLCanvasElement>();
	const paint = (canvas: HTMLCanvasElement) => paintCover(canvas, Number(canvas.dataset.cover));

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const canvas = entry.target as HTMLCanvasElement;
				seen.add(canvas);
				paint(canvas);
				observer.unobserve(canvas);
			}
		},
		{ rootMargin: "300px" },
	);
	for (const canvas of canvases) observer.observe(canvas);

	const onTheme = () => seen.forEach(paint);
	document.addEventListener("themechange", onTheme);

	return () => {
		observer.disconnect();
		document.removeEventListener("themechange", onTheme);
	};
}
