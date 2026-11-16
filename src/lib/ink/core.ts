import { INK_FRAG, TRAIL_FRAG, VERT } from "./glsl";

export type RGB = [number, number, number];

export type Palette = { paper: RGB; ink: RGB; mid: RGB };

/** Everything that makes one painting different from another. */
export type Painting = {
	seed: number;
	dir: [number, number];
	bands: number;
	shear: number;
	glitch: number;
	wash: number;
	reach: number;
	env: number;
	panels: number;
	focus: [number, number];
	stretch: [number, number];
	/** centre x, centre y, radius — in the shader's space (height = 1). */
	void: [number, number, number];
};

export type Frame = {
	time: number;
	tear: number;
	density: number;
	grain: number;
	/** How far the hand's plane and the machine's plane have travelled (height = 1). A still painting leaves them out. */
	hand?: [number, number];
	machine?: [number, number];
	/** The machine's plane repeats this often. */
	period?: number;
};

const U_INK = [
	"uRes", "uTime", "uSeed", "uTear", "uDensity", "uShear", "uBands", "uGlitch", "uWash",
	"uReach", "uEnv", "uGrain", "uPanels", "uTrailOn", "uDir", "uFocus", "uStretch", "uVoid",
	"uHand", "uMach", "uPeriod", "uPaper", "uInk", "uMid", "uTrail",
] as const;

const U_TRAIL = [
	"uPrev", "uTexel", "uA", "uB", "uAspect", "uRadius", "uStrength", "uFade", "uShift",
] as const;

const REST: [number, number] = [0, 0];

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`ink: shader failed to compile\n${log}`);
	}
	return shader;
}

function link<T extends string>(gl: WebGL2RenderingContext, frag: string, names: readonly T[]) {
	const program = gl.createProgram()!;
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
	gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
	gl.bindAttribLocation(program, 0, "a");
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(`ink: program failed to link\n${gl.getProgramInfoLog(program)}`);
	}
	const u = {} as Record<T, WebGLUniformLocation | null>;
	for (const name of names) u[name] = gl.getUniformLocation(program, name);
	return { program, u };
}

type Target = { texture: WebGLTexture; fbo: WebGLFramebuffer };

export class Ink {
	readonly gl: WebGL2RenderingContext;
	private ink;
	private trail;
	private vao: WebGLVertexArrayObject;
	private targets: [Target, Target] | null = null;
	private trailSize: [number, number] = [0, 0];
	private blank: WebGLTexture;

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
		const gl = canvas.getContext("webgl2", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: "high-performance",
			preserveDrawingBuffer: false,
		}) as WebGL2RenderingContext | null;
		if (!gl) throw new Error("ink: WebGL2 is not available");
		this.gl = gl;

		this.ink = link(gl, INK_FRAG, U_INK);
		this.trail = link(gl, TRAIL_FRAG, U_TRAIL);

		this.vao = gl.createVertexArray()!;
		gl.bindVertexArray(this.vao);
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		this.blank = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, this.blank);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
	}

	private makeTarget(width: number, height: number): Target {
		const { gl } = this;
		const texture = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return { texture, fbo };
	}

	/** Allocate (or reallocate) the surface the visitor's strokes live on. */
	resizeTrail(width: number, height: number) {
		const { gl } = this;
		if (this.targets) {
			for (const target of this.targets) {
				gl.deleteTexture(target.texture);
				gl.deleteFramebuffer(target.fbo);
			}
		}
		this.trailSize = [width, height];
		this.targets = [this.makeTarget(width, height), this.makeTarget(width, height)];
	}

	/**
	 * Lay one segment of ink down and let everything already there dry a little.
	 * `shift` carries the whole sheet along, in whole texels, when the hand's plane has moved.
	 */
	stroke(
		a: [number, number],
		b: [number, number],
		radius: number,
		strength: number,
		fade: number,
		shift: [number, number] = REST,
	) {
		if (!this.targets) return;
		const { gl } = this;
		const [width, height] = this.trailSize;
		const [read, write] = this.targets;
		gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
		gl.viewport(0, 0, width, height);
		gl.useProgram(this.trail.program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, read.texture);
		const u = this.trail.u;
		gl.uniform1i(u.uPrev, 0);
		gl.uniform2f(u.uTexel, 1 / width, 1 / height);
		gl.uniform2f(u.uA, a[0], a[1]);
		gl.uniform2f(u.uB, b[0], b[1]);
		gl.uniform1f(u.uAspect, width / height);
		gl.uniform1f(u.uRadius, radius);
		gl.uniform1f(u.uStrength, strength);
		gl.uniform1f(u.uFade, fade);
		gl.uniform2f(u.uShift, shift[0], shift[1]);
		gl.bindVertexArray(this.vao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		this.targets = [write, read];
	}

	paint(width: number, height: number, painting: Painting, palette: Palette, frame: Frame) {
		const { gl } = this;
		const u = this.ink.u;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, width, height);
		gl.useProgram(this.ink.program);
		gl.uniform2f(u.uRes, width, height);
		gl.uniform1f(u.uTime, frame.time);
		gl.uniform1f(u.uSeed, painting.seed);
		gl.uniform1f(u.uTear, frame.tear);
		gl.uniform1f(u.uDensity, frame.density);
		gl.uniform1f(u.uShear, painting.shear);
		gl.uniform1f(u.uBands, painting.bands);
		gl.uniform1f(u.uGlitch, painting.glitch);
		gl.uniform1f(u.uWash, painting.wash);
		gl.uniform1f(u.uReach, painting.reach);
		gl.uniform1f(u.uEnv, painting.env);
		gl.uniform1f(u.uGrain, frame.grain);
		gl.uniform1f(u.uPanels, painting.panels);
		gl.uniform2f(u.uDir, painting.dir[0], painting.dir[1]);
		gl.uniform2f(u.uFocus, painting.focus[0], painting.focus[1]);
		gl.uniform2f(u.uStretch, painting.stretch[0], painting.stretch[1]);
		gl.uniform3f(u.uVoid, painting.void[0], painting.void[1], painting.void[2]);
		const hand = frame.hand ?? REST;
		const machine = frame.machine ?? REST;
		gl.uniform2f(u.uHand, hand[0], hand[1]);
		gl.uniform2f(u.uMach, machine[0], machine[1]);
		gl.uniform1f(u.uPeriod, frame.period ?? 4);
		gl.uniform3f(u.uPaper, ...palette.paper);
		gl.uniform3f(u.uInk, ...palette.ink);
		gl.uniform3f(u.uMid, ...palette.mid);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.targets ? this.targets[0].texture : this.blank);
		gl.uniform1i(u.uTrail, 0);
		gl.uniform1f(u.uTrailOn, this.targets ? 1 : 0);
		gl.bindVertexArray(this.vao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	destroy() {
		this.gl.getExtension("WEBGL_lose_context")?.loseContext();
	}
}
