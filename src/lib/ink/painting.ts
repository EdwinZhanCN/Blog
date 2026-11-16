import type { Painting, Palette, RGB } from "./core";

/** Stable 32-bit hash of a string (FNV-1a). The same slug always paints the same picture. */
export function hashString(value: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Fold any integer into the range the shader is comfortable with. */
export function toSeed(value: number) {
	return (Math.abs(Math.floor(value)) % 99991) + 1;
}

/** Small deterministic generator so every decision below follows from the seed. */
function mulberry(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const DIAGONAL = Math.SQRT1_2;

/**
 * A painting's temperament, drawn from its seed:
 * which way it shears, how violently, how much of it is machine.
 */
function temperament(seed: number) {
	const random = mulberry(seed * 2654435761);
	const roll = random();
	// Mostly diagonal — rising or falling — and now and then flat, like a scanline.
	const dir: [number, number] =
		roll < 0.44 ? [DIAGONAL, DIAGONAL] : roll < 0.84 ? [DIAGONAL, -DIAGONAL] : [1, 0];
	return {
		random,
		dir,
		bands: 5 + random() * 9,
		shear: 0.18 + random() * 0.42,
		glitch: 0.35 + random() * 0.65,
		wash: 0.35 + random() * 0.65,
		panels: random() < 0.88 ? 1 : 0,
	};
}

/** The square painting that belongs to a post or a series. */
export function coverPainting(seed: number): Painting {
	const { random, ...rest } = temperament(seed);
	const voidRadius = 0.085 + random() * 0.075;
	const voidX = (random() - 0.5) * 0.36;
	const voidY = (random() - 0.5) * 0.36;
	return {
		seed,
		...rest,
		reach: 0.62 + random() * 0.16,
		env: 0.62,
		focus: [voidX * 0.35, voidY * 0.35],
		stretch: [1, 1],
		void: [voidX, voidY, voidRadius],
	};
}

/** What the seed decides about the live painting. The page decides the rest as it scrolls. */
export type FieldCharacter = Pick<
	Painting,
	"seed" | "dir" | "bands" | "shear" | "glitch" | "wash" | "panels"
> & {
	/** A little more or less reach, so two visits never gather quite the same mass. */
	spread: number;
};

/** The live painting behind a page. Both materials are always present: that is its subject. */
export function fieldCharacter(seed: number, portrait: boolean): FieldCharacter {
	const { random, ...rest } = temperament(seed);
	return {
		seed,
		...rest,
		bands: rest.bands * (portrait ? 0.8 : 1),
		panels: 1,
		spread: portrait ? 0 : random() * 0.07,
	};
}

function parseColor(value: string): RGB {
	const hex = value.trim().replace("#", "");
	if (hex.length === 3) {
		return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16) / 255) as RGB;
	}
	return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as RGB;
}

/** Read the three colours of the current theme straight from the stylesheet. */
export function readPalette(): Palette {
	const style = getComputedStyle(document.documentElement);
	return {
		paper: parseColor(style.getPropertyValue("--paper")),
		ink: parseColor(style.getPropertyValue("--ink")),
		mid: parseColor(style.getPropertyValue("--mid")),
	};
}

export function currentTheme() {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
