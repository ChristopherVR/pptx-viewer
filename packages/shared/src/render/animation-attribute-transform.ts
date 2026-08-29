import type {
	PptxAnimationKeyframe,
	PptxAttributeAnimation,
	PptxNativeAnimation,
} from 'pptx-viewer-core';

type AttributeKind = 'opacity' | 'rotation' | 'scaleX' | 'scaleY' | 'translateX' | 'translateY';

interface ParsedComponent {
	delayMs: number;
	durationMs: number;
	kind: AttributeKind;
	stops: Array<{ progress: number; value: number }>;
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

const SELF_REFERENCE_RE = /^#?ppt_([whxy])(?:([+-])(\d*\.?\d+))?$/iu;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function numericValue(keyframe: PptxAnimationKeyframe): number | undefined {
	const parsed = Number(keyframe.value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSelfReference(
	keyframe: PptxAnimationKeyframe,
	expectedAxis: 'h' | 'w' | 'x' | 'y',
): { offset: number } | undefined {
	const token = String(keyframe.value).replaceAll(' ', '').toLowerCase();
	const match = SELF_REFERENCE_RE.exec(token);
	if (!match || match[1] !== expectedAxis) {
		return undefined;
	}
	const magnitude = match[3] === undefined ? 0 : Number(match[3]);
	if (!Number.isFinite(magnitude)) {
		return undefined;
	}
	return { offset: match[2] === '-' ? -magnitude : magnitude };
}

function parseValue(kind: AttributeKind, keyframe: PptxAnimationKeyframe): number | undefined {
	if (kind === 'rotation') {
		return numericValue(keyframe);
	}
	if (kind === 'opacity') {
		const value = numericValue(keyframe);
		return value === undefined ? undefined : clamp01(value);
	}
	if (kind === 'scaleX' || kind === 'scaleY') {
		const numeric = numericValue(keyframe);
		if (numeric === 0) {
			return 0;
		}
		const axis = kind === 'scaleX' ? 'w' : 'h';
		const reference = parseSelfReference(keyframe, axis);
		return reference?.offset === 0 ? 1 : undefined;
	}
	const axis = kind === 'translateX' ? 'x' : 'y';
	const reference = parseSelfReference(keyframe, axis);
	return reference === undefined ? undefined : reference.offset * 100;
}

function parseComponent(
	component: PptxAttributeAnimation,
	effectDurationMs: number,
): ParsedComponent | undefined {
	const kind = ATTRIBUTE_KINDS[component.attrName];
	if (!kind) {
		return undefined;
	}
	const stops: ParsedComponent['stops'] = [];
	for (const keyframe of component.keyframes) {
		if (typeof keyframe.tm !== 'number' || !Number.isFinite(keyframe.tm)) {
			return undefined;
		}
		const value = parseValue(kind, keyframe);
		if (value === undefined) {
			return undefined;
		}
		stops.push({ progress: clamp01(keyframe.tm / 100000), value });
	}
	if (stops.length < 2) {
		return undefined;
	}
	stops.sort((left, right) => left.progress - right.progress);
	return {
		delayMs: component.delayMs ?? 0,
		durationMs: component.durationMs ?? effectDurationMs,
		kind,
		stops,
	};
}

function valueAt(component: ParsedComponent, progress: number, effectDurationMs: number): number {
	const elapsedMs = progress * effectDurationMs - component.delayMs;
	const localProgress = clamp01(elapsedMs / Math.max(1, component.durationMs));
	const first = component.stops[0];
	const last = component.stops[component.stops.length - 1];
	if (localProgress <= first.progress) {
		return first.value;
	}
	if (localProgress >= last.progress) {
		return last.value;
	}
	for (let index = 1; index < component.stops.length; index += 1) {
		const right = component.stops[index];
		const left = component.stops[index - 1];
		if (localProgress <= right.progress) {
			const span = Math.max(Number.EPSILON, right.progress - left.progress);
			const ratio = (localProgress - left.progress) / span;
			return left.value + (right.value - left.value) * ratio;
		}
	}
	return last.value;
}

/** Build a normalized playback model for supported generic `p:anim` transforms. */
export function createAttributeTransformModel(
	anim: Pick<PptxNativeAnimation, 'attributeAnimations' | 'durationMs'>,
): AttributeTransformModel | undefined {
	const effectDurationMs = Math.max(1, anim.durationMs ?? 1000);
	const supportedComponents = (anim.attributeAnimations ?? []).filter(
		(component) => ATTRIBUTE_KINDS[component.attrName] !== undefined,
	);
	const components = supportedComponents.map((component) =>
		parseComponent(component, effectDurationMs),
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
	}

	return {
		progresses: [...progressSet].sort((left, right) => left - right),
		stateAt(progress) {
			const state: AttributeTransformState = {};
			for (const component of parsedComponents) {
				state[component.kind] = valueAt(component, progress, effectDurationMs);
			}
			return state;
		},
	};
}
