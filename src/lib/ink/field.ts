import { Ink, type Painting, type Palette } from "./core";
import { fieldPainting, readPalette, toSeed } from "./painting";

export type VoidPlacement = { x: number; y: number; radius: number };

export type FieldOptions = {
	seed: number;
	/** Where the void sits, as fractions of the viewport. Called on every resize. */
	place: (width: number, height: number) => VoidPlacement;
	/** 0 = the painting is whole, 1 = it has been torn off the page. Called every frame. */
	tear: () => number;
	/** Told whenever a new painting begins, and where its void ended up in CSS pixels. */
	onPaint?: (seed: number) => void;
	onLayout?: (void_: { x: number; y: number; radius: number }) => void;
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

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function mountField(canvas: HTMLCanvasElement, options: FieldOptions): Field {
	const ink = new Ink(canvas);
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let palette: Palette = readPalette();
	let seed = options.seed;
	let painting: Painting;
	let placement: VoidPlacement;
	let scale = Math.min(window.devicePixelRatio || 1, 1.5);
	let width = 0;
	let height = 0;
	let viewW = 0;
	let viewH = 0;

	let raf = 0;
	let last = performance.now();
	let time = (seed % 600) + 10;
	let accumulator = 0;
	let dirty = true;
	let lastTear = -1;
	let slowFrames = 0;
	let frames = 0;

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

	function compose() {
		painting = fieldPainting(seed, {
			width: viewW,
			height: viewH,
			voidX: placement.x,
			voidY: placement.y,
			voidRadius: placement.radius,
		});
	}

	function resize() {
		viewW = window.innerWidth;
		viewH = window.innerHeight;
		width = Math.max(2, Math.round(viewW * scale));
		height = Math.max(2, Math.round(viewH * scale));
		canvas.width = width;
		canvas.height = height;
		placement = options.place(viewW, viewH);
		compose();
		if (!reduced) {
			const trailH = 256;
			ink.resizeTrail(Math.max(2, Math.round((trailH * viewW) / viewH)), trailH);
			brush = null;
		}
		options.onLayout?.({
			x: placement.x * viewW,
			y: placement.y * viewH,
			radius: placement.radius * Math.min(viewW, viewH),
		});
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
			compose();
			options.onPaint?.(seed);
			phase = "in";
			phaseTime = 0;
			return EMPTY;
		}
		return EMPTY * easeIn(t);
	}

	function ghost(dt: number): [number, number] {
		ghostAngle += dt * 0.42;
		const radiusY = (placement.radius * Math.min(viewW, viewH)) / viewH;
		const orbit = radiusY * (1.24 + 0.3 * Math.sin(time * 0.29) + 0.1 * Math.sin(time * 0.83));
		return [
			placement.x + (Math.cos(ghostAngle) * orbit * viewH) / viewW,
			1 - placement.y + Math.sin(ghostAngle) * orbit,
		];
	}

	function simulate(dt: number, tear: number, now: number) {
		accumulator = Math.min(accumulator + dt, STEP * 4);
		while (accumulator >= STEP) {
			accumulator -= STEP;
			const idle = now - lastMove > 2400;
			const active = tear < 0.6;
			let target: [number, number] | null = null;
			let radius = 0.03;

			if (active && !idle && pointer) {
				if (ghosting) brush = null;
				ghosting = false;
				target = pointer;
			} else if (active && idle && phase === "still") {
				if (!ghosting) brush = null;
				ghosting = true;
				target = ghost(STEP);
				radius = 0.017 + 0.011 * Math.sin(time * 0.61);
			}

			if (target && brush) {
				const dx = ((target[0] - brush[0]) * viewW) / viewH;
				const dy = target[1] - brush[1];
				const speed = Math.hypot(dx, dy);
				if (!ghosting) radius = clamp(0.046 - speed * 0.5, 0.012, 0.046);
				ink.stroke(brush, target, radius, speed > 1e-5 ? 1 : 0, FADE);
			} else {
				ink.stroke([0, 0], [0, 0], 0.001, 0, FADE);
			}
			brush = target ? [target[0], target[1]] : null;
		}
	}

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min((now - last) / 1000, 0.1);
		last = now;
		const tear = clamp(options.tear(), 0, 1);

		if (reduced) {
			if (!dirty && tear === lastTear) return;
		} else {
			time += dt;
			// Fully torn and nothing left to dry: hold the last frame, spend nothing.
			if (tear >= 1 && lastTear >= 1 && !dirty && phase === "still") return;
			simulate(dt, tear, now);
		}

		const started = performance.now();
		ink.paint(width, height, painting, palette, {
			time,
			tear,
			density: density(dt),
			grain: 0.028,
		});
		lastTear = tear;
		dirty = false;

		// If this machine is struggling, paint a smaller canvas rather than a slower one.
		if (!reduced) {
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
				compose();
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
