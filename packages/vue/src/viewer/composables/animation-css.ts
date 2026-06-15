/**
 * `animation-css` — pure mapping from a core animation preset to CSS.
 *
 * Given a high-level {@link PptxElementAnimation} (an entrance / emphasis /
 * exit preset id plus `durationMs` / `delayMs`), this module produces the CSS
 * needed to play that effect:
 *
 *  - {@link resolveAnimationCss} returns the `animation-name` plus an inline
 *    `style` map (`animation-name` / `-duration` / `-delay` / `-fill-mode` /
 *    `-timing-function`) to apply to the rendered element.
 *  - {@link ANIMATION_KEYFRAMES_CSS} is the full set of `@keyframes`
 *    definitions referenced by those animation names, ready to inject once via
 *    a single `<style>` element.
 *
 * The {@link PptxElementAnimation} entrance / exit / emphasis fields carry a
 * {@link PptxAnimationPreset} string (e.g. `"fadeIn"`, `"flyIn"`, `"spin"`),
 * not the editor catalog `entr.N` ids — so this module maps those string
 * presets. Unknown / unmapped presets fall back to a sensible default (fade).
 *
 * This module is intentionally framework-light: it has no Vue imports and is a
 * pure function of its inputs, which keeps it trivially unit-testable and
 * reusable by the playback composable.
 *
 * @module composables/animation-css
 */

import type {
	PptxAnimationPreset,
	PptxAnimationTimingCurve,
	PptxElementAnimation,
} from 'pptx-viewer-core';

/**
 * The kind of effect a {@link PptxElementAnimation} is playing. Determines the
 * default CSS `animation-fill-mode` and the initial (pre-play) visibility.
 */
export type AnimationKind = 'entrance' | 'emphasis' | 'exit';

/**
 * Result of mapping a {@link PptxElementAnimation} to CSS.
 */
export interface AnimationCssResult {
	/** The `@keyframes` name to reference (always present in {@link ANIMATION_KEYFRAMES_CSS}). */
	animationName: string;
	/**
	 * Inline CSS properties to apply to the element. Keys are kebab-case CSS
	 * property names (`animation-name`, `animation-duration`, …) so the map can
	 * be spread directly onto an element `style` object or serialised as-is.
	 */
	style: Record<string, string>;
	/** Which effect bucket this animation belongs to. */
	kind: AnimationKind;
}

/** Prefix applied to every generated `@keyframes` name to avoid collisions. */
const KEYFRAME_PREFIX = 'pptx-vue';

/** Fallback keyframe name used for unknown / unmapped presets. */
const FALLBACK_ENTRANCE = `${KEYFRAME_PREFIX}-fadeIn`;
const FALLBACK_EXIT = `${KEYFRAME_PREFIX}-fadeOut`;
const FALLBACK_EMPHASIS = `${KEYFRAME_PREFIX}-pulse`;

/**
 * Default duration (ms) per effect kind, used when a preset omits `durationMs`.
 * Mirrors PowerPoint's typical defaults.
 */
const DEFAULT_DURATION_MS: Record<AnimationKind, number> = {
	entrance: 500,
	emphasis: 1000,
	exit: 500,
};

/**
 * CSS `animation-fill-mode` per effect kind. Entrance effects hold their final
 * state (`forwards`) so the element stays visible; emphasis effects return to
 * the base state (`none`); exit effects hold their hidden final state.
 */
const FILL_MODE: Record<AnimationKind, string> = {
	entrance: 'forwards',
	emphasis: 'none',
	exit: 'forwards',
};

/**
 * Maps a {@link PptxAnimationTimingCurve} to a CSS `animation-timing-function`.
 */
function timingFunction(curve: PptxAnimationTimingCurve | undefined): string {
	switch (curve) {
		case 'linear':
			return 'linear';
		case 'ease-in':
			return 'ease-in';
		case 'ease-out':
			return 'ease-out';
		case 'ease':
			return 'ease';
		default:
			return 'ease';
	}
}

/**
 * Maps an entrance {@link PptxAnimationPreset} to a keyframe short-name (without
 * the {@link KEYFRAME_PREFIX}). Returns `undefined` for presets that aren't
 * entrance effects so callers can fall back.
 */
function entranceKeyframe(preset: PptxAnimationPreset): string | undefined {
	switch (preset) {
		case 'appear':
			return 'appear';
		case 'fadeIn':
			return 'fadeIn';
		case 'flyIn':
			return 'flyIn';
		case 'zoomIn':
			return 'zoomIn';
		case 'bounceIn':
			return 'bounceIn';
		case 'wipeIn':
			return 'wipeIn';
		case 'splitIn':
			return 'splitIn';
		case 'dissolveIn':
			return 'dissolveIn';
		case 'wheelIn':
			return 'wheelIn';
		case 'blindsIn':
			return 'blindsIn';
		case 'boxIn':
			return 'boxIn';
		case 'floatIn':
			return 'floatIn';
		case 'riseUp':
			return 'riseUp';
		case 'swivel':
			return 'swivel';
		case 'expandIn':
			return 'expandIn';
		case 'checkerboardIn':
			return 'checkerboardIn';
		case 'flashIn':
			return 'flashIn';
		case 'peekIn':
			return 'peekIn';
		case 'randomBarsIn':
			return 'randomBarsIn';
		case 'spinnerIn':
			return 'spinnerIn';
		case 'growTurnIn':
			return 'growTurnIn';
		default:
			return undefined;
	}
}

/**
 * Maps an exit {@link PptxAnimationPreset} to a keyframe short-name.
 */
function exitKeyframe(preset: PptxAnimationPreset): string | undefined {
	switch (preset) {
		case 'disappear':
			return 'disappear';
		case 'fadeOut':
			return 'fadeOut';
		case 'flyOut':
			return 'flyOut';
		case 'zoomOut':
			return 'zoomOut';
		case 'bounceOut':
			return 'bounceOut';
		case 'wipeOut':
			return 'wipeOut';
		case 'shrinkOut':
			return 'shrinkOut';
		case 'dissolveOut':
			return 'dissolveOut';
		default:
			return undefined;
	}
}

/**
 * Maps an emphasis {@link PptxAnimationPreset} to a keyframe short-name.
 */
function emphasisKeyframe(preset: PptxAnimationPreset): string | undefined {
	switch (preset) {
		case 'spin':
			return 'spin';
		case 'pulse':
			return 'pulse';
		case 'colorWave':
			return 'colorWave';
		case 'bounce':
			return 'bounce';
		case 'flash':
			return 'flash';
		case 'growShrink':
			return 'growShrink';
		case 'teeter':
			return 'teeter';
		case 'transparency':
			return 'transparency';
		case 'boldFlash':
			return 'boldFlash';
		case 'wave':
			return 'wave';
		default:
			return undefined;
	}
}

/**
 * Determines the active effect kind + raw preset for an animation. Entrance
 * takes precedence over emphasis, which takes precedence over exit, matching
 * the order PowerPoint plays a single element's first effect.
 */
function activeEffect(
	animation: PptxElementAnimation,
): { kind: AnimationKind; preset: PptxAnimationPreset } | undefined {
	if (animation.entrance && animation.entrance !== 'none') {
		return { kind: 'entrance', preset: animation.entrance };
	}
	if (animation.emphasis && animation.emphasis !== 'none') {
		return { kind: 'emphasis', preset: animation.emphasis };
	}
	if (animation.exit && animation.exit !== 'none') {
		return { kind: 'exit', preset: animation.exit };
	}
	return undefined;
}

/**
 * Resolves the prefixed keyframe name for a `(kind, preset)` pair, falling back
 * to the kind's default (fade for entrance/exit, pulse for emphasis) when the
 * preset isn't recognised.
 */
function resolveKeyframeName(kind: AnimationKind, preset: PptxAnimationPreset): string {
	if (kind === 'entrance') {
		const name = entranceKeyframe(preset);
		return name ? `${KEYFRAME_PREFIX}-${name}` : FALLBACK_ENTRANCE;
	}
	if (kind === 'exit') {
		const name = exitKeyframe(preset);
		return name ? `${KEYFRAME_PREFIX}-${name}` : FALLBACK_EXIT;
	}
	const name = emphasisKeyframe(preset);
	return name ? `${KEYFRAME_PREFIX}-${name}` : FALLBACK_EMPHASIS;
}

/**
 * Maps a single {@link PptxElementAnimation} to the CSS required to play it.
 *
 * The returned {@link AnimationCssResult.style} map is suitable to spread onto
 * an element's inline style. The referenced `animation-name` is always one of
 * the keyframes contained in {@link ANIMATION_KEYFRAMES_CSS}.
 *
 * @example
 * ```ts
 * resolveAnimationCss({ elementId: "t1", entrance: "fadeIn", durationMs: 600 });
 * // => { animationName: "pptx-vue-fadeIn", kind: "entrance",
 * //      style: { "animation-name": "pptx-vue-fadeIn", "animation-duration": "600ms", ... } }
 * ```
 */
export function resolveAnimationCss(
	animation: PptxElementAnimation,
): AnimationCssResult | undefined {
	const effect = activeEffect(animation);
	if (!effect) {
		return undefined;
	}

	const { kind, preset } = effect;
	const animationName = resolveKeyframeName(kind, preset);
	const durationMs = animation.durationMs ?? DEFAULT_DURATION_MS[kind];
	const delayMs = animation.delayMs ?? 0;
	const fillMode = FILL_MODE[kind];
	const timing = timingFunction(animation.timingCurve);

	const repeat = animation.repeatCount;
	const iterationCount =
		repeat === undefined ? '1' : repeat === Infinity ? 'infinite' : String(repeat);

	const style: Record<string, string> = {
		'animation-name': animationName,
		'animation-duration': `${durationMs}ms`,
		'animation-delay': `${delayMs}ms`,
		'animation-timing-function': timing,
		'animation-fill-mode': fillMode,
		'animation-iteration-count': iterationCount,
	};

	return { animationName, style, kind };
}

/**
 * Returns the inline style an element should carry *before* its entrance
 * animation plays — i.e. hidden. Emphasis / exit effects start from the
 * element's normal visible state, so they return an empty map.
 *
 * Useful for pre-seeding elements that have a pending entrance so they don't
 * flash visible for a frame before playback begins.
 */
export function initialHiddenStyle(animation: PptxElementAnimation): Record<string, string> {
	const effect = activeEffect(animation);
	if (effect?.kind === 'entrance') {
		return { opacity: '0' };
	}
	return {};
}

// ==========================================================================
// @keyframes definitions
// ==========================================================================

/**
 * All `@keyframes` blocks referenced by {@link resolveAnimationCss}. Inject this
 * once into a single `<style>` element in the presentation host. Every name is
 * prefixed with `pptx-vue-` to avoid collisions with host-page styles.
 */
export const ANIMATION_KEYFRAMES_CSS = `
/* ── Entrance ── */
@keyframes ${KEYFRAME_PREFIX}-appear {
	from { opacity: 0; }
	to { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-flyIn {
	from { opacity: 0; transform: translateY(40px); }
	to { opacity: 1; transform: translateY(0); }
}
@keyframes ${KEYFRAME_PREFIX}-zoomIn {
	from { opacity: 0; transform: scale(0.3); }
	to { opacity: 1; transform: scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-bounceIn {
	0% { opacity: 0; transform: scale(0.3); }
	50% { opacity: 1; transform: scale(1.08); }
	70% { transform: scale(0.95); }
	100% { opacity: 1; transform: scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-wipeIn {
	from { clip-path: inset(0 100% 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-splitIn {
	from { clip-path: inset(50% 0 50% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-dissolveIn {
	0% { opacity: 0; filter: blur(8px); }
	100% { opacity: 1; filter: blur(0); }
}
@keyframes ${KEYFRAME_PREFIX}-wheelIn {
	from { opacity: 0; transform: rotate(-360deg) scale(0.5); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-blindsIn {
	from { clip-path: inset(0 0 100% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-boxIn {
	from { clip-path: inset(50% 50% 50% 50%); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-floatIn {
	from { opacity: 0; transform: translateY(40px); }
	to { opacity: 1; transform: translateY(0); }
}
@keyframes ${KEYFRAME_PREFIX}-riseUp {
	from { opacity: 0; transform: translateY(60px); }
	to { opacity: 1; transform: translateY(0); }
}
@keyframes ${KEYFRAME_PREFIX}-swivel {
	from { opacity: 0; transform: rotateY(-90deg); }
	to { opacity: 1; transform: rotateY(0deg); }
}
@keyframes ${KEYFRAME_PREFIX}-expandIn {
	from { opacity: 0; transform: scale(0, 0); }
	to { opacity: 1; transform: scale(1, 1); }
}
@keyframes ${KEYFRAME_PREFIX}-checkerboardIn {
	0% { opacity: 0; }
	50% { opacity: 0.5; }
	100% { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-flashIn {
	0% { opacity: 0; }
	25% { opacity: 1; }
	50% { opacity: 0; }
	75% { opacity: 1; }
	100% { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-peekIn {
	from { clip-path: inset(100% 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-randomBarsIn {
	0% { clip-path: inset(0 100% 0 0); opacity: 1; }
	30% { clip-path: inset(0 60% 0 0); opacity: 1; }
	60% { clip-path: inset(0 30% 0 0); opacity: 1; }
	100% { clip-path: inset(0 0 0 0); opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-spinnerIn {
	from { opacity: 0; transform: rotate(-720deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-growTurnIn {
	from { opacity: 0; transform: rotate(-90deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}

/* ── Exit ── */
@keyframes ${KEYFRAME_PREFIX}-disappear {
	from { opacity: 1; }
	to { opacity: 0; }
}
@keyframes ${KEYFRAME_PREFIX}-fadeOut {
	from { opacity: 1; }
	to { opacity: 0; }
}
@keyframes ${KEYFRAME_PREFIX}-flyOut {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(40px); }
}
@keyframes ${KEYFRAME_PREFIX}-zoomOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0.3); }
}
@keyframes ${KEYFRAME_PREFIX}-bounceOut {
	0% { opacity: 1; transform: scale(1); }
	25% { transform: scale(1.08); }
	100% { opacity: 0; transform: scale(0.3); }
}
@keyframes ${KEYFRAME_PREFIX}-wipeOut {
	from { clip-path: inset(0 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 100%); opacity: 0; }
}
@keyframes ${KEYFRAME_PREFIX}-shrinkOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0); }
}
@keyframes ${KEYFRAME_PREFIX}-dissolveOut {
	from { opacity: 1; filter: blur(0); }
	to { opacity: 0; filter: blur(8px); }
}

/* ── Emphasis ── */
@keyframes ${KEYFRAME_PREFIX}-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
@keyframes ${KEYFRAME_PREFIX}-pulse {
	0% { transform: scale(1); }
	25% { transform: scale(1.1); }
	50% { transform: scale(1); }
	75% { transform: scale(1.1); }
	100% { transform: scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-colorWave {
	0% { filter: hue-rotate(0deg); }
	50% { filter: hue-rotate(180deg); }
	100% { filter: hue-rotate(360deg); }
}
@keyframes ${KEYFRAME_PREFIX}-bounce {
	0% { transform: translateY(0); }
	20% { transform: translateY(-20px); }
	40% { transform: translateY(0); }
	60% { transform: translateY(-10px); }
	80% { transform: translateY(0); }
	100% { transform: translateY(0); }
}
@keyframes ${KEYFRAME_PREFIX}-flash {
	0% { opacity: 1; }
	25% { opacity: 0; }
	50% { opacity: 1; }
	75% { opacity: 0; }
	100% { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-growShrink {
	0% { transform: scale(1); }
	50% { transform: scale(1.25); }
	100% { transform: scale(1); }
}
@keyframes ${KEYFRAME_PREFIX}-teeter {
	0% { transform: rotate(0deg); }
	25% { transform: rotate(5deg); }
	50% { transform: rotate(0deg); }
	75% { transform: rotate(-5deg); }
	100% { transform: rotate(0deg); }
}
@keyframes ${KEYFRAME_PREFIX}-transparency {
	0% { opacity: 1; }
	50% { opacity: 0.4; }
	100% { opacity: 1; }
}
@keyframes ${KEYFRAME_PREFIX}-boldFlash {
	0% { font-weight: inherit; }
	25% { font-weight: 900; }
	50% { font-weight: inherit; }
	75% { font-weight: 900; }
	100% { font-weight: inherit; }
}
@keyframes ${KEYFRAME_PREFIX}-wave {
	0% { transform: translateY(0); }
	25% { transform: translateY(-8px); }
	50% { transform: translateY(0); }
	75% { transform: translateY(8px); }
	100% { transform: translateY(0); }
}
`.trim();
