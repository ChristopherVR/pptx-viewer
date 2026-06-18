/**
 * element-animation — pure helpers for the Animations ribbon tab (add/remove a
 * per-element entrance/emphasis/exit preset). Vue port of the animation logic in
 * React's `ViewerToolbarSection` (`handleAddAnimation`/`handleRemoveAnimation`).
 * Framework-free so it can be unit-tested in isolation.
 */
import type { PptxAnimationPreset, PptxElementAnimation } from 'pptx-viewer-core';

/** One of the three animation buckets a preset can occupy on an element. */
export type AnimationGroup = 'entrance' | 'emphasis' | 'exit';

/**
 * Return `animations` with `preset` applied to `elementId`'s `group` slot. If the
 * element already has an entry its `group` field is replaced; otherwise a new
 * entry is appended (500ms, on-click, ordered after the existing ones).
 */
export function applyAnimationPreset(
	animations: PptxElementAnimation[],
	elementId: string,
	group: AnimationGroup,
	preset: PptxAnimationPreset,
): PptxElementAnimation[] {
	const exists = animations.some((a) => a.elementId === elementId);
	if (exists) {
		return animations.map((a) => (a.elementId === elementId ? { ...a, [group]: preset } : a));
	}
	return [
		...animations,
		{
			elementId,
			[group]: preset,
			durationMs: 500,
			order: animations.length,
			trigger: 'onClick',
		} satisfies PptxElementAnimation,
	];
}

/** Return `animations` without the entry for `elementId`. */
export function removeElementAnimation(
	animations: PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	return animations.filter((a) => a.elementId !== elementId);
}
