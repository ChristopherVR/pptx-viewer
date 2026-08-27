import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	AFTER_ANIMATION_VALUES,
	DEFAULT_AFTER_ANIMATION_DIM_COLOR,
	getAfterAnimation,
	setAfterAnimation,
	setAfterAnimationColor,
} from './animation-after-effect-authoring';

const BASE: PptxElementAnimation = {
	elementId: 'el-1',
	entrance: 'fadeIn',
	durationMs: 500,
	order: 0,
	trigger: 'onClick',
};

describe('after animation values catalogue', () => {
	it('lists none, dimToColor, hideAfterAnimation, hideOnNextClick', () => {
		expect(AFTER_ANIMATION_VALUES).toStrictEqual([
			'none',
			'dimToColor',
			'hideAfterAnimation',
			'hideOnNextClick',
		]);
	});
});

describe('getAfterAnimation', () => {
	it('defaults to "none" when there is no animation entry', () => {
		expect(getAfterAnimation([], 'missing')).toBe('none');
	});

	it('defaults to "none" when the entry has no afterAnimation set', () => {
		expect(getAfterAnimation([BASE], 'el-1')).toBe('none');
	});

	it('reads the current action', () => {
		const anims = [{ ...BASE, afterAnimation: 'hideOnNextClick' as const }];
		expect(getAfterAnimation(anims, 'el-1')).toBe('hideOnNextClick');
	});
});

describe('setAfterAnimation', () => {
	it('sets dimToColor and seeds a default colour when none was set', () => {
		const result = setAfterAnimation([BASE], 'el-1', 'dimToColor');
		expect(result[0].afterAnimation).toBe('dimToColor');
		expect(result[0].afterAnimationColor).toBe(DEFAULT_AFTER_ANIMATION_DIM_COLOR);
	});

	it('keeps an existing dim colour when re-selecting dimToColor', () => {
		const anims = [
			{ ...BASE, afterAnimation: 'dimToColor' as const, afterAnimationColor: '#123456' },
		];
		const result = setAfterAnimation(anims, 'el-1', 'dimToColor');
		expect(result[0].afterAnimationColor).toBe('#123456');
	});

	it('clears afterAnimationColor when switching away from dimToColor', () => {
		const anims = [
			{ ...BASE, afterAnimation: 'dimToColor' as const, afterAnimationColor: '#123456' },
		];
		const result = setAfterAnimation(anims, 'el-1', 'hideAfterAnimation');
		expect(result[0].afterAnimation).toBe('hideAfterAnimation');
		expect(result[0].afterAnimationColor).toBeUndefined();
	});

	it('treats "none" as clearing the action', () => {
		const anims = [{ ...BASE, afterAnimation: 'hideOnNextClick' as const }];
		const result = setAfterAnimation(anims, 'el-1', 'none');
		expect(result[0].afterAnimation).toBeUndefined();
	});

	it('creates a new animation entry when the element had none yet', () => {
		const result = setAfterAnimation([], 'el-9', 'hideOnNextClick');
		expect(result).toHaveLength(1);
		expect(getAfterAnimation(result, 'el-9')).toBe('hideOnNextClick');
	});
});

describe('setAfterAnimationColor', () => {
	it('updates the colour when dimToColor is already active', () => {
		const anims = [
			{ ...BASE, afterAnimation: 'dimToColor' as const, afterAnimationColor: '#000000' },
		];
		const result = setAfterAnimationColor(anims, 'el-1', '#ABCDEF');
		expect(result[0].afterAnimationColor).toBe('#ABCDEF');
	});

	it('is a no-op when dimToColor is not the active action', () => {
		const anims = [{ ...BASE, afterAnimation: 'hideAfterAnimation' as const }];
		const result = setAfterAnimationColor(anims, 'el-1', '#ABCDEF');
		expect(result[0]).toStrictEqual(anims[0]);
	});

	it('is a no-op when the element has no animation entry', () => {
		const result = setAfterAnimationColor([], 'el-1', '#ABCDEF');
		expect(result).toStrictEqual([]);
	});
});
