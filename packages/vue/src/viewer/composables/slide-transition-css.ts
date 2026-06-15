/**
 * `slide-transition-css` — pure mapping from a {@link PptxSlideTransition}
 * (type + duration + direction/orientation) to the CSS animation pieces used by
 * {@link PresentationTransitionOverlay} during a slide change in presentation
 * mode.
 *
 * This mirrors the React `transition-keyframes` / `transition-helpers` /
 * `transition-resolver` trio, collapsed into one framework-agnostic module:
 *
 *  - {@link SLIDE_TRANSITION_KEYFRAMES_CSS} is the full `@keyframes` block. The
 *    overlay injects it once via a `<style>` element (mirroring how
 *    `PresentationMode` injects `ANIMATION_KEYFRAMES_CSS`).
 *  - {@link getSlideTransitionAnimations} resolves a transition to the
 *    `animation` shorthand strings for the outgoing (old) and incoming (new)
 *    slide layers, plus whether the outgoing layer sits on top.
 *
 * Everything here is pure and unit-testable: no Vue imports, no DOM access.
 *
 * @module composables/slide-transition-css
 */

import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

/** Resolved CSS `animation` shorthands for the two transition layers. */
export interface SlideTransitionAnimations {
	/** CSS `animation` value for the outgoing (old) slide layer, or `'none'`. */
	outgoing: string;
	/** CSS `animation` value for the incoming (new) slide layer, or `'none'`. */
	incoming: string;
	/** Whether the outgoing layer should render above the incoming layer. */
	outgoingOnTop: boolean;
}

// ---------------------------------------------------------------------------
// Direction resolution
// ---------------------------------------------------------------------------

/** The four cardinal directions a transition can resolve to. */
export type ResolvedDirection = 'left' | 'right' | 'up' | 'down';

/** Cardinal directions plus the four diagonals (for cover/uncover/strips). */
export type ResolvedDirection8 = ResolvedDirection | 'lu' | 'ld' | 'ru' | 'rd';

/** Map an OOXML `dir` token (`l`/`r`/`u`/`d`) to a cardinal direction. */
export function resolveDirection(
	direction: string | undefined,
	defaultDir: ResolvedDirection,
): ResolvedDirection {
	switch (direction) {
		case 'l':
			return 'left';
		case 'r':
			return 'right';
		case 'u':
			return 'up';
		case 'd':
			return 'down';
		default:
			return defaultDir;
	}
}

/** Map an OOXML `dir` token to a cardinal **or diagonal** direction. */
export function resolveDirection8(
	direction: string | undefined,
	defaultDir: ResolvedDirection,
): ResolvedDirection8 {
	switch (direction) {
		case 'l':
			return 'left';
		case 'r':
			return 'right';
		case 'u':
			return 'up';
		case 'd':
			return 'down';
		case 'lu':
		case 'ld':
		case 'ru':
		case 'rd':
			return direction;
		default:
			return defaultDir;
	}
}

/** Resolve an orientation from the `orient` or `direction` attribute. */
export function resolveOrientation(
	direction: string | undefined,
	orient: string | undefined,
): 'horz' | 'vert' {
	if (orient === 'horz' || orient === 'vert') {
		return orient;
	}
	if (direction === 'horz' || direction === 'vert') {
		return direction;
	}
	return 'horz';
}

/** Transition types eligible for `random` selection (kept deterministic-light). */
export const RANDOM_ELIGIBLE_TYPES: readonly PptxTransitionType[] = [
	'fade',
	'push',
	'wipe',
	'cover',
	'dissolve',
	'circle',
	'zoom',
];

/** No-animation sentinel — used for `none`/`cut` (instant slide swap). */
export const INSTANT: SlideTransitionAnimations = {
	outgoing: 'none',
	incoming: 'none',
	outgoingOnTop: true,
};

// ---------------------------------------------------------------------------
// CSS @keyframes (injected once via a <style> element by the overlay)
// ---------------------------------------------------------------------------

/**
 * The full `@keyframes` block backing every resolved transition. Inject it once
 * per overlay (the same pattern `PresentationMode` uses for
 * `ANIMATION_KEYFRAMES_CSS`). Keyframe names are `pptx-tr-*`-prefixed so they
 * never collide with the element-animation keyframes (`pptx-anim-*`).
 */
export const SLIDE_TRANSITION_KEYFRAMES_CSS = `
/* ── Fade ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-fade-in {
	from { opacity: 0; }
	to   { opacity: 1; }
}
@keyframes pptx-tr-fade-out {
	from { opacity: 1; }
	to   { opacity: 0; }
}

/* ── Push ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-push-in-from-right {
	from { transform: translateX(100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-push-out-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-push-in-from-left {
	from { transform: translateX(-100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-push-out-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-push-in-from-bottom {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-push-out-to-top {
	from { transform: translateY(0); }
	to   { transform: translateY(-100%); }
}
@keyframes pptx-tr-push-in-from-top {
	from { transform: translateY(-100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-push-out-to-bottom {
	from { transform: translateY(0); }
	to   { transform: translateY(100%); }
}

/* ── Cover (incoming slides over stationary outgoing) ───────────────── */
@keyframes pptx-tr-cover-from-right {
	from { transform: translateX(100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-cover-from-left {
	from { transform: translateX(-100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-cover-from-bottom {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-cover-from-top {
	from { transform: translateY(-100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-cover-from-lu {
	from { transform: translate(-100%, -100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-ld {
	from { transform: translate(-100%, 100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-ru {
	from { transform: translate(100%, -100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-rd {
	from { transform: translate(100%, 100%); }
	to   { transform: translate(0, 0); }
}

/* ── Uncover (outgoing slides away revealing stationary incoming) ──── */
@keyframes pptx-tr-uncover-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-uncover-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-uncover-to-top {
	from { transform: translateY(0); }
	to   { transform: translateY(-100%); }
}
@keyframes pptx-tr-uncover-to-bottom {
	from { transform: translateY(0); }
	to   { transform: translateY(100%); }
}
@keyframes pptx-tr-uncover-to-lu {
	from { transform: translate(0, 0); }
	to   { transform: translate(-100%, -100%); }
}
@keyframes pptx-tr-uncover-to-ld {
	from { transform: translate(0, 0); }
	to   { transform: translate(-100%, 100%); }
}
@keyframes pptx-tr-uncover-to-ru {
	from { transform: translate(0, 0); }
	to   { transform: translate(100%, -100%); }
}
@keyframes pptx-tr-uncover-to-rd {
	from { transform: translate(0, 0); }
	to   { transform: translate(100%, 100%); }
}

/* ── Wipe (clip-path reveal) ────────────────────────────────────────── */
@keyframes pptx-tr-wipe-from-left {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-right {
	from { clip-path: inset(0 0 0 100%); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-top {
	from { clip-path: inset(0 0 100% 0); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-bottom {
	from { clip-path: inset(100% 0 0 0); }
	to   { clip-path: inset(0 0 0 0); }
}

/* ── Split ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-split-h-out {
	from { clip-path: inset(0 50%); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-split-v-out {
	from { clip-path: inset(50% 0); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-split-h-in {
	from { clip-path: inset(0 0); }
	to   { clip-path: inset(0 50%); }
}
@keyframes pptx-tr-split-v-in {
	from { clip-path: inset(0 0); }
	to   { clip-path: inset(50% 0); }
}

/* ── Dissolve ───────────────────────────────────────────────────────── */
@keyframes pptx-tr-dissolve-in {
	from { opacity: 0; filter: blur(4px); }
	to   { opacity: 1; filter: blur(0px); }
}

/* ── Circle / Diamond / Plus (clip-path shapes) ─────────────────────── */
@keyframes pptx-tr-circle-in {
	from { clip-path: circle(0% at 50% 50%); }
	to   { clip-path: circle(75% at 50% 50%); }
}
@keyframes pptx-tr-diamond-in {
	from { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
	to   { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
}
@keyframes pptx-tr-plus-in {
	from {
		clip-path: polygon(
			50% 50%, 50% 50%, 50% 50%, 50% 50%,
			50% 50%, 50% 50%, 50% 50%, 50% 50%,
			50% 50%, 50% 50%, 50% 50%, 50% 50%
		);
	}
	to {
		clip-path: polygon(
			33% 0%, 66% 0%, 66% 33%, 100% 33%,
			100% 66%, 66% 66%, 66% 100%, 33% 100%,
			33% 66%, 0% 66%, 0% 33%, 33% 33%
		);
	}
}

/* ── Wedge ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-wedge-in {
	from { clip-path: polygon(50% 0%, 50% 0%, 50% 0%); }
	to   { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
}

/* ── Zoom ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-zoom-in {
	from { transform: scale(0); opacity: 0; }
	to   { transform: scale(1); opacity: 1; }
}
@keyframes pptx-tr-zoom-out {
	from { transform: scale(1); opacity: 1; }
	to   { transform: scale(2); opacity: 0; }
}

/* ── Blinds ─────────────────────────────────────────────────────────── */
@keyframes pptx-tr-blinds-h {
	from { clip-path: inset(0 0 100% 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-blinds-v {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}

/* ── Checker (approximate with dissolve + contrast) ─────────────────── */
@keyframes pptx-tr-checker-in {
	from { opacity: 0; filter: contrast(2) blur(2px); }
	to   { opacity: 1; filter: contrast(1) blur(0); }
}

/* ── Comb ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-comb-h {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-comb-v {
	from { clip-path: inset(100% 0 0 0); }
	to   { clip-path: inset(0); }
}

/* ── Strips (diagonal) ──────────────────────────────────────────────── */
@keyframes pptx-tr-strips-lu {
	from { clip-path: polygon(0% 0%, 0% 0%, 0% 0%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-ld {
	from { clip-path: polygon(0% 100%, 0% 100%, 0% 100%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-ru {
	from { clip-path: polygon(100% 0%, 100% 0%, 100% 0%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-rd {
	from { clip-path: polygon(100% 100%, 100% 100%, 100% 100%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}

/* ── RandomBar ──────────────────────────────────────────────────────── */
@keyframes pptx-tr-randombar-h {
	from { opacity: 0; clip-path: inset(0 0 100% 0); }
	to   { opacity: 1; clip-path: inset(0); }
}
@keyframes pptx-tr-randombar-v {
	from { opacity: 0; clip-path: inset(0 100% 0 0); }
	to   { opacity: 1; clip-path: inset(0); }
}

/* ── Newsflash ──────────────────────────────────────────────────────── */
@keyframes pptx-tr-newsflash-in {
	from { transform: rotate(720deg) scale(0); opacity: 0; }
	to   { transform: rotate(0deg) scale(1); opacity: 1; }
}

/* ── Wheel ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-wheel-in {
	from { clip-path: circle(0% at 50% 50%); transform: rotate(-180deg); }
	to   { clip-path: circle(75% at 50% 50%); transform: rotate(0deg); }
}
`;

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/** Default transition duration (ms) when the transition omits `durationMs`. */
export const DEFAULT_TRANSITION_DURATION_MS = 1000;

/** Easing applied to every transition animation. */
const EASE = 'ease-in-out';

/**
 * Map a {@link PptxTransitionType} (+ duration/direction/orient/spokes) to the
 * concrete CSS `animation` descriptors for the outgoing and incoming layers.
 *
 * Unknown types fall back to a symmetrical cross-fade.
 */
export function getSlideTransitionAnimations(
	type: PptxTransitionType,
	durationMs: number,
	direction: string | undefined,
	orient?: string | undefined,
	spokes?: number | undefined,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	// `spokes` is reserved for future wheel spoke-count support; forwarded only
	// through recursive calls (random/pull).
	void spokes;

	switch (type) {
		case 'none':
		case 'cut':
			return INSTANT;

		case 'fade':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'push': {
			const dir = resolveDirection(direction, 'left');
			const configs: Record<ResolvedDirection, SlideTransitionAnimations> = {
				left: {
					outgoing: `pptx-tr-push-out-to-left ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-right ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				right: {
					outgoing: `pptx-tr-push-out-to-right ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-left ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				up: {
					outgoing: `pptx-tr-push-out-to-top ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-bottom ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				down: {
					outgoing: `pptx-tr-push-out-to-bottom ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-top ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
			};
			return configs[dir];
		}

		case 'wipe': {
			const dir = resolveDirection(direction, 'left');
			const wipeNames: Record<ResolvedDirection, string> = {
				left: `pptx-tr-wipe-from-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-wipe-from-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-wipe-from-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-wipe-from-bottom ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: wipeNames[dir],
				outgoingOnTop: false,
			};
		}

		case 'cover': {
			const dir = resolveDirection8(direction, 'left');
			const coverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-cover-from-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-cover-from-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-cover-from-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-cover-from-bottom ${dur} ${EASE} forwards`,
				lu: `pptx-tr-cover-from-lu ${dur} ${EASE} forwards`,
				ld: `pptx-tr-cover-from-ld ${dur} ${EASE} forwards`,
				ru: `pptx-tr-cover-from-ru ${dur} ${EASE} forwards`,
				rd: `pptx-tr-cover-from-rd ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: coverMap[dir],
				outgoingOnTop: false,
			};
		}

		case 'uncover': {
			const dir = resolveDirection8(direction, 'left');
			const uncoverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-uncover-to-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-uncover-to-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-uncover-to-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-uncover-to-bottom ${dur} ${EASE} forwards`,
				lu: `pptx-tr-uncover-to-lu ${dur} ${EASE} forwards`,
				ld: `pptx-tr-uncover-to-ld ${dur} ${EASE} forwards`,
				ru: `pptx-tr-uncover-to-ru ${dur} ${EASE} forwards`,
				rd: `pptx-tr-uncover-to-rd ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: uncoverMap[dir],
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		case 'split': {
			const o = resolveOrientation(undefined, orient);
			const isOut = direction !== 'in';
			if (isOut) {
				return {
					outgoing: 'none',
					incoming:
						o === 'vert'
							? `pptx-tr-split-v-out ${dur} ${EASE} forwards`
							: `pptx-tr-split-h-out ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				};
			}
			return {
				outgoing:
					o === 'vert'
						? `pptx-tr-split-v-in ${dur} ${EASE} forwards`
						: `pptx-tr-split-h-in ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		case 'dissolve':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-dissolve-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'circle':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-circle-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'diamond':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-diamond-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'plus':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-plus-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'wedge':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wedge-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'wheel':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wheel-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};

		case 'zoom':
			return {
				outgoing: `pptx-tr-zoom-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-zoom-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'blinds': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-blinds-v ${dur} ${EASE} forwards`
						: `pptx-tr-blinds-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'checker':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-checker-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'comb': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-comb-v ${dur} ${EASE} forwards`
						: `pptx-tr-comb-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'strips': {
			const stripDir =
				direction === 'lu' || direction === 'ld' || direction === 'ru' || direction === 'rd'
					? direction
					: 'lu';
			return {
				outgoing: 'none',
				incoming: `pptx-tr-strips-${stripDir} ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'randomBar': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-randombar-v ${dur} ${EASE} forwards`
						: `pptx-tr-randombar-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'newsflash':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-newsflash-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};

		// `pull` is the directional alias of `uncover`.
		case 'pull':
			return getSlideTransitionAnimations('uncover', durationMs, direction, orient, spokes);

		case 'random': {
			const randomType =
				RANDOM_ELIGIBLE_TYPES[Math.floor(Math.random() * RANDOM_ELIGIBLE_TYPES.length)];
			return getSlideTransitionAnimations(randomType, durationMs, direction, orient, spokes);
		}

		// `morph` and every other (3D / cinematic) effect we don't model with a
		// dedicated keyframe fall back to a symmetrical cross-fade.
		default:
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};
	}
}

/**
 * Convenience wrapper that reads everything off a {@link PptxSlideTransition},
 * applying the default duration when none is set. `none`/`cut` and a transition
 * with a non-positive duration resolve to {@link INSTANT}.
 */
export function resolveSlideTransition(
	transition: PptxSlideTransition | undefined,
): SlideTransitionAnimations {
	if (!transition || transition.type === 'none' || transition.type === 'cut') {
		return INSTANT;
	}
	const durationMs =
		typeof transition.durationMs === 'number' && transition.durationMs > 0
			? transition.durationMs
			: DEFAULT_TRANSITION_DURATION_MS;
	return getSlideTransitionAnimations(
		transition.type,
		durationMs,
		transition.direction,
		transition.orient,
		transition.spokes,
	);
}

/**
 * The effective duration (ms) for a transition — the configured `durationMs`,
 * or {@link DEFAULT_TRANSITION_DURATION_MS} when unset/invalid. `none`/`cut`
 * resolve to `0` (instant).
 */
export function resolveTransitionDurationMs(transition: PptxSlideTransition | undefined): number {
	if (!transition || transition.type === 'none' || transition.type === 'cut') {
		return 0;
	}
	return typeof transition.durationMs === 'number' && transition.durationMs > 0
		? transition.durationMs
		: DEFAULT_TRANSITION_DURATION_MS;
}
