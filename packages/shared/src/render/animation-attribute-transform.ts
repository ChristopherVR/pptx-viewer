import type {
	PptxAnimationKeyframe,
	PptxAttributeAnimation,
	PptxNativeAnimation,
} from 'pptx-viewer-core';

import type { GeometryKind } from './animation-attribute-geometry';
import { resolveGeometryStops } from './animation-attribute-geometry';
import type { AnimationElementBox } from './animation-render-context';

type AttributeKind = 'opacity' | 'rotation' | 'scaleX' | 'scaleY' | 'translateX' | 'translateY';

interface ParsedComponent {
	calcMode: 'discrete' | 'lin';
	delayMs: number;
	durationMs: number;
	kind: AttributeKind;
	stops: Array<{ progress: number; value: number }>;
	/** See {@link PptxAttributeAnimation.bounceEnd}; only honoured for a plain 2-stop ramp. */
	bounceEnd?: number;
}

/**
 * Number of `%` samples generated across a bounce behaviour's settle phase
 * (from {@link PptxAttributeAnimation.bounceEnd} to the end of the ramp).
 * Only the discrete stops actually present in a `@keyframes` block are
 * visible to CSS's own linear interpolation between them, so the decaying
 * oscillation needs several intermediate samples to read as a bounce rather
 * than a single straight overshoot-and-back triangle.
 */
const BOUNCE_SETTLE_SAMPLES = 16;

/**
 * How many decaying oscillations the settle phase completes. Not fitted
 * against PowerPoint `CreateVideo` frame captures (no local capture pipeline
 * was available for this change); chosen to read as a plausible "overshoot,
 * bounce twice, settle" curve. Revisit with real frame data if the shape
 * turns out to visibly disagree with PowerPoint's own Bounce End effect.
 */
const BOUNCE_OSCILLATIONS = 2.5;

/**
 * Overshoot amplitude as a fraction of the ramp's total travel distance.
 * Same caveat as {@link BOUNCE_OSCILLATIONS}: a reasoned approximation, not a
 * COM-measured constant.
 */
const BOUNCE_OVERSHOOT_FRACTION = 0.12;

/**
 * Decaying-cosine approximation of PowerPoint's Fly In "Bounce End" settle
 * curve: `s` is the 0-1 fraction of the settle phase (from `bounceEnd` to the
 * end of the behaviour). Returns a signed multiplier that starts at +1 (peak
 * overshoot, in the direction of travel) and decays to exactly 0 at `s = 1`,
 * so the animated value always lands precisely on `last.value` regardless of
 * how many oscillations are configured.
 */
function bounceSettleMultiplier(s: number): number {
	const amplitude = (1 - s) ** 2;
	return amplitude * Math.cos(s * BOUNCE_OSCILLATIONS * 2 * Math.PI);
}

/**
 * Value for a bounce-shaped 2-stop ramp at a given LOCAL progress (0-1,
 * already relative to this component's own delay/duration). Before
 * `bounceEnd`, travel is the same plain linear ramp `valueAt` already does
 * for every other component; after it, the value oscillates around
 * `last.value` with decaying amplitude, landing exactly on it at
 * `localProgress = 1`. See {@link PptxAttributeAnimation.bounceEnd}'s doc for
 * why this is a reasoned approximation rather than a frame-fitted curve.
 */
function bounceValueAt(
	first: { progress: number; value: number },
	last: { progress: number; value: number },
	bounceEnd: number,
	localProgress: number,
): number {
	const travel = last.value - first.value;
	if (localProgress <= bounceEnd) {
		const ratio = bounceEnd <= 0 ? 1 : localProgress / bounceEnd;
		return first.value + travel * ratio;
	}
	const settleSpan = Math.max(Number.EPSILON, 1 - bounceEnd);
	const s = clamp01((localProgress - bounceEnd) / settleSpan);
	return last.value + travel * BOUNCE_OVERSHOOT_FRACTION * bounceSettleMultiplier(s);
}

export interface AttributeTransformState {
	opacity?: number;
	rotation?: number;
	scaleX?: number;
	scaleY?: number;
	translateX?: number;
	translateY?: number;
}

export interface AttributeTransformModel {
	progresses: number[];
	stateAt: (progress: number) => AttributeTransformState;
}

const ATTRIBUTE_KINDS: Readonly<Record<string, AttributeKind>> = {
	opacity: 'opacity',
	ppt_h: 'scaleY',
	ppt_w: 'scaleX',
	ppt_x: 'translateX',
	ppt_y: 'translateY',
	'style.opacity': 'opacity',
	'style.rotation': 'rotation',
};

function isGeometryKind(kind: AttributeKind): kind is GeometryKind {
	return kind === 'scaleX' || kind === 'scaleY' || kind === 'translateX' || kind === 'translateY';
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function numericValue(keyframe: PptxAnimationKeyframe): number | undefined {
	const parsed = Number(keyframe.value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** `rotation`/`opacity` keep the pre-existing plain-numeric-ramp behaviour: no formula language involved. */
function resolveNonGeometryStops(
	kind: 'opacity' | 'rotation',
	component: PptxAttributeAnimation,
): Array<{ progress: number; value: number }> | undefined {
	const stops: Array<{ progress: number; value: number }> = [];
	for (const keyframe of component.keyframes) {
		if (typeof keyframe.tm !== 'number' || !Number.isFinite(keyframe.tm)) {
			return undefined;
		}
		const raw = numericValue(keyframe);
		if (raw === undefined) {
			return undefined;
		}
		stops.push({
			progress: clamp01(keyframe.tm / 100000),
			value: kind === 'opacity' ? clamp01(raw) : raw,
		});
	}
	return stops.length >= 2 ? stops : undefined;
}

function parseComponent(
	component: PptxAttributeAnimation,
	effectDurationMs: number,
	box: AnimationElementBox | undefined,
): ParsedComponent | undefined {
	const kind = ATTRIBUTE_KINDS[component.attrName];
	if (!kind) {
		return undefined;
	}
	const stops = isGeometryKind(kind)
		? resolveGeometryStops(kind, component, box)
		: resolveNonGeometryStops(kind, component);
	if (!stops) {
		return undefined;
	}
	stops.sort((left, right) => left.progress - right.progress);
	// Bounce End only has a well-defined shape for a plain two-point ramp: the
	// travel between an authored start and end value. A `p:tavLst` with more
	// intermediate stops (rare for a Fly In this option applies to) falls back
	// to the ordinary linear/discrete behaviour rather than guessing which
	// segment the bounce belongs to.
	const bounceEnd =
		component.bounceEnd !== undefined && stops.length === 2
			? clamp01(component.bounceEnd)
			: undefined;
	return {
		calcMode: component.calcMode === 'discrete' ? 'discrete' : 'lin',
		delayMs: component.delayMs ?? 0,
		durationMs: component.durationMs ?? effectDurationMs,
		kind,
		stops,
		...(bounceEnd !== undefined ? { bounceEnd } : {}),
	};
}

function valueAt(component: ParsedComponent, progress: number, effectDurationMs: number): number {
	const elapsedMs = progress * effectDurationMs - component.delayMs;
	const localProgress = clamp01(elapsedMs / Math.max(1, component.durationMs));
	const { stops } = component;
	const first = stops[0];
	const last = stops[stops.length - 1];
	if (component.bounceEnd !== undefined) {
		return bounceValueAt(first, last, component.bounceEnd, localProgress);
	}
	if (localProgress <= first.progress) {
		return first.value;
	}
	if (localProgress >= last.progress) {
		return last.value;
	}
	for (let index = 1; index < stops.length; index += 1) {
		const right = stops[index];
		const left = stops[index - 1];
		if (localProgress <= right.progress) {
			if (component.calcMode === 'discrete') {
				return left.value;
			}
			const span = Math.max(Number.EPSILON, right.progress - left.progress);
			const ratio = (localProgress - left.progress) / span;
			return left.value + (right.value - left.value) * ratio;
		}
	}
	return last.value;
}

/**
 * Build a normalized playback model for supported generic `p:anim`
 * transforms. `box` is the animated shape's real rendered geometry
 * (slide-fraction units), when the caller has it; see
 * `animation-render-context.ts`. Without it, a formula that mixes axes (Grow
 * And Turn's `-#ppt_w/2` fly-in) still falls back to the effect's canned
 * timing, exactly as before.
 */
export function createAttributeTransformModel(
	anim: Pick<PptxNativeAnimation, 'attributeAnimations' | 'durationMs'>,
	box?: AnimationElementBox,
): AttributeTransformModel | undefined {
	const effectDurationMs = Math.max(1, anim.durationMs ?? 1000);
	const supportedComponents = (anim.attributeAnimations ?? []).filter(
		(component) => ATTRIBUTE_KINDS[component.attrName] !== undefined,
	);
	const components = supportedComponents.map((component) =>
		parseComponent(component, effectDurationMs, box),
	);
	const parsedComponents = components.filter(
		(component): component is ParsedComponent => component !== undefined,
	);
	// A partial transform is worse than the preset fallback: one unrepresentable
	// sibling can carry the primary movement while an identity sibling still
	// parses, causing the incomplete dynamic keyframe to suppress that preset.
	if (parsedComponents.length !== supportedComponents.length) {
		return undefined;
	}
	if (parsedComponents.length === 0) {
		return undefined;
	}

	const progressSet = new Set<number>([0, 1]);
	for (const component of parsedComponents) {
		for (const stop of component.stops) {
			progressSet.add(
				clamp01((component.delayMs + stop.progress * component.durationMs) / effectDurationMs),
			);
		}
		// A bounce's oscillation only reads as a bounce, rather than a single
		// straight overshoot-and-back triangle, when the generated `@keyframes`
		// block actually carries several `%` stops across the settle phase (see
		// `buildTransformKeyframes`, which bakes exactly `progresses` into fixed
		// CSS stops with no runtime easing of its own).
		if (component.bounceEnd !== undefined) {
			const settleStart = clamp01(
				(component.delayMs + component.bounceEnd * component.durationMs) / effectDurationMs,
			);
			const settleEnd = clamp01((component.delayMs + component.durationMs) / effectDurationMs);
			for (let index = 1; index < BOUNCE_SETTLE_SAMPLES; index += 1) {
				progressSet.add(settleStart + (settleEnd - settleStart) * (index / BOUNCE_SETTLE_SAMPLES));
			}
		}
	}

	return {
		progresses: [...progressSet].sort((left, right) => left - right),
		stateAt(progress) {
			const state: AttributeTransformState = {};
			for (const component of parsedComponents) {
				const value = valueAt(component, progress, effectDurationMs);
				state[component.kind] =
					isGeometryKind(component.kind) && component.kind.startsWith('translate')
						? value * 100
						: value;
			}
			return state;
		},
	};
}
