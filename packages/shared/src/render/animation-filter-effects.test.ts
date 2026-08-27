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
	{ family: 'comb', subtype: 'horizontal', entr: 'randomBarsIn', exit: 'fadeOut' },
	{ family: 'diamond', entr: 'diamondIn', exit: 'fadeOut' },
	{ family: 'plus', entr: 'plusIn', exit: 'fadeOut' },
	{ family: 'wedge', entr: 'wedgeIn', exit: 'fadeOut' },
	{ family: 'cut', entr: 'cutIn', exit: 'cutOut' },
	{ family: 'newsflash', entr: 'newsflashIn', exit: 'newsflashOut' },
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

	it.each(['cover', 'uncover', 'push', 'pull'])(
		'maps %s(fromLeft)/%s(fromRight) directly onto Fly, like slide',
		(family) => {
			expect(resolveFilterEffect(filterAnim(family, 'fromLeft', 'entr'))).toBe('flyInLeft');
			expect(resolveFilterEffect(filterAnim(family, 'fromRight', 'exit'))).toBe('flyOutRight');
		},
	);

	it('cover/uncover fall back to the bottom edge for an unenumerated diagonal token', () => {
		expect(resolveFilterEffect(filterAnim('cover', 'fromTopLeft', 'entr'))).toBe('flyInBottom');
		expect(resolveFilterEffect(filterAnim('uncover', 'fromBottomRight', 'exit'))).toBe(
			'flyOutBottom',
		);
	});

	it('maps stretch(fromLeft)/stretch(fromRight)/stretch(fromTop)/stretch(fromBottom) onto the directional stretch keyframes', () => {
		expect(resolveFilterEffect(filterAnim('stretch', 'fromLeft', 'entr'))).toBe('stretchInLeft');
		expect(resolveFilterEffect(filterAnim('stretch', 'fromRight', 'entr'))).toBe('stretchInRight');
		expect(resolveFilterEffect(filterAnim('stretch', 'fromTop', 'entr'))).toBe('stretchInTop');
		expect(resolveFilterEffect(filterAnim('stretch', 'fromBottom', 'entr'))).toBe(
			'stretchInBottom',
		);
		expect(resolveFilterEffect(filterAnim('stretch', 'fromLeft', 'exit'))).toBe('stretchOutLeft');
	});

	it('stretch with no subtype defaults to the bottom edge', () => {
		expect(resolveFilterEffect(filterAnim('stretch', undefined, 'entr'))).toBe('stretchInBottom');
		expect(resolveFilterEffect(filterAnim('stretch', undefined, 'exit'))).toBe('stretchOutBottom');
	});

	describe('random (SMIL "pick one of the other known transition types")', () => {
		it('resolves to a real, non-generic effect rather than the fade fallback', () => {
			const entrEffect = resolveFilterEffect(filterAnim('random', undefined, 'entr'));
			const exitEffect = resolveFilterEffect(filterAnim('random', undefined, 'exit'));
			expect(entrEffect).toBeDefined();
			expect(exitEffect).toBeDefined();
		});

		it('resolves the SAME element deterministically to the SAME effect on repeated calls', () => {
			const anim = filterAnim('random', undefined, 'entr');
			const first = resolveFilterEffect(anim);
			const second = resolveFilterEffect({ ...anim });
			const third = resolveFilterEffect({ ...anim, targetId: anim.targetId });
			expect(first).toBe(second);
			expect(first).toBe(third);
		});

		it('pairs the entrance and exit pick from the SAME family for one element', () => {
			const entrAnim = {
				targetId: 'shape42',
				presetClass: 'entr' as const,
				effectFilter: { family: 'random', raw: 'random' },
			} as PptxNativeAnimation;
			const exitAnim = {
				targetId: 'shape42',
				presetClass: 'exit' as const,
				effectFilter: { family: 'random', raw: 'random' },
			} as PptxNativeAnimation;
			const entrEffect = resolveFilterEffect(entrAnim);
			const exitEffect = resolveFilterEffect(exitAnim);
			// Both picks come from the same pool index, so entrEffect/exitEffect
			// are the entr/exit halves of ONE pair, e.g. ('wipeIn','wipeOut').
			expect(entrEffect).toBeDefined();
			expect(exitEffect).toBeDefined();
			expect(entrEffect).not.toBe(exitEffect);
		});

		it('different elements can resolve to different picks', () => {
			const picks = new Set<string | undefined>();
			for (let i = 0; i < 20; i++) {
				const anim = {
					targetId: `shape-${i}`,
					presetClass: 'entr' as const,
					effectFilter: { family: 'random', raw: 'random' },
				} as PptxNativeAnimation;
				picks.add(resolveFilterEffect(anim));
			}
			// 20 distinct element ids against a pool of ~19 effects should not all
			// collide onto a single pick.
			expect(picks.size).toBeGreaterThan(1);
		});

		it('always resolves to a defined effect (never the undefined/generic fallback)', () => {
			for (let i = 0; i < 20; i++) {
				const anim = {
					targetId: `shape-${i}`,
					presetClass: 'entr' as const,
					effectFilter: { family: 'random', raw: 'random' },
				} as PptxNativeAnimation;
				expect(resolveFilterEffect(anim)).toBeDefined();
			}
		});
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
