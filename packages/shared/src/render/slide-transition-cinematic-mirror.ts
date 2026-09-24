/**
 * `slide-transition-cinematic-mirror` — the "Right" (`invX="1"`) mirror of the
 * seven directional p15 cinematic presets whose default keyframes live in
 * `slide-transition-cinematic` (`fallOver`, `drape`, `wind`, `peelOff`,
 * `pageCurlSingle`, `pageCurlDouble`, `airplane`, `origami` are the eight
 * `P15_INVX_PRESETS`; `wind` already had a mirrored pair and stays there).
 * Split into its own module to keep `slide-transition-cinematic` under the
 * project's per-file LOC budget.
 *
 * `fallOver`'s mirror is COM-measured: `CreateVideo` on a deck authored with
 * `ppEffectFallOverLeft` vs `ppEffectFallOverRight` shows the slide toppling
 * off a hinge anchored at the BOTTOM-LEFT corner (Left) vs BOTTOM-RIGHT corner
 * (Right) - a true horizontal mirror, not a symmetric top-hinge topple. The
 * other six were not individually frame-captured; their mirrors apply the same
 * "flip every horizontal component" rule (negate translateX/rotateY/skewX,
 * swap left<->right transform-origins) that `fallOver`'s measurement confirms
 * is the right general shape for this preset family.
 *
 * @module render/slide-transition-cinematic-mirror
 */

/** Fall Over: COM-measured bottom-right hinge (mirror of the bottom-left default). */
export const FALLOVER_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-fallover-out-right {
	0% { transform: perspective(1400px) rotate3d(1, -1, 0, 0deg) scale(1); transform-origin: bottom right; opacity: 1; }
	55% { transform: perspective(1400px) rotate3d(1, -1, 0, 45deg) scale(.92); transform-origin: bottom right; opacity: .85; }
	100% { transform: perspective(1400px) rotate3d(1, -1, 0, 85deg) scale(.7); transform-origin: bottom right; opacity: 0; }
}
`;

/** Drape: mirrored fabric drape, biased to fall from the right instead of the left. */
export const DRAPE_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-drape-in-right {
	from { transform: perspective(1600px) rotateX(-55deg) rotateZ(4deg) scale(1.15); transform-origin: top right; opacity: 0; }
	to   { transform: perspective(1600px) rotateX(0deg) rotateZ(0deg) scale(1); transform-origin: top right; opacity: 1; }
}
`;

/** Peel Off: mirrored corner (top-left peel instead of top-right). */
export const PEELOFF_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-peeloff-out-right {
	from { transform: perspective(1400px) rotate3d(1, -1, 0, 0deg); transform-origin: top left; opacity: 1; }
	to   { transform: perspective(1400px) rotate3d(1, -1, 0, 110deg); transform-origin: top left; opacity: .15; }
}
`;

/** Page Curl: mirrored curl off the left edge (single fold) / into the right edge (double's incoming fold). */
export const PAGECURL_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-pagecurl-out-right {
	from { transform: perspective(1600px) rotateY(0deg); transform-origin: left center; opacity: 1; }
	to   { transform: perspective(1600px) rotateY(155deg); transform-origin: left center; opacity: .25; }
}
@keyframes pptx-tr-pagecurl-double-in-right {
	from { transform: perspective(1600px) rotateY(-155deg); transform-origin: right center; opacity: .25; }
	to   { transform: perspective(1600px) rotateY(0deg); transform-origin: right center; opacity: 1; }
}
`;

/** Airplane: mirrored flight path, banking away to the left instead of the right. */
export const AIRPLANE_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-airplane-out-right {
	0% { transform: perspective(1200px) translate3d(0, 0, 0) rotate3d(-1, -1, 0, 0deg) scale(1); opacity: 1; }
	40% { transform: perspective(1200px) translate3d(-10%, -10%, 0) rotate3d(-1, -1, 0, 25deg) scale(.85); opacity: 1; }
	100% { transform: perspective(1200px) translate3d(-150%, -70%, 0) rotate3d(-1, -1, 1, 70deg) scale(.05); opacity: 0; }
}
`;

/** Origami: mirrored fold, creasing from the top-right instead of top-left. */
export const ORIGAMI_RIGHT_KEYFRAMES = `
@keyframes pptx-tr-origami-out-right {
	0% { transform: perspective(1400px) rotateX(0deg) rotateZ(0deg) translateY(0) scale(1); transform-origin: top right; opacity: 1; filter: brightness(1); }
	45% { transform: perspective(1400px) rotateX(-52deg) rotateZ(-3deg) translateY(2%) scale(.96); transform-origin: top right; opacity: 1; filter: brightness(.82); }
	70% { transform: perspective(1400px) rotateX(-84deg) rotateZ(-3deg) translateY(8%) scale(.88); transform-origin: top right; opacity: .8; filter: brightness(.68); }
	100% { transform: perspective(1400px) rotateX(-125deg) rotateZ(-3deg) translateY(30%) scale(.68); transform-origin: top right; opacity: 0; filter: brightness(.55); }
}
@keyframes pptx-tr-origami-in-right {
	0% { transform: perspective(1400px) rotateX(62deg) rotateZ(3deg) scale(.94); transform-origin: bottom left; opacity: 0; filter: brightness(.7); }
	30% { transform: perspective(1400px) rotateX(62deg) rotateZ(3deg) scale(.94); transform-origin: bottom left; opacity: .65; filter: brightness(.75); }
	100% { transform: perspective(1400px) rotateX(0deg) rotateZ(0deg) scale(1); transform-origin: bottom left; opacity: 1; filter: brightness(1); }
}
`;

/** All mirrored keyframes concatenated, for one-shot `<style>` injection. */
export const CINEMATIC_MIRROR_KEYFRAMES = `${FALLOVER_RIGHT_KEYFRAMES}\n${DRAPE_RIGHT_KEYFRAMES}\n${PEELOFF_RIGHT_KEYFRAMES}\n${PAGECURL_RIGHT_KEYFRAMES}\n${AIRPLANE_RIGHT_KEYFRAMES}\n${ORIGAMI_RIGHT_KEYFRAMES}`;
