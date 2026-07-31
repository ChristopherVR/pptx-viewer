import type {
	AnimationPresetInfo,
	PptxAnimationPreset,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import { ooxmlToPresetName } from 'pptx-viewer-core';
import { animationEffectLabel } from 'pptx-viewer-shared';
import type { AnimationLabelTranslate } from 'pptx-viewer-shared';

export type AnimationCategory = 'entrance' | 'emphasis' | 'exit';

export function catalogIdToPreset(catalogId: string): PptxAnimationPreset {
	const [presetClass, id] = catalogId.split('.');
	const presetId = Number(id);
	if (
		(presetClass === 'entr' || presetClass === 'exit' || presetClass === 'emph') &&
		Number.isFinite(presetId)
	) {
		const name = ooxmlToPresetName({ presetClass, presetId });
		if (name) {
			return name as PptxAnimationPreset;
		}
	}
	return catalogId as PptxAnimationPreset;
}

export function createElementAnimation(
	elementId: string,
	category: AnimationCategory,
	info: AnimationPresetInfo,
	order: number,
): PptxElementAnimation {
	const base: PptxElementAnimation = {
		elementId,
		durationMs: info.defaultDurationMs,
		order,
		trigger: 'onClick',
	};
	return { ...base, [category]: catalogIdToPreset(info.presetId) };
}

export function patchElementAnimation(
	animations: readonly PptxElementAnimation[],
	index: number,
	patch: Partial<PptxElementAnimation>,
): PptxElementAnimation[] {
	return animations.map((animation, current) =>
		current === index ? { ...animation, ...patch } : animation,
	);
}

export function reorderSlideAnimations(
	animations: readonly PptxElementAnimation[],
	sourceIndex: number,
	targetIndex: number,
): PptxElementAnimation[] {
	const sorted = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	if (
		sourceIndex >= 0 &&
		targetIndex >= 0 &&
		sourceIndex < sorted.length &&
		targetIndex < sorted.length
	) {
		const [moved] = sorted.splice(sourceIndex, 1);
		if (moved) {
			sorted.splice(targetIndex, 0, moved);
		}
	}
	return sorted.map((animation, order) => ({ ...animation, order }));
}

export function animationElementLabel(element: PptxElement | undefined, fallback: string): string {
	if (!element) {
		return fallback;
	}
	const text = 'text' in element ? element.text?.trim() : undefined;
	return element.name || text || fallback;
}

/**
 * The effect name for a timeline row / editor header.
 *
 * This used to look the element's preset token up in core's OOXML catalogue,
 * which is keyed by wire ids (`entr.1`) and so never matched an editor token
 * (`fadeIn`); the `|| preset` fallback then printed that token, in English, in
 * every language. The shared resolver understands both vocabularies.
 */
export function animationPresetLabel(
	animation: PptxElementAnimation,
	translate: AnimationLabelTranslate,
): string {
	return animationEffectLabel(animation, translate);
}
