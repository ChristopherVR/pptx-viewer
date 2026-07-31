import { describe, expect, it } from 'vitest';

import {
	actionTypeNeedsTarget,
	canCommitActionType,
	ELEMENT_ACTION_TYPE_OPTIONS,
	resolveActionType,
	toSlideIndex,
} from './element-action-options';

describe('eLEMENT_ACTION_TYPE_OPTIONS', () => {
	it('offers "none" first so an unset action reads as no action', () => {
		expect(ELEMENT_ACTION_TYPE_OPTIONS[0].value).toBe('none');
	});

	it('covers every action kind exactly once with a dictionary key', () => {
		const values = ELEMENT_ACTION_TYPE_OPTIONS.map((option) => option.value);
		expect(values).toStrictEqual([
			'none',
			'url',
			'slide',
			'firstSlide',
			'lastSlide',
			'prevSlide',
			'nextSlide',
			'endShow',
		]);
		for (const option of ELEMENT_ACTION_TYPE_OPTIONS) {
			expect(option.labelKey).toMatch(/^pptx\./);
		}
	});
});

describe('actionTypeNeedsTarget', () => {
	it('flags only the two kinds that carry an extra value', () => {
		expect(actionTypeNeedsTarget('url')).toBeTruthy();
		expect(actionTypeNeedsTarget('slide')).toBeTruthy();
		for (const type of ['none', 'firstSlide', 'lastSlide', 'prevSlide', 'nextSlide', 'endShow']) {
			expect(actionTypeNeedsTarget(type as 'none')).toBeFalsy();
		}
	});
});

describe('resolveActionType', () => {
	it('lets the freshly picked type win so its input can appear', () => {
		expect(resolveActionType('url', 'none')).toBe('url');
	});

	it('falls back to the committed type, then to none', () => {
		expect(resolveActionType(undefined, 'nextSlide')).toBe('nextSlide');
		expect(resolveActionType(undefined, undefined)).toBe('none');
	});
});

describe('canCommitActionType', () => {
	it('holds back a target-less url or slide action', () => {
		expect(canCommitActionType('url', {})).toBeFalsy();
		expect(canCommitActionType('url', { url: '' })).toBeFalsy();
		expect(canCommitActionType('slide', {})).toBeFalsy();
	});

	it('commits once the target is there', () => {
		expect(canCommitActionType('url', { url: 'https://example.com' })).toBeTruthy();
		expect(canCommitActionType('slide', { slideIndex: 0 })).toBeTruthy();
	});

	it('commits target-free kinds straight away', () => {
		expect(canCommitActionType('none', {})).toBeTruthy();
		expect(canCommitActionType('endShow', {})).toBeTruthy();
	});
});

describe('toSlideIndex', () => {
	it('converts the 1-based display number to a 0-based index', () => {
		expect(toSlideIndex(1, 5)).toBe(0);
		expect(toSlideIndex(3, 5)).toBe(2);
	});

	it('clamps out-of-range input to the deck', () => {
		expect(toSlideIndex(0, 5)).toBe(0);
		expect(toSlideIndex(-4, 5)).toBe(0);
		expect(toSlideIndex(99, 5)).toBe(4);
	});

	it('never returns a negative index for an empty deck', () => {
		expect(toSlideIndex(3, 0)).toBe(0);
	});

	it('returns undefined for a non-numeric entry', () => {
		expect(toSlideIndex(Number.NaN, 5)).toBeUndefined();
	});
});
