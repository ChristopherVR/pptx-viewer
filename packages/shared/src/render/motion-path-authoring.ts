/**
 * `motion-path-authoring`: apply, edit, remove and preview a motion path on the
 * editor's slide-level `animations[]` model.
 *
 * WHY a bucket of its own: `PptxElementAnimation` models entrance / emphasis /
 * exit as named presets, but a motion path is geometry, not a preset name. It
 * therefore lives in the sibling `motionPath` field (which core already
 * serialises to a real `p:animMotion` node AND preserves in the editor
 * extension), and the same entry's `trigger` / `durationMs` / `delayMs` /
 * `order` drive it exactly as they drive the other three buckets. That is why
 * these helpers upsert the SAME entry rather than adding a second one: one
 * element, one timeline row, whichever effects it carries.
 *
 * Pure: no DOM, no framework. Bindings own the gallery, the canvas overlay and
 * the `<style>` injection.
 *
 * @module render/motion-path-authoring
 */

import type {
	PptxElementAnimation,
	PptxAnimationTimingCurve,
	PptxNativeAnimation,
	PptxSlide,
} from 'pptx-viewer-core';

import type { AnimationPreviewDescriptor } from './animation-preview';
import { timingCurveToCss } from './animation-preview';
import { buildMotionPathKeyframes } from './motion-path-geometry';
import { motionPathPresetById } from './motion-path-presets';

/**
 * The bucket a ribbon gallery click targets. Widens the three preset buckets
 * with `motionPath` so a binding's single "apply animation" callback can carry
 * a motion-path preset id too, instead of every binding growing a second
 * callback threaded through the same six components.
 */
export type AnimationApplyGroup = 'entrance' | 'emphasis' | 'exit' | 'motionPath';

/** Duration PowerPoint gives a freshly applied motion path. */
export const DEFAULT_MOTION_PATH_DURATION_MS = 2000;

/** Trigger a freshly applied motion path gets, matching the other buckets. */
const DEFAULT_TRIGGER = 'onClick' as const;

/** Read the motion path applied to an element, if any. */
export function motionPathFor(
	animations: readonly PptxElementAnimation[],
	elementId: string,
): string | undefined {
	return animations.find((animation) => animation.elementId === elementId)?.motionPath;
}

/** Whether the element currently carries a motion path. */
export function hasMotionPath(
	animations: readonly PptxElementAnimation[],
	elementId: string,
): boolean {
	return Boolean(motionPathFor(animations, elementId));
}

/**
 * Set (or replace) the raw motion path on an element, creating the animation
 * entry when the element had none. `pathEditMode` is pinned to `relative`
 * because the catalogue's coordinates are offsets from the element centre,
 * which is what a `relative` path means on the wire.
 */
export function setMotionPath(
	animations: readonly PptxElementAnimation[],
	elementId: string,
	path: string,
): PptxElementAnimation[] {
	const index = animations.findIndex((animation) => animation.elementId === elementId);
	if (index >= 0) {
		return animations.map((animation, i) =>
			i === index
				? {
						...animation,
						motionPath: path,
						motionPathEditMode: animation.motionPathEditMode ?? 'relative',
						durationMs: animation.durationMs ?? DEFAULT_MOTION_PATH_DURATION_MS,
					}
				: animation,
		);
	}
	return [
		...animations,
		{
			elementId,
			motionPath: path,
			motionPathEditMode: 'relative',
			durationMs: DEFAULT_MOTION_PATH_DURATION_MS,
			order: animations.length,
			trigger: DEFAULT_TRIGGER,
		},
	];
}

/**
 * Apply a catalogue preset by id. Unknown ids leave the list untouched so a
 * stale UI id can never blank an existing path.
 */
export function applyMotionPathPreset(
	animations: readonly PptxElementAnimation[],
	elementId: string,
	presetId: string,
): PptxElementAnimation[] {
	const preset = motionPathPresetById(presetId);
	if (!preset) {
		return [...animations];
	}
	return setMotionPath(animations, elementId, preset.path);
}

/**
 * Clear the motion path. The whole entry is dropped when nothing else is left
 * on it, so removing the only effect does not leave an empty timeline row
 * behind (the same rule the preset setters follow).
 */
export function clearMotionPath(
	animations: readonly PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	const index = animations.findIndex((animation) => animation.elementId === elementId);
	if (index < 0) {
		return [...animations];
	}
	const current = animations[index];
	const stillHasEffect = Boolean(current.entrance || current.emphasis || current.exit);
	if (!stillHasEffect) {
		return animations
			.filter((animation) => animation.elementId !== elementId)
			.map((animation, i) => ({ ...animation, order: i }));
	}
	return animations.map((animation, i) =>
		i === index
			? {
					...animation,
					motionPath: undefined,
					motionPathEditMode: undefined,
					motionPtsTypes: undefined,
				}
			: animation,
	);
}

/**
 * Project the editor's motion paths onto the native-timeline model so a path
 * applied in this session plays in the slide show BEFORE the deck is saved.
 *
 * WHY it is needed: the slide-show engine reads `slide.nativeAnimations`, which
 * is only regenerated from `slide.animations` when the file is written. Without
 * this bridge a user would apply a path, press play, see nothing, and only get
 * the motion after a save + reload round trip.
 *
 * Any element already carrying a native motion path is skipped, so a reloaded
 * deck (where the same path exists in BOTH models) never plays it twice.
 */
export function motionPathNativeAnimations(slide: PptxSlide): PptxNativeAnimation[] {
	const native = slide.nativeAnimations ?? [];
	const alreadyNative = new Set(
		native.filter((animation) => animation.motionPath).map((animation) => animation.targetId),
	);
	return (slide.animations ?? [])
		.filter((animation) => Boolean(animation.motionPath) && !alreadyNative.has(animation.elementId))
		.map((animation) => ({
			targetId: animation.elementId,
			trigger: animation.trigger ?? DEFAULT_TRIGGER,
			triggerShapeId: animation.triggerShapeId,
			presetClass: 'path' as const,
			durationMs: animation.durationMs ?? DEFAULT_MOTION_PATH_DURATION_MS,
			delayMs: animation.delayMs ?? 0,
			motionPath: animation.motionPath,
			motionPathEditMode: animation.motionPathEditMode ?? 'relative',
		}));
}

/**
 * Build the preview descriptor that plays a motion path on the canvas: the
 * `@keyframes` block plus the `animation` shorthand a binding assigns to the
 * element. Mirrors {@link buildPreviewAnimation} for the preset buckets so a
 * binding's existing preview player only needs one extra branch.
 */
export function buildMotionPathPreview(args: {
	path: string;
	slideWidth: number;
	slideHeight: number;
	durationMs?: number;
	delayMs?: number;
	timingCurve?: PptxAnimationTimingCurve;
	/** Disambiguates concurrent previews; defaults to a stable name. */
	uid?: string | number;
}): AnimationPreviewDescriptor | undefined {
	const keyframeName = `pptx-motion-preview-${args.uid ?? 0}`;
	const keyframes = buildMotionPathKeyframes({
		path: args.path,
		slideWidth: args.slideWidth,
		slideHeight: args.slideHeight,
		keyframeName,
	});
	if (!keyframes) {
		return undefined;
	}
	const durationMs = args.durationMs ?? DEFAULT_MOTION_PATH_DURATION_MS;
	const delayMs = args.delayMs ?? 0;
	const easing = timingCurveToCss(args.timingCurve);
	return {
		keyframeName,
		keyframesCss: keyframes.css,
		cssAnimation: `${keyframeName} ${durationMs}ms ${easing} ${delayMs}ms 1 normal both`,
		durationMs,
	};
}
