/**
 * transition-helpers.ts
 *
 * Pure logic for mapping a PowerPoint slide transition (`PptxSlideTransition`
 * / `PptxTransitionType` from `pptx-viewer-core`) to concrete CSS animation
 * descriptors for the outgoing (old) and incoming (new) slide layers.
 *
 * Angular port of the React `utils/transition-keyframes.ts`,
 * `utils/transition-helpers.ts`, and `utils/transition-resolver.ts`. Kept
 * framework-free so it can be unit-tested without TestBed (vitest + happy-dom).
 *
 * The CSS `@keyframes` block (`SLIDE_TRANSITION_KEYFRAMES`) is injected once by
 * `PresentationTransitionOverlayComponent` so the named animations resolve.
 *
 * ng-packagr lib-target constraints respected here:
 *   - no `String.prototype.replaceAll`
 *   - no regex named-capture-groups (no regexes used at all)
 */
import type { PptxTransitionType } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideTransitionAnimations {
	/** CSS animation string for the outgoing (old) slide layer. */
	outgoing: string;
	/** CSS animation string for the incoming (new) slide layer. */
	incoming: string;
	/** Whether the outgoing layer should render on top of the incoming layer. */
	outgoingOnTop: boolean;
}

/** Cardinal direction resolved from an OOXML `@_dir` token. */
export type ResolvedDirection = 'left' | 'right' | 'up' | 'down';

/** Cardinal + diagonal direction (cover / uncover). */
export type ResolvedDirection8 = ResolvedDirection | 'lu' | 'ld' | 'ru' | 'rd';

// ---------------------------------------------------------------------------
// Direction resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve an OOXML 4-way direction token (`l`/`r`/`u`/`d`) to a cardinal
 * direction, falling back to `defaultDir` for unknown/undefined input.
 */
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

/**
 * Resolve an OOXML 8-way direction token (cardinal + diagonals
 * `lu`/`ld`/`ru`/`rd`), falling back to `defaultDir` for unknown input.
 */
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

/**
 * Resolve transition orientation from the `orient` or `direction` token.
 * Prefers `orient`, then `direction`, defaulting to `'horz'`.
 */
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Transition types eligible for `random` selection (excludes none/cut/random). */
export const RANDOM_ELIGIBLE_TYPES: PptxTransitionType[] = [
	'fade',
	'push',
	'wipe',
	'cover',
	'dissolve',
	'circle',
	'zoom',
];

/** No-animation sentinel (used for `none` / `cut`). */
export const INSTANT: SlideTransitionAnimations = {
	outgoing: 'none',
	incoming: 'none',
	outgoingOnTop: true,
};

/**
 * Floor applied to the transition duration so very short authored durations
 * still produce a visible animation. Mirrors the React presentation hook.
 */
export const MIN_TRANSITION_DURATION_MS = 120;

/** Fallback transition duration when the slide declares none. */
export const DEFAULT_TRANSITION_DURATION_MS = 320;

/**
 * Resolve the effective transition duration (ms) from an optional authored
 * value, applying the minimum floor and a sensible default. Mirrors the React
 * `executeSlideTransition` clamping (`Math.max(120, durationMs || 320)`).
 */
export function resolveTransitionDuration(durationMs: number | undefined): number {
	const raw =
		typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
			? durationMs
			: DEFAULT_TRANSITION_DURATION_MS;
	return Math.max(MIN_TRANSITION_DURATION_MS, raw);
}

// ---------------------------------------------------------------------------
// CSS @keyframes (injected once via a <style> element)
// ---------------------------------------------------------------------------

export const SLIDE_TRANSITION_KEYFRAMES = `
/* Fade */
@keyframes pptx-tr-fade-in {
	from { opacity: 0; }
	to   { opacity: 1; }
}
@keyframes pptx-tr-fade-out {
	from { opacity: 1; }
	to   { opacity: 0; }
}

/* Push */
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

/* Cover (incoming slides over stationary outgoing) */
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

/* Uncover (outgoing slides away revealing stationary incoming) */
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

/* Wipe (clip-path reveal) */
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

/* Split */
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

/* Dissolve */
@keyframes pptx-tr-dissolve-in {
	from { opacity: 0; filter: blur(4px); }
	to   { opacity: 1; filter: blur(0px); }
}

/* Circle / Diamond / Plus (clip-path shapes) */
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

/* Wedge */
@keyframes pptx-tr-wedge-in {
	from { clip-path: polygon(50% 0%, 50% 0%, 50% 0%); }
	to   { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
}

/* Zoom */
@keyframes pptx-tr-zoom-in {
	from { transform: scale(0); opacity: 0; }
	to   { transform: scale(1); opacity: 1; }
}
@keyframes pptx-tr-zoom-out {
	from { transform: scale(1); opacity: 1; }
	to   { transform: scale(2); opacity: 0; }
}

/* Blinds */
@keyframes pptx-tr-blinds-h {
	from { clip-path: inset(0 0 100% 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-blinds-v {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}

/* Checker (approximate with dissolve + contrast) */
@keyframes pptx-tr-checker-in {
	from { opacity: 0; filter: contrast(2) blur(2px); }
	to   { opacity: 1; filter: contrast(1) blur(0); }
}

/* Comb */
@keyframes pptx-tr-comb-h {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-comb-v {
	from { clip-path: inset(100% 0 0 0); }
	to   { clip-path: inset(0); }
}

/* Strips (diagonal) */
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

/* RandomBar */
@keyframes pptx-tr-randombar-h {
	from { opacity: 0; clip-path: inset(0 0 100% 0); }
	to   { opacity: 1; clip-path: inset(0); }
}
@keyframes pptx-tr-randombar-v {
	from { opacity: 0; clip-path: inset(0 100% 0 0); }
	to   { opacity: 1; clip-path: inset(0); }
}

/* Newsflash */
@keyframes pptx-tr-newsflash-in {
	from { transform: rotate(720deg) scale(0); opacity: 0; }
	to   { transform: rotate(0deg) scale(1); opacity: 1; }
}

/* Wheel */
@keyframes pptx-tr-wheel-in {
	from { clip-path: circle(0% at 50% 50%); transform: rotate(-180deg); }
	to   { clip-path: circle(75% at 50% 50%); transform: rotate(0deg); }
}
`;

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Return CSS animation descriptors for the outgoing (old) and incoming (new)
 * slide layers based on the transition type, duration, and direction.
 *
 * Mirrors the React `getSlideTransitionAnimations` resolver one-for-one.
 */
export function getSlideTransitionAnimations(
	type: PptxTransitionType,
	durationMs: number,
	direction: string | undefined,
	orient?: string | undefined,
	spokes?: number | undefined,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	const ease = 'ease-in-out';
	// spokes is reserved for future wheel spoke-count support; forwarded only.
	void spokes;

	switch (type) {
		case 'none':
		case 'cut':
			return INSTANT;

		// Fade
		case 'fade':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};

		// Push
		case 'push': {
			const dir = resolveDirection(direction, 'left');
			const configs: Record<ResolvedDirection, SlideTransitionAnimations> = {
				left: {
					outgoing: `pptx-tr-push-out-to-left ${dur} ${ease} forwards`,
					incoming: `pptx-tr-push-in-from-right ${dur} ${ease} forwards`,
					outgoingOnTop: false,
				},
				right: {
					outgoing: `pptx-tr-push-out-to-right ${dur} ${ease} forwards`,
					incoming: `pptx-tr-push-in-from-left ${dur} ${ease} forwards`,
					outgoingOnTop: false,
				},
				up: {
					outgoing: `pptx-tr-push-out-to-top ${dur} ${ease} forwards`,
					incoming: `pptx-tr-push-in-from-bottom ${dur} ${ease} forwards`,
					outgoingOnTop: false,
				},
				down: {
					outgoing: `pptx-tr-push-out-to-bottom ${dur} ${ease} forwards`,
					incoming: `pptx-tr-push-in-from-top ${dur} ${ease} forwards`,
					outgoingOnTop: false,
				},
			};
			return configs[dir];
		}

		// Wipe
		case 'wipe': {
			const dir = resolveDirection(direction, 'left');
			const wipeNames: Record<ResolvedDirection, string> = {
				left: `pptx-tr-wipe-from-left ${dur} ${ease} forwards`,
				right: `pptx-tr-wipe-from-right ${dur} ${ease} forwards`,
				up: `pptx-tr-wipe-from-top ${dur} ${ease} forwards`,
				down: `pptx-tr-wipe-from-bottom ${dur} ${ease} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: wipeNames[dir],
				outgoingOnTop: false,
			};
		}

		// Cover (with diagonal support)
		case 'cover': {
			const dir = resolveDirection8(direction, 'left');
			const coverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-cover-from-left ${dur} ${ease} forwards`,
				right: `pptx-tr-cover-from-right ${dur} ${ease} forwards`,
				up: `pptx-tr-cover-from-top ${dur} ${ease} forwards`,
				down: `pptx-tr-cover-from-bottom ${dur} ${ease} forwards`,
				lu: `pptx-tr-cover-from-lu ${dur} ${ease} forwards`,
				ld: `pptx-tr-cover-from-ld ${dur} ${ease} forwards`,
				ru: `pptx-tr-cover-from-ru ${dur} ${ease} forwards`,
				rd: `pptx-tr-cover-from-rd ${dur} ${ease} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: coverMap[dir],
				outgoingOnTop: false,
			};
		}

		// Uncover (with diagonal support)
		case 'uncover': {
			const dir = resolveDirection8(direction, 'left');
			const uncoverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-uncover-to-left ${dur} ${ease} forwards`,
				right: `pptx-tr-uncover-to-right ${dur} ${ease} forwards`,
				up: `pptx-tr-uncover-to-top ${dur} ${ease} forwards`,
				down: `pptx-tr-uncover-to-bottom ${dur} ${ease} forwards`,
				lu: `pptx-tr-uncover-to-lu ${dur} ${ease} forwards`,
				ld: `pptx-tr-uncover-to-ld ${dur} ${ease} forwards`,
				ru: `pptx-tr-uncover-to-ru ${dur} ${ease} forwards`,
				rd: `pptx-tr-uncover-to-rd ${dur} ${ease} forwards`,
			};
			return {
				outgoing: uncoverMap[dir],
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		// Split (in/out + horz/vert)
		case 'split': {
			const o = resolveOrientation(undefined, orient);
			const isOut = direction !== 'in';
			if (isOut) {
				return {
					outgoing: 'none',
					incoming:
						o === 'vert'
							? `pptx-tr-split-v-out ${dur} ${ease} forwards`
							: `pptx-tr-split-h-out ${dur} ${ease} forwards`,
					outgoingOnTop: false,
				};
			}
			return {
				outgoing:
					o === 'vert'
						? `pptx-tr-split-v-in ${dur} ${ease} forwards`
						: `pptx-tr-split-h-in ${dur} ${ease} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		// Dissolve
		case 'dissolve':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-dissolve-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};

		// Clip-path shape transitions
		case 'circle':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-circle-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		case 'diamond':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-diamond-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		case 'plus':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-plus-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		case 'wedge':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wedge-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		case 'wheel':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wheel-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};

		// Zoom
		case 'zoom':
			return {
				outgoing: `pptx-tr-zoom-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-zoom-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};

		// Blinds (orientation-aware)
		case 'blinds': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-blinds-v ${dur} ${ease} forwards`
						: `pptx-tr-blinds-h ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		}

		// Checker
		case 'checker':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-checker-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};

		// Comb (orientation-aware)
		case 'comb': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-comb-v ${dur} ${ease} forwards`
						: `pptx-tr-comb-h ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		}

		// Strips (direction-aware diagonals)
		case 'strips': {
			const stripDir =
				direction === 'lu' || direction === 'ld' || direction === 'ru' || direction === 'rd'
					? direction
					: 'lu';
			return {
				outgoing: 'none',
				incoming: `pptx-tr-strips-${stripDir} ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		}

		// RandomBar (orientation-aware)
		case 'randomBar': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-randombar-v ${dur} ${ease} forwards`
						: `pptx-tr-randombar-h ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};
		}

		// Newsflash
		case 'newsflash':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-newsflash-in ${dur} ${ease} forwards`,
				outgoingOnTop: false,
			};

		// Pull (alias for uncover)
		case 'pull':
			return getSlideTransitionAnimations('uncover', durationMs, direction, orient, spokes);

		// Morph (fallback to crossfade)
		case 'morph':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};

		// Random
		case 'random': {
			const randomType =
				RANDOM_ELIGIBLE_TYPES[Math.floor(Math.random() * RANDOM_ELIGIBLE_TYPES.length)];
			return getSlideTransitionAnimations(randomType, durationMs, direction, orient, spokes);
		}

		// Fallback (unknown / not-yet-mapped type)
		default:
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
				outgoingOnTop: true,
			};
	}
}
