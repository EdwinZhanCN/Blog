/**
 * The painting.
 *
 * One fragment shader, two materials colliding:
 *  - the hand: warped noise thresholded into ink, frayed by dry-brush streaks,
 *    scraped back to paper along ridges, thinned into washes;
 *  - the machine: sheared bands, scanline slips, flat panels, hairlines, blocks.
 *
 * And one rule: nothing is ever drawn inside the void.
 */

export const VERT = /* glsl */ `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const INK_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uSeed;
uniform float uTear;      // 0 = whole, 1 = torn away
uniform float uDensity;   // coverage bias
uniform float uShear;     // band displacement
uniform float uBands;     // band frequency
uniform float uGlitch;    // scanline slips
uniform float uWash;      // grey wash amount
uniform float uReach;     // envelope radius
uniform float uEnv;       // envelope strength
uniform float uGrain;
uniform float uPanels;    // 0..1 machine panels
uniform float uTrailOn;
uniform vec2  uDir;       // band direction (unit)
uniform vec2  uFocus;     // where the mass gathers
uniform vec2  uStretch;   // envelope ellipse
uniform vec3  uVoid;      // xy centre, z radius
uniform vec3  uPaper;
uniform vec3  uInk;
uniform vec3  uMid;
uniform sampler2D uTrail;

out vec4 outColor;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * vn(p); p = m * p; a *= 0.5; }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float px = 1.0 / uRes.y;
  vec2 so = vec2(h11(uSeed * 0.731 + 1.3), h11(uSeed * 1.37 + 7.7)) * 64.0;

  // ── machine: sheared bands ───────────────────────────────────────────────
  vec2 d = uDir;
  vec2 n = vec2(-d.y, d.x);
  float bf = dot(p, n) * uBands + so.x;
  float bid = floor(bf + 0.3 * sin(bf * 2.1 + so.y));
  float br = h11(bid * 1.7 + so.y);
  float moves = step(0.4, br);
  // three interlocking periods, like three guitars that never quite line up
  float period = 7.0 + 4.0 * floor(br * 3.0);
  float pulse = sin(uTime * 6.2831853 / period + br * 40.0);
  float shift = moves * ((br - 0.7) * uShear + 0.008 * pulse);
  float away = h11(bid * 3.1 + so.x);
  shift += (away - 0.5) * uTear * 1.7;
  vec2 q = p + d * shift;

  // ── machine: scanline slips ──────────────────────────────────────────────
  float row = floor(q.y * 46.0 + so.y);
  float rr = h21(vec2(row, floor(so.x)));
  q.x += step(0.87, rr) * (h11(row * 0.37) - 0.5) * 0.12 * uGlitch;

  // ── the ink bends around the void ────────────────────────────────────────
  vec2 vc = uVoid.xy;
  float R = uVoid.z;
  vec2 v = q - vc;
  float dv = length(v);
  float sw = exp(-dv * dv / (R * R * 5.0 + 1e-5));
  float ca = cos(sw * 1.35), sa = sin(sw * 1.35);
  q = vc + mat2(ca, -sa, sa, ca) * v * (1.0 + 0.3 * sw);

  // ── the hand: mass ───────────────────────────────────────────────────────
  float t = uTime * 0.014;
  vec2 w = vec2(fbm(q * 1.25 + so + vec2(0.0, t)),
                fbm(q * 1.25 + so.yx + vec2(5.2, -t)));
  vec2 qq = q * 1.55 + so + 2.1 * (w - 0.5);
  float f = fbm(qq + vec2(t * 0.6, 0.0));
  float env = 1.0 - smoothstep(0.1, uReach, length((q - uFocus) * uStretch));
  float m = f - 0.5 + (env - 0.5) * uEnv + uDensity;
  // each band leaves on its own beat, so the sheet comes apart rather than fading
  float leave = h11(bid * 5.3 + so.y) * 0.5;
  m -= 1.25 * smoothstep(leave, leave + 0.45, uTear);

  // dry brush: edges fray along the stroke
  vec2 sq = vec2(dot(q, d), dot(q, n));
  float streak = vn(sq * vec2(5.0, 150.0) + so) * 0.6 + vn(sq * vec2(11.0, 62.0) + so.yx) * 0.4;
  float edge = 1.0 - smoothstep(0.0, 0.12, abs(m));
  m += (streak - 0.5) * 0.2 * edge;
  m += step(0.86, vn(q * 95.0 + so)) * edge * 0.07;

  // machine: small blocks flip what they touch
  float rowB = floor(p.y * 54.0 + so.x);
  float colB = floor(p.x * mix(7.0, 30.0, h11(rowB * 1.31 + so.y)));
  float block = step(0.962, h21(vec2(colB, rowB) + floor(so)))
              * step(abs(m), 0.03 + 0.07 * uGlitch);

  float aa = clamp(fwidth(m) * 0.75, 0.0015, 0.02);
  float ink = smoothstep(-aa, aa, m);
  ink = mix(ink, 1.0 - ink, block * step(uTear, 0.9));

  // the hand: scrape back to paper, thin into wash
  // (kept crisp: this is paint and paper, never a blur)
  float rid = 1.0 - abs(2.0 * fbm(qq * 2.6 + 9.0) - 1.0);
  float scrape = smoothstep(0.868, 0.88, rid + (streak - 0.5) * 0.3);
  float thin = fbm(qq * 1.1 + 21.0);
  float bristle = vn(sq * vec2(7.0, 250.0) + 3.0) * 0.62 + vn(sq * vec2(19.0, 96.0) + 7.0) * 0.38;
  float lift = 1.0 - clamp((thin - 0.5) * 3.4 * uWash, 0.0, 0.82);
  float dry = smoothstep(lift - 0.015, lift + 0.015, bristle);
  float pool = smoothstep(0.0, 0.006, fbm(qq * 1.7 + 37.0) - 0.675);
  float tone = ink;
  tone *= 1.0 - scrape;
  tone *= 1.0 - dry;
  tone *= 1.0 - pool * 0.76;

  vec3 col = uPaper;

  // ── machine: flat panels ─────────────────────────────────────────────────
  float invert = 0.0;
  float slab = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 r1 = h22(vec2(fi * 7.3 + 1.0, uSeed * 0.37 + fi));
    vec2 r2 = h22(vec2(fi * 3.1 + 9.0, uSeed * 0.91 + fi * 2.0));
    vec2 c = uFocus + (r1 - 0.5) * vec2(0.95, 0.62) / uStretch;
    c += d * uTear * (r2.x - 0.5) * 2.4;
    vec2 hs = vec2(0.02 + 0.15 * r2.x * r2.x, 0.012 + 0.13 * r2.y * r2.y);
    if (r2.x > r2.y) hs.y *= 0.34; else hs.x *= 0.34;
    vec2 pq = p - c;
    if (i >= 4) pq.x -= pq.y * (d.x / max(abs(d.y), 0.35)) * sign(d.y);
    vec2 a = abs(pq) - hs;
    float inside = 1.0 - smoothstep(-px, px, max(a.x, a.y));
    inside *= (1.0 - smoothstep(0.15 + 0.5 * r1.y, 0.3 + 0.5 * r1.y, uTear)) * uPanels;
    if (i < 3) {
      col = mix(col, uMid, inside);
    } else if (i == 3) {
      invert = max(invert, inside);
    } else {
      float g = clamp(0.5 + pq.y / (2.0 * hs.y), 0.0, 1.0);
      slab = max(slab, inside * mix(0.84, 1.0, r1.x > 0.5 ? g : 1.0 - g));
    }
  }

  col = mix(col, uPaper, ink);
  col = mix(col, uInk, tone);
  col = mix(col, uPaper + uInk - col, invert);
  col = mix(col, uInk, slab);

  // ── machine: hairlines and full stops ────────────────────────────────────
  float lines = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float lc = (h11(uSeed * 0.53 + fi * 11.0) - 0.5) * 0.9;
    vec2 lp = p - uFocus;
    float ld = abs(dot(lp, n) - lc);
    float along = dot(lp, d) - (h11(uSeed + fi * 5.0) - 0.5) * 0.6;
    float seg = step(abs(along), 0.12 + 0.45 * h11(uSeed * 1.9 + fi));
    lines = max(lines, (1.0 - smoothstep(px * 0.5, px * 1.5, ld)) * seg);
  }
  lines *= (1.0 - smoothstep(0.05, 0.5, uTear)) * uPanels;
  col = mix(col, uInk, lines * 0.85);

  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 r = h22(vec2(uSeed * 0.77 + fi * 13.0, fi + 4.0));
    vec2 c = uFocus + (r - 0.5) * vec2(0.95, 0.66) / uStretch;
    float rad = 0.006 + 0.01 * h11(uSeed + fi * 3.0);
    float dot_ = 1.0 - smoothstep(rad - px, rad + px, length(p - c));
    col = mix(col, uInk, dot_ * (1.0 - smoothstep(0.1, 0.4, uTear)) * uPanels);
  }

  // ── your hand ────────────────────────────────────────────────────────────
  if (uTrailOn > 0.5) {
    float tr = texture(uTrail, frag / uRes).r;
    float tm = tr - 0.4 + (streak - 0.5) * 0.5 * (1.0 - tr * 0.6);
    float ta = clamp(fwidth(tm) * 0.75, 0.003, 0.03);
    float tink = smoothstep(-ta, ta, tm);
    col = mix(col, uInk, tink * (1.0 - scrape) * (1.0 - smoothstep(0.45, 0.95, uTear)));
  }

  // ── the void: nothing is drawn here, ever ────────────────────────────────
  float vd = length(p - vc) - R;
  col = mix(uPaper, col, smoothstep(-px, px, vd));

  // paper
  col += (h21(frag) - 0.5) * uGrain;
  col += (vn(frag * 0.45) - 0.5) * uGrain * 0.6;

  outColor = vec4(col, 1.0);
}
`;

export const TRAIL_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPrev;
uniform vec2  uTexel;
uniform vec2  uA;
uniform vec2  uB;
uniform float uAspect;
uniform float uRadius;
uniform float uStrength;
uniform float uFade;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  float c = texture(uPrev, uv).r;
  float s = texture(uPrev, uv + vec2(uTexel.x, 0.0)).r
          + texture(uPrev, uv - vec2(uTexel.x, 0.0)).r
          + texture(uPrev, uv + vec2(0.0, uTexel.y)).r
          + texture(uPrev, uv - vec2(0.0, uTexel.y)).r;
  // ink bleeds a little, then dries
  float v = mix(c, s * 0.25, 0.16) - uFade;

  vec2 pa = (uv - uA) * vec2(uAspect, 1.0);
  vec2 ba = (uB - uA) * vec2(uAspect, 1.0);
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float dist = length(pa - ba * h);
  float b = uStrength * (1.0 - smoothstep(uRadius * 0.3, uRadius, dist));

  outColor = vec4(max(v, b), 0.0, 0.0, 1.0);
}
`;
