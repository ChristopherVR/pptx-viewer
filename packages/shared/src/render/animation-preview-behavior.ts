/**
 * `animation-preview-behavior` - the editor's canvas preview of an entrance
 * or exit, played from PowerPoint's own behaviour tree for the preset and
 * direction (the one core's writer saves, see `capturedPresetNativeAnimation`)
 * through the same player the slide show uses.
 *
 * The preset keyframes the preview used before only knew a handful of
 * presets and moved a Fly In one element width with a fade; PowerPoint's
 * starts it just off the slide edge with no fade. Playing the saved tree
 * makes the preview show what the saved file will do in PowerPoint.
 *
 * @module render/animation-preview-behavior
 */
import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationTimingCurve,
} from 'pptx-viewer-core';
import {
	capturedPresetNativeAnimation,
	getCapturedPreset,
	resolveDirectionSubtype,
	resolveOoxmlPresetMapping,
	timingCurveToAccelDecel,
} from 'pptx-viewer-core';

import { buildBehaviorKeyframes } from './animation-behavior-keyframes';
import { cssEasingForAccelDecel } from './animation-easing';
import type { AnimationElementBox } from './animation-render-context';

/** An element's box on its stage plus the stage size, both in px. */
export interface PreviewGeometry {
	box: AnimationElementBox;
	slidePx: { width: number; height: number };
}

/** The descriptor shape `buildPreviewAnimation` returns. */
export interface BehaviorPreviewDescriptor {
	keyframeName: string;
	keyframesCss: string;
	cssAnimation: string;
	durationMs: number;
}

let previewUid = 0;

/**
 * Measure `element`'s box against its stage (its offset parent, laid out in
 * unscaled slide px), or `undefined` when it is not laid out.
 */
export function measurePreviewGeometry(element: HTMLElement): PreviewGeometry | undefined {
	const stage = element.offsetParent as HTMLElement | null;
	const width = stage?.offsetWidth ?? 0;
	const height = stage?.offsetHeight ?? 0;
	if (width <= 0 || height <= 0) {
		return undefined;
	}
	return {
		box: {
			x: element.offsetLeft / width,
			y: element.offsetTop / height,
			width: element.offsetWidth / width,
			height: element.offsetHeight / height,
			slideAspect: width / height,
		},
		slidePx: { width, height },
	};
}

/**
 * A preview descriptor playing PowerPoint's tree for `preset` at `direction`,
 * or `undefined` when the preset is not an entrance/exit with a captured tree
 * or the player cannot represent it (the caller keeps its preset keyframe).
 */
export function buildBehaviorPreview(
	preset: PptxAnimationPreset,
	options: {
		direction?: PptxAnimationDirection;
		durationMs?: number;
		timingCurve?: PptxAnimationTimingCurve;
	},
	geometry: PreviewGeometry,
): BehaviorPreviewDescriptor | undefined {
	const mapping = resolveOoxmlPresetMapping(
		preset,
		(cls, id) => getCapturedPreset(cls, id)?.defaultSubtype,
	);
	if (!mapping || (mapping.presetClass !== 'entr' && mapping.presetClass !== 'exit')) {
		return undefined;
	}
	const subtype = resolveDirectionSubtype(mapping, options.direction);
	const native = capturedPresetNativeAnimation(
		mapping.presetClass,
		mapping.presetId,
		subtype,
		options.durationMs,
	);
	if (!native) {
		return undefined;
	}
	// An explicit curve replaces the preset's own accel/decel, like the writer.
	if (options.timingCurve !== undefined) {
		const curve = timingCurveToAccelDecel(options.timingCurve);
		native.accel = curve.accel / 100000 || undefined;
		native.decel = curve.decel / 100000 || undefined;
	}
	const built = buildBehaviorKeyframes(native, previewUid++, geometry.box, {
		prefix: 'pptx-preview-bhvr',
		slidePx: geometry.slidePx,
	});
	if (!built) {
		return undefined;
	}
	const durationMs = native.durationMs ?? options.durationMs ?? 500;
	const easing = built.easing ?? cssEasingForAccelDecel(native.accel, native.decel);
	return {
		keyframeName: built.keyframeName,
		keyframesCss: built.css,
		cssAnimation: `${built.keyframeName} ${durationMs}ms ${easing} 0ms 1 normal both`,
		durationMs,
	};
}
