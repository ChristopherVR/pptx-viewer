import type { PptxSlide, SummaryZoomTarget, ZoomPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	beginZoomExcursion,
	buildZoomTransitionOverride,
	resolveForwardSlideWithZoomReturn,
	resolveSummaryZoomTileNavigationTarget,
	resolveZoomExcursionEndIndex,
	resolveZoomNavigationTarget,
} from './zoom-return-navigation';

function slide(sectionId?: string): Pick<PptxSlide, 'sectionId'> {
	return { sectionId };
}

function zoomElement(overrides: Partial<ZoomPptxElement> = {}): ZoomPptxElement {
	return {
		type: 'zoom',
		id: 'zm1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zoomType: 'slide',
		targetSlideIndex: 3,
		...overrides,
	} as ZoomPptxElement;
}

describe('resolveZoomNavigationTarget', () => {
	it('reads a Slide Zoom target', () => {
		const el = zoomElement({ returnToParent: true, transitionDurationMs: 500 });
		expect(resolveZoomNavigationTarget(el)).toStrictEqual({
			targetSlideIndex: 3,
			targetSectionId: undefined,
			returnToParent: true,
			transitionDurationMs: 500,
		});
	});

	it('reads a Section Zoom target with its section id', () => {
		const el = zoomElement({ zoomType: 'section', targetSectionId: 'sec-1' });
		expect(resolveZoomNavigationTarget(el)).toStrictEqual({
			targetSlideIndex: 3,
			targetSectionId: 'sec-1',
			// `returnToParent` omitted: MS-PPTX's `CT_ZoomObjectProperties` schema
			// declares `default="true"` for this attribute, so an absent value
			// means true, not false.
			returnToParent: true,
			transitionDurationMs: undefined,
		});
	});

	it('treats an explicit returnToParent=false as false, not the schema default', () => {
		const el = zoomElement({ returnToParent: false });
		expect(resolveZoomNavigationTarget(el)?.returnToParent).toBeFalsy();
	});

	it('returns undefined for a Summary Zoom container (use the tile resolver instead)', () => {
		const el = zoomElement({ zoomType: 'summary' });
		expect(resolveZoomNavigationTarget(el)).toBeUndefined();
	});
});

describe('resolveSummaryZoomTileNavigationTarget', () => {
	it('reads a tile’s own returnToParent/transitionDurationMs', () => {
		const tile: SummaryZoomTarget = {
			sectionId: 'sec-2',
			targetSlideIndex: 5,
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			returnToParent: true,
			transitionDurationMs: 800,
		};
		expect(resolveSummaryZoomTileNavigationTarget(tile)).toStrictEqual({
			targetSlideIndex: 5,
			targetSectionId: 'sec-2',
			returnToParent: true,
			transitionDurationMs: 800,
		});
	});

	it('returns undefined for a missing tile', () => {
		expect(resolveSummaryZoomTileNavigationTarget(undefined)).toBeUndefined();
	});
});

describe('resolveZoomExcursionEndIndex', () => {
	it('is the target slide itself when there is no target section', () => {
		expect(resolveZoomExcursionEndIndex({ targetSlideIndex: 4 }, [])).toBe(4);
	});

	it('is the last slide of the contiguous section run', () => {
		const slides = [slide('a'), slide('sec'), slide('sec'), slide('sec'), slide('b')];
		expect(
			resolveZoomExcursionEndIndex({ targetSlideIndex: 1, targetSectionId: 'sec' }, slides),
		).toBe(3);
	});

	it('is the target slide when the section run is a single slide', () => {
		const slides = [slide('a'), slide('sec'), slide('b')];
		expect(
			resolveZoomExcursionEndIndex({ targetSlideIndex: 1, targetSectionId: 'sec' }, slides),
		).toBe(1);
	});
});

describe('beginZoomExcursion', () => {
	const slides = [slide('a'), slide('sec'), slide('sec'), slide('b')];

	it('returns undefined only when returnToParent is explicitly false', () => {
		const target = resolveZoomNavigationTarget(zoomElement({ returnToParent: false }))!;
		expect(beginZoomExcursion(target, 0, slides)).toBeUndefined();
	});

	it('begins an excursion when returnToParent is omitted (schema default is true)', () => {
		const target = resolveZoomNavigationTarget(zoomElement())!;
		expect(beginZoomExcursion(target, 0, slides)).toBeDefined();
	});

	it('captures the return slide, end slide, and transition duration', () => {
		const target = resolveZoomNavigationTarget(
			zoomElement({
				zoomType: 'section',
				targetSlideIndex: 1,
				targetSectionId: 'sec',
				returnToParent: true,
				transitionDurationMs: 300,
			}),
		)!;
		expect(beginZoomExcursion(target, 0, slides)).toStrictEqual({
			returnSlideIndex: 0,
			endSlideIndex: 2,
			transitionDurationMs: 300,
		});
	});
});

describe('resolveForwardSlideWithZoomReturn', () => {
	it('returns to the origin slide once the excursion end is reached', () => {
		const excursion = { returnSlideIndex: 0, endSlideIndex: 2, transitionDurationMs: 300 };
		const step = resolveForwardSlideWithZoomReturn(2, 3, excursion);
		expect(step).toStrictEqual({ nextSlideIndex: 0, excursion: undefined, returnedToZoom: true });
	});

	it('leaves the natural next slide and excursion untouched before the end', () => {
		const excursion = { returnSlideIndex: 0, endSlideIndex: 2, transitionDurationMs: 300 };
		const step = resolveForwardSlideWithZoomReturn(1, 2, excursion);
		expect(step).toStrictEqual({ nextSlideIndex: 2, excursion, returnedToZoom: false });
	});

	it('passes naturalNextIndex through untouched when there is no excursion', () => {
		const step = resolveForwardSlideWithZoomReturn(5, 6, undefined);
		expect(step).toStrictEqual({ nextSlideIndex: 6, excursion: undefined, returnedToZoom: false });
	});
});

describe('buildZoomTransitionOverride', () => {
	it('builds a zoom-type transition for a positive duration', () => {
		expect(buildZoomTransitionOverride(400)).toStrictEqual({ type: 'zoom', durationMs: 400 });
	});

	it('is undefined for an absent or non-positive duration', () => {
		expect(buildZoomTransitionOverride(undefined)).toBeUndefined();
		expect(buildZoomTransitionOverride(0)).toBeUndefined();
		expect(buildZoomTransitionOverride(-1)).toBeUndefined();
	});
});
