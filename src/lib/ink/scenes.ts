import type { Scene } from "./field";

/**
 * The score: what the painting does while the page is read.
 *
 * A section names its scene with `data-scene`. At the top and the bottom of
 * the page the two planes sit in register around the void. In between they
 * travel at their own speeds, and the mass follows the void into whatever
 * margin the layout leaves it.
 */

type Key = {
	/** Void centre across the viewport. A `[data-void]` element in the section overrides it. */
	x: number;
	/** Void centre down the viewport, on entering the scene and on leaving it. */
	y: [number, number];
	/** Fraction of the viewport's short side. */
	radius: number;
	lean: [number, number];
	stretch: [number, number];
	reach: number;
	env: number;
	density: number;
	brush: number;
	/** How far into the viewport (0 to 0.5) a section reaches before its scene holds. */
	inset: number;
};

/** The page moves at 1. The hand lags behind it; the machine runs ahead. */
const HAND = 0.3;
const MACHINE = 1.6;
/** The shortest stretch of the machine's plane that can repeat without being seen to. */
const PERIOD = 3.5;

const WHOLE: Key = {
	x: 0.72,
	y: [0.42, 0.42],
	radius: 0.165,
	lean: [0.06, -0.02],
	stretch: [0.92, 1.12],
	reach: 0.62,
	env: 0.6,
	density: 0,
	brush: 1,
	inset: 0.5,
};

const WHOLE_TALL: Key = {
	...WHOLE,
	x: 0.6,
	y: [0.3, 0.3],
	radius: 0.2,
	lean: [0, 0.02],
	stretch: [1.2, 1.3],
	reach: 0.7,
};

/** Landscape: the painting keeps to the right of the type, all the way down. */
const WIDE: Record<string, Key> = {
	hero: WHOLE,
	// a ribbon in the margin the layout leaves beside the text
	lane: {
		x: 0.89,
		y: [0.46, 0.5],
		radius: 0.058,
		lean: [0, 0],
		stretch: [3, 0.5],
		reach: 0.62,
		env: 0.7,
		density: -0.04,
		brush: 0,
		inset: 0.3,
	},
	// the same ribbon, between the two columns of paintings
	series: {
		x: 0.5,
		y: [0.5, 0.5],
		radius: 0.05,
		lean: [0, 0],
		stretch: [5.4, 0.45],
		reach: 0.62,
		env: 0.7,
		density: -0.05,
		brush: 0,
		inset: 0.3,
	},
	footer: WHOLE,
};

/** Portrait: no margin to spare, so the ribbon runs down the right edge, under the type. */
const TALL: Record<string, Key> = {
	hero: WHOLE_TALL,
	lane: {
		x: 0.9,
		y: [0.46, 0.5],
		radius: 0.068,
		lean: [0, 0],
		stretch: [9.5, 0.5],
		reach: 0.6,
		env: 0.64,
		density: -0.08,
		brush: 0,
		inset: 0.3,
	},
	series: {
		x: 0.5,
		y: [0.5, 0.5],
		radius: 0.09,
		lean: [0, 0],
		stretch: [7, 0.45],
		reach: 0.6,
		env: 0.68,
		density: -0.05,
		brush: 0,
		inset: 0.3,
	},
	footer: WHOLE_TALL,
};

type Span = { key: Key; x: number; from: number; to: number };

export type Score = {
	read: () => Scene;
	destroy: () => void;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const along = (value: number, from: number, to: number) => (to > from ? clamp((value - from) / (to - from)) : 0);

export function mountScore(): Score {
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let spans: Span[] = [];
	let view = 1;
	let end = 0;
	let period = PERIOD;

	const scene: Scene = {
		x: WHOLE.x,
		y: WHOLE.y[0],
		radius: WHOLE.radius,
		lean: [...WHOLE.lean],
		stretch: [...WHOLE.stretch],
		reach: WHOLE.reach,
		env: WHOLE.env,
		density: 0,
		tear: 0,
		brush: 1,
		hand: 0,
		machine: 0,
		period: PERIOD,
	};

	function measure() {
		const width = window.innerWidth;
		view = window.innerHeight;
		const keys = width >= 860 && width > view ? WIDE : TALL;
		const scroll = window.scrollY;

		spans = [];
		for (const element of document.querySelectorAll<HTMLElement>("[data-scene]")) {
			const key = keys[element.dataset.scene ?? ""];
			if (!key) continue;
			const rect = element.getBoundingClientRect();
			const top = rect.top + scroll;
			const bottom = rect.bottom + scroll;
			const inset = Math.min(key.inset * view, (bottom - top) / 2);

			const previous = spans.at(-1);
			if (previous?.key === key) {
				// neighbouring sections in one scene: hold it across both
				previous.to = bottom - inset;
				continue;
			}

			let x = key.x;
			const marker = element.querySelector<HTMLElement>("[data-void]")?.getBoundingClientRect();
			if (marker && marker.width > 0) x = (marker.left + marker.width / 2) / width;
			spans.push({ key, x, from: top + inset, to: bottom - inset });
		}

		end = Math.max(0, document.documentElement.scrollHeight - view);
		// Fit a whole number of turns into the page, so the machine arrives at the foot
		// of the page exactly as it left the head: in register.
		const travel = (MACHINE * end) / view;
		period = travel >= PERIOD ? travel / Math.floor(travel / PERIOD) : PERIOD;
	}

	function hold(span: Span, t: number) {
		const { key } = span;
		scene.x = span.x;
		scene.y = mix(key.y[0], key.y[1], t);
		scene.radius = key.radius;
		scene.lean[0] = key.lean[0];
		scene.lean[1] = key.lean[1];
		scene.stretch[0] = key.stretch[0];
		scene.stretch[1] = key.stretch[1];
		scene.reach = key.reach;
		scene.env = key.env;
		scene.density = key.density;
		scene.brush = key.brush;
		scene.tear = 0;
	}

	function cross(from: Span, to: Span, t: number) {
		const a = from.key;
		const b = to.key;
		scene.x = mix(from.x, to.x, t);
		scene.y = mix(a.y[1], b.y[0], t);
		scene.radius = mix(a.radius, b.radius, t);
		scene.lean[0] = mix(a.lean[0], b.lean[0], t);
		scene.lean[1] = mix(a.lean[1], b.lean[1], t);
		scene.stretch[0] = mix(a.stretch[0], b.stretch[0], t);
		scene.stretch[1] = mix(a.stretch[1], b.stretch[1], t);
		scene.reach = mix(a.reach, b.reach, t);
		scene.env = mix(a.env, b.env, t);
		scene.density = mix(a.density, b.density, t);
		scene.brush = mix(a.brush, b.brush, t);
		scene.tear = 0;
	}

	function read() {
		const scroll = Math.min(end, Math.max(0, window.scrollY));
		scene.hand = 0;
		scene.machine = 0;
		scene.period = period;
		if (spans.length === 0) return scene;

		if (still) {
			// Reduced motion: one composition. It leaves with the head of the page and returns at the foot.
			hold(spans[0], 0);
			scene.tear = Math.min(clamp(scroll / (view * 0.9)), clamp((end - scroll) / (view * 0.8)));
			return scene;
		}

		const probe = scroll + view / 2;
		let index = 0;
		while (index < spans.length - 1 && probe >= spans[index + 1].from) index += 1;
		const here = spans[index];
		const next = spans[index + 1];
		if (!next || probe <= here.to) hold(here, along(probe, here.from, here.to));
		else cross(here, next, ease(along(probe, here.to, next.from)));

		scene.hand = (HAND * scroll) / view;
		scene.machine = (MACHINE * scroll) / view;
		return scene;
	}

	measure();
	// The page grows and shrinks under us: fonts land, the window turns.
	const observer = new ResizeObserver(measure);
	observer.observe(document.body);
	window.addEventListener("resize", measure);

	return {
		read,
		destroy() {
			observer.disconnect();
			window.removeEventListener("resize", measure);
		},
	};
}
