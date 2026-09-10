/**
 * `slide-transition-fragment-types` - shared types and small pure helpers for
 * the multi-fragment cinematic transitions (`vortex`, `honeycomb`, `glitter`,
 * `shred`, `fracture`, `curtains`, `airplane`).
 *
 * These seven presets render in real PowerPoint as many independent
 * fragments, tiles, particles, or (for `airplane`) folded panels, not a
 * single animated layer - see `slide-transition-fragments.ts` for the
 * COM `CreateVideo` measurement writeup. A `FragmentedTransitionDescriptor`
 * is the pure, framework-neutral output every binding maps onto N clipped
 * copies of its own `SlideLayer`/`SlideCanvas` component: each fragment is a
 * full-size copy of the outgoing or incoming slide, clipped with `clip-path`
 * to its slice and animated with a shared `@keyframes` block (from
 * {@link FRAGMENT_TRANSITION_KEYFRAMES}) parameterised per fragment via CSS
 * custom properties, so the whole set is transform/opacity-only and
 * GPU-composited with no per-frame JS.
 *
 * @module render/slide-transition-fragment-types
 */

/** One fragment: a clipped, independently-animated copy of a slide layer. */
export interface TransitionFragment {
	/** Stable id for keys / `data-*` attributes; unique within its layer. */
	id: string;
	/** `clip-path` value, in percentages of the full (unscaled) slide box. */
	clipPath: string;
	/**
	 * CSS custom properties consumed by the shared `@keyframes` named by the
	 * owning {@link FragmentedLayer.keyframesName}. Values are pre-formatted
	 * (already unit-suffixed, e.g. `'34deg'`, `'-120%'`) so bindings can copy
	 * them verbatim into an inline `style` object.
	 */
	vars: Readonly<Record<string, string>>;
	/** `animation-delay`, in ms. */
	delayMs: number;
	/** `transform-origin`, e.g. `'50% 50%'`, so rotate/scale pivot correctly. */
	transformOrigin: string;
}

/** One layer (outgoing or incoming) rendered as N independent fragments. */
export interface FragmentedLayer {
	/** Name of the shared `@keyframes` block every fragment in this layer runs. */
	keyframesName: string;
	/** Per-fragment `animation-duration`, in ms. */
	durationMs: number;
	/** Per-fragment `animation-timing-function`. */
	easing: string;
	fragments: readonly TransitionFragment[];
}

/**
 * Resolved fragment plan for a cinematic transition. Either layer may be
 * absent: a layer with no entry here renders as a single, non-fragmented
 * copy exactly like every other transition (typically driven by the
 * existing {@link getCinematicTransitionAnimations} / p14 resolvers, which
 * remain the single-layer fallback for previews and any consumer that has
 * not adopted fragment rendering).
 */
export interface FragmentedTransitionDescriptor {
	outgoing?: FragmentedLayer;
	incoming?: FragmentedLayer;
	/** Same semantics as `SlideTransitionAnimations.outgoingOnTop`. */
	outgoingOnTop: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helper (no Math.random: descriptors must be
// pure and reproducible, since tests and the cross-binding e2e parity spec
// both assert on exact fragment output).
// ---------------------------------------------------------------------------

/** Deterministic 0..1 pseudo-random value for a given integer seed. */
export function seededUnit(seed: number): number {
	const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}

/** Round to a fixed precision to keep generated CSS short and stable. */
export function round(value: number, decimals = 2): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

/** Format a number as a CSS percentage string, e.g. `42.5%`. */
export function pct(value: number): string {
	return `${round(value)}%`;
}

/** Format a number as a CSS degree string, e.g. `-34deg`. */
export function deg(value: number): string {
	return `${round(value)}deg`;
}
