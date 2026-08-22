import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	GENERIC_FALLBACK_FILTER_FAMILIES,
	resolveFilterEffect,
	resolveFilterPresetSubtype,
} from './animation-filter-effects';
import { buildTimeline } from './animation-timeline-builder';
import { resolveEffect } from './animation-timeline-helpers';

function filterAnim(
	family: string,
	subtype?: string,
	presetClass?: PptxNativeAnimation['presetClass'],
): PptxNativeAnimation {
	return {
		targetId: 'shape1',
		presetClass,
		effectFilter: { family, subtype, raw: subtype ? `${family}(${subtype})` : family },
	} as PptxNativeAnimation;
}

// One row per implemented filter family: entrance EffectName, exit EffectName.
const IMPLEMENTED_FAMILIES: ReadonlyArray<{
	family: string;
	subtype?: string;
	entr: string;
	exit: string;
}> = [
	{ family: 'fade', entr: 'fadeIn', exit: 'fadeOut' },
	{ family: 'dissolve', entr: 'dissolveIn', exit: 'dissolveOut' },
	{ family: 'wipe', subtype: 'up', entr: 'wipeIn', exit: 'wipeOut' },
	{ family: 'barn', subtype: 'inVertical', entr: 'splitIn', exit: 'fadeOut' },
	{ family: 'checkerboard', subtype: 'across', entr: 'checkerboardIn', exit: 'fadeOut' },
	{ family: 'blinds', subtype: 'horizontal', entr: 'blindsIn', exit: 'fadeOut' },
	{ family: 'box', entr: 'boxIn', exit: 'fadeOut' },
	{ family: 'circle', entr: 'circleIn', exit: 'shrinkOut' },
	{ family: 'wheel', subtype: '4', entr: 'wheelIn', exit: 'fadeOut' },
	{ family: 'zoom', entr: 'zoomIn', exit: 'zoomOut' },
	{ family: 'randombar', subtype: 'horizontal', entr: 'randomBarsIn', exit: 'fadeOut' },
	{ family: 'strips', subtype: 'downLeft', entr: 'wipeIn', exit: 'wipeOut' },
];

describe('resolveFilterEffect', () => {
	it.each(IMPLEMENTED_FAMILIES)(
		'maps $family to $entr on entrance and $exit on exit',
		({ family, subtype, entr, exit }) => {
			expect(resolveFilterEffect(filterAnim(family, subtype, 'entr'))).toBe(entr);
			expect(resolveFilterEffect(filterAnim(family, subtype, 'exit'))).toBe(exit);
		},
	);

	it('defaults to the entrance mapping when presetClass is absent', () => {
		expect(resolveFilterEffect(filterAnim('fade'))).toBe('fadeIn');
	});

	it('maps slide(fromLeft)/slide(fromRight)/slide(fromTop)/slide(fromBottom) directly onto Fly', () => {
		expect(resolveFilterEffect(filterAnim('slide', 'fromLeft', 'entr'))).toBe('flyInLeft');
		expect(resolveFilterEffect(filterAnim('slide', 'fromRight', 'entr'))).toBe('flyInRight');
		expect(resolveFilterEffect(filterAnim('slide', 'fromTop', 'entr'))).toBe('flyInTop');
		expect(resolveFilterEffect(filterAnim('slide', 'fromBottom', 'entr'))).toBe('flyInBottom');
		expect(resolveFilterEffect(filterAnim('slide', 'fromLeft', 'exit'))).toBe('flyOutLeft');
	});

	it('slide with no subtype defaults to the bottom edge', () => {
		expect(resolveFilterEffect(filterAnim('slide', undefined, 'entr'))).toBe('flyInBottom');
	});

	it('returns undefined for an unrecognised family (caller falls back to generic fade)', () => {
		expect(
			resolveFilterEffect(filterAnim('totallyUnknownVendorFilter', undefined, 'entr')),
		).toBeUndefined();
	});

	it('returns undefined when there is no effectFilter at all', () => {
		expect(resolveFilterEffect({ targetId: 'x' } as PptxNativeAnimation)).toBeUndefined();
	});

	it.each(GENERIC_FALLBACK_FILTER_FAMILIES)(
		'leaves the genuinely-unmapped family "%s" unresolved (documented fade fallback)',
		(family) => {
			expect(resolveFilterEffect(filterAnim(family, undefined, 'entr'))).toBeUndefined();
			expect(resolveFilterEffect(filterAnim(family, undefined, 'exit'))).toBeUndefined();
		},
	);
});

describe('resolveFilterPresetSubtype', () => {
	it('prefers a real presetSubtype over the filter token', () => {
		const anim = { ...filterAnim('wipe', 'up', 'entr'), presetSubtype: 8 };
		expect(resolveFilterPresetSubtype(anim)).toBe(8);
	});

	it('derives the wipe presetSubtype from the filter token', () => {
		expect(resolveFilterPresetSubtype(filterAnim('wipe', 'up', 'entr'))).toBe(1);
		expect(resolveFilterPresetSubtype(filterAnim('wipe', 'right', 'entr'))).toBe(2);
		expect(resolveFilterPresetSubtype(filterAnim('wipe', 'down', 'entr'))).toBe(4);
		expect(resolveFilterPresetSubtype(filterAnim('wipe', 'left', 'entr'))).toBe(8);
	});

	it('derives the barn presetSubtype from the filter token', () => {
		expect(resolveFilterPresetSubtype(filterAnim('barn', 'inVertical', 'entr'))).toBe(21);
		expect(resolveFilterPresetSubtype(filterAnim('barn', 'inHorizontal', 'entr'))).toBe(26);
		expect(resolveFilterPresetSubtype(filterAnim('barn', 'outVertical', 'exit'))).toBe(10);
		expect(resolveFilterPresetSubtype(filterAnim('barn', 'outHorizontal', 'exit'))).toBe(5);
	});

	it('derives an approximated strips presetSubtype off the nearest wipe edge', () => {
		expect(resolveFilterPresetSubtype(filterAnim('strips', 'downLeft', 'entr'))).toBe(4);
		expect(resolveFilterPresetSubtype(filterAnim('strips', 'upRight', 'entr'))).toBe(1);
	});

	it('returns undefined for a non-directional family', () => {
		expect(
			resolveFilterPresetSubtype(filterAnim('checkerboard', 'across', 'entr')),
		).toBeUndefined();
	});

	it('returns undefined when there is no subtype token', () => {
		expect(resolveFilterPresetSubtype(filterAnim('wipe', undefined, 'entr'))).toBeUndefined();
	});
});

// ==========================================================================
// Integration: resolveEffect() consults the filter only as a fallback, and
// buildTimeline() actually emits a keyframe for a filter-only animation.
// ==========================================================================

describe('resolveEffect: filter fallback integration', () => {
	it('prefers a recognised presetId over the filter (presetId remains primary)', () => {
		// presetId 22 (entr) is Wipe; filter deliberately says something else to
		// prove presetId wins the tie.
		const anim = {
			presetClass: 'entr',
			presetId: 22,
			effectFilter: { family: 'fade', raw: 'fade' },
		} as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBe('wipeIn');
	});

	it('falls back to the filter when presetId is absent', () => {
		expect(resolveEffect(filterAnim('checkerboard', 'across', 'entr'))).toBe('checkerboardIn');
	});

	it('falls back to the filter when presetId is present but unmapped', () => {
		const anim = {
			presetClass: 'entr',
			presetId: 99999,
			effectFilter: { family: 'zoom', raw: 'zoom' },
		} as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBe('zoomIn');
	});

	it('a filter-only entrance animation reaches buildTimeline as a real click-group step', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				presetClass: 'entr',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: { family: 'wipe', subtype: 'up', transition: 'in', raw: 'wipe(up)' },
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		// wipe(up) is directional (presetSubtype 1 synthesised from the token),
		// so it gets its own dynamic directional keyframe name rather than the
		// shared static `pptx-wipeIn`.
		expect(step.keyframeName).toMatch(/^pptx-tl-dir-/);
		expect(timeline.keyframesCss).toContain(step.keyframeName);
		expect(timeline.entranceElementIds.has('shape1')).toBeTruthy();
	});

	it('a filter-only exit animation with an unmapped family still hides the element (generic fade fallback)', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: { family: 'wedge', transition: 'out', raw: 'wedge' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
