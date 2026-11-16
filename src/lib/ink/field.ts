import { Ink, type Painting, type Palette } from "./core";
import { fieldCharacter, readPalette, toSeed, type FieldCharacter } from "./painting";

/** What the page asks of the painting at one moment of the scroll. */
export type Scene = {
	/** The void: centre as fractions of the viewport, radius as a fraction of its short side. */
	x: number;
	y: number;
	radius: number;
	/** Where the mass gathers, measured from the void (viewport height = 1). */
	lean: [number, number];
	/** The shape of the mass: the larger a value, the narrower the mass along that axis. */
	stretch: [number, number];
	reach: number;
	env: number;
	/** Added to the coverage: below zero thins the ink. */
	density: number;
	/** 0 = the painting is whole, 1 = it has been torn off the page. */
	tear: number;
	/** Above one half, the visitor's pointer is a brush. */
	brush: number;
	/** How far each plane has travelled, in viewport heights. */
	hand: number;
	machine: number;
	/** The machine's plane repeats this often, in viewport heights. */
	period: number;
};

export type FieldOptions = {
	seed: number;
	/** Asked every frame. */
	scene: () => Scene;
	/** Told whenever a new painting begins. */
	onPaint?: (seed: number) => void;
};

export type Field = {
	repaint: (seed?: number) => void;
	destroy: () => void;
};

const BLOOM_SECONDS = 2.8;
const DRAIN_SECONDS = 0.55;
const EMPTY = -1.05;
const STEP = 1 / 60;
// Exactly one 8-bit level per step: a stroke takes about four seconds to dry.
const FADE = 1 / 255;
const TRAIL_ROWS = 256;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function mountField(canvas: HTMLCanvasElement, options: FieldOptions): Field {
	const ink = new Ink(canvas);
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let palette: Palette = readPalette();
	let seed = options.seed;
	let character: FieldCharacter;
	let scale = Math.min(window.devicePixelRatio || 1, 1.5);
	let width = 0;
	let height = 0;
	let viewW = 0;
	let viewH = 0;

	// One painting, recomposed in place on every frame.
	const painting: Painting = {
		seed,
		dir: [1, 0],
		bands: 0,
		shear: 0,
		glitch: 0,
		wash: 0,
		reach: 0,
		env: 0,
		panels: 1,
		focus: [0, 0],
		stretch: [1, 1],
		void: [0, 0, 0],
	};
	const hand: [number, number] = [0, 0];
	const machine: [number, number] = [0, 0];
	const shift: [number, number] = [0, 0];

	let raf = 0;
	let last = performance.now();
	let time = (seed % 600) + 10;
	let accumulator = 0;
	let dirty = true;
	let slowFrames = 0;
	let frames = 0;

	// what the page last asked for, to tell a moving page from a resting one
	let seen = "";
	let lastScroll = -Infinity;
	let resting = false;
	let steady = false;
	let travelled = Number.NaN;
	let carry = 0;

	// bloom: "in" grows the ink out of nothing; "out" drains it before a repaint
	let phase: "in" | "out" | "still" = reduced ? "still" : "in";
	let phaseTime = 0;
	let nextSeed = seed;

	// the visitor's brush, and the one that takes over when they rest
	let pointer: [number, number] | null = null;
	let brush: [number, number] | null = null;
	let lastMove = -Infinity;
	let ghosting = false;
	let ghostAngle = (seed % 628) / 100;

	/** The part of the painting the seed decides. */
	function cast() {
		character = fieldCharacter(seed, viewW / viewH < 0.8);
		painting.seed = character.seed;
		painting.dir = character.dir;
		painting.bands = character.bands;
		painting.shear = character.shear;
		painting.glitch = character.glitch;
		painting.wash = character.wash;
		painting.panels = character.panels;
	}

	/** The part the page decides. */
	function compose(scene: Scene) {
		const x = (scene.x - 0.5) * (viewW / viewH);
		const y = 0.5 - scene.y;
		painting.void[0] = x;
		painting.void[1] = y;
		painting.void[2] = (scene.radius * Math.min(viewW, viewH)) / viewH;
		painting.focus[0] = x + scene.lean[0];
		painting.focus[1] = y + scene.lean[1];
		painting.stretch[0] = scene.stretch[0];
		painting.stretch[1] = scene.stretch[1];
		painting.reach = scene.reach + character.spread;
		painting.env = scene.env;
		// Scrolling down carries the page up; both planes follow it, each at its own pace.
		hand[1] = -scene.hand;
		machine[1] = -scene.machine;
	}

	function resize() {
		viewW = window.innerWidth;
		viewH = window.innerHeight;
		width = Math.max(2, Math.round(viewW * scale));
		height = Math.max(2, Math.round(viewH * scale));
		canvas.width = width;
		canvas.height = height;
		cast();
		if (!reduced) {
			ink.resizeTrail(Math.max(2, Math.round((TRAIL_ROWS * viewW) / viewH)), TRAIL_ROWS);
			brush = null;
			carry = 0;
		}
		dirty = true;
	}

	function density(dt: number) {
		if (phase === "still") return 0;
		phaseTime += dt;
		if (phase === "in") {
			const t = clamp(phaseTime / BLOOM_SECONDS, 0, 1);
			if (t >= 1) phase = "still";
			return EMPTY * (1 - easeOut(t));
		}
		const t = clamp(phaseTime / DRAIN_SECONDS, 0, 1);
		if (t >= 1) {
			seed = nextSeed;
			cast();
			options.onPaint?.(seed);
			phase = "in";
			phaseTime = 0;
			return EMPTY;
		}
		return EMPTY * easeIn(t);
	}

	function voidRadius(scene: Scene) {
		return (scene.radius * Math.min(viewW, viewH)) / viewH;
	}

	function ghost(dt: number, scene: Scene): [number, number] {
		ghostAngle += dt * 0.42;
		const orbit = voidRadius(scene) * (1.24 + 0.3 * Math.sin(time * 0.29) + 0.1 * Math.sin(time * 0.83));
		return [
			scene.x + (Math.cos(ghostAngle) * orbit * viewH) / viewW,
			1 - scene.y + Math.sin(ghostAngle) * orbit,
		];
	}

	function simulate(dt: number, scene: Scene, now: number) {
		accumulator = Math.min(accumulator + dt, STEP * 4);
		while (accumulator >= STEP) {
			accumulator -= STEP;
			const idle = now - lastMove > 2400;
			let target: [number, number] | null = null;
			let radius = 0.03;

			if (scene.brush > 0.5 && !idle && pointer) {
				if (ghosting) brush = null;
				ghosting = false;
				target = pointer;
			} else if (idle && phase === "still" && scene.tear < 0.6) {
				if (!ghosting) brush = null;
				ghosting = true;
				target = ghost(STEP, scene);
				radius = Math.max(0.006, voidRadius(scene) * (0.103 + 0.067 * Math.sin(time * 0.61)));
			}

			// What is already on the sheet travels with the hand's plane, a whole texel at a time.
			const rows = Math.trunc(carry);
			carry -= rows;
			shift[1] = -rows;

			if (target && brush) {
				const dx = ((target[0] - brush[0]) * viewW) / viewH;
				const dy = target[1] - brush[1];
				const speed = Math.hypot(dx, dy);
				if (!ghosting) radius = clamp(0.046 - speed * 0.5, 0.012, 0.046);
				ink.stroke(brush, target, radius, speed > 1e-5 ? 1 : 0, FADE, shift);
			} else {
				ink.stroke([0, 0], [0, 0], 0.001, 0, FADE, shift);
			}
			brush = target ? [target[0], target[1]] : null;
		}
	}

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const scene = options.scene();

		const asked = `${scene.hand}|${scene.tear}|${scene.x}|${scene.y}|${scene.radius}`;
		const moved = asked !== seen;
		seen = asked;
		if (moved) lastScroll = now;

		let busy = true;
		if (reduced) {
			if (!dirty && !moved) return;
		} else {
			// At rest the painting only breathes: every other frame is enough.
			busy =
				dirty || phase !== "still" || now - lastScroll < 240 || now - lastMove < 320;
			resting = !busy && !resting;
			if (resting) return;
		}

		const dt = Math.min((now - last) / 1000, 0.1);
		last = now;
		compose(scene);

		if (!reduced) {
			time += dt;
			if (!Number.isNaN(travelled)) carry += (scene.hand - travelled) * TRAIL_ROWS;
			travelled = scene.hand;
			simulate(dt, scene, now);
		}

		const started = performance.now();
		ink.paint(width, height, painting, palette, {
			time,
			tear: scene.tear,
			density: density(dt) + scene.density,
			grain: 0.028,
			hand,
			machine,
			period: scene.period,
		});
		dirty = false;

		// If this machine is struggling, paint a smaller canvas rather than a slower one.
		// Only frames painted back to back say anything about that.
		if (!reduced && busy && steady) {
			frames += 1;
			if (dt > 0.03 || performance.now() - started > 12) slowFrames += 1;
			if (frames >= 90) {
				if (slowFrames > 45 && scale > 0.6) {
					scale = Math.max(0.6, scale * 0.75);
					resize();
				}
				frames = 0;
				slowFrames = 0;
			}
		}
		steady = busy;
	}

	function onPointer(event: PointerEvent) {
		pointer = [event.clientX / viewW, 1 - event.clientY / viewH];
		lastMove = performance.now();
	}

	function onPointerDown(event: PointerEvent) {
		// A touch lands somewhere new; don't drag a line there from the last one.
		if (event.pointerType !== "mouse") brush = null;
		onPointer(event);
	}

	function onTheme() {
		palette = readPalette();
		dirty = true;
	}

	function onVisibility() {
		cancelAnimationFrame(raf);
		if (!document.hidden) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	}

	resize();
	options.onPaint?.(seed);
	window.addEventListener("resize", resize);
	window.addEventListener("pointermove", onPointer, { passive: true });
	window.addEventListener("pointerdown", onPointerDown, { passive: true });
	document.addEventListener("themechange", onTheme);
	document.addEventListener("visibilitychange", onVisibility);
	raf = requestAnimationFrame(frame);

	return {
		repaint(value) {
			nextSeed = toSeed(value ?? Math.random() * 99991);
			if (reduced) {
				seed = nextSeed;
				cast();
				options.onPaint?.(seed);
				dirty = true;
				return;
			}
			phase = "out";
			phaseTime = 0;
		},
		destroy() {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointer);
			window.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("themechange", onTheme);
			document.removeEventListener("visibilitychange", onVisibility);
			ink.destroy();
		},
	};
}
