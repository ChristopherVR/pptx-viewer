import type { PptxAnimationPreset, PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { getInitialStyleForEffect, getAnimationInitialStyle } from './animation-effects';
import type { EffectName } from './animation-timeline-types';

describe('getInitialStyleForEffect', () => {
	it('should return opacity 0 for "appear"', () => {
		const style = getInitialStyleForEffect('appear');
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return opacity 0 for "fadeIn"', () => {
		const style = getInitialStyleForEffect('fadeIn');
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return translateX(-100%) for "flyInLeft"', () => {
		const style = getInitialStyleForEffect('flyInLeft');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateX(-100%)' });
	});

	it('should return translateX(100%) for "flyInRight"', () => {
		const style = getInitialStyleForEffect('flyInRight');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateX(100%)' });
	});

	it('should return translateY(-100%) for "flyInTop"', () => {
		const style = getInitialStyleForEffect('flyInTop');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateY(-100%)' });
	});

	it('should return translateY(100%) for "flyInBottom"', () => {
		const style = getInitialStyleForEffect('flyInBottom');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateY(100%)' });
	});

	it('should return scale(0.3) for "zoomIn"', () => {
		const style = getInitialStyleForEffect('zoomIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'scale(0.3)' });
	});

	it('should return scale(0.3) for "bounceIn"', () => {
		const style = getInitialStyleForEffect('bounceIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'scale(0.3)' });
	});

	it('should return clip-path based style for "wipeIn"', () => {
		const style = getInitialStyleForEffect('wipeIn');
		expect(style).toStrictEqual({ clipPath: 'inset(0 100% 0 0)', opacity: 1 });
	});

	it('should return clip-path based style for "splitIn"', () => {
		const style = getInitialStyleForEffect('splitIn');
		expect(style).toStrictEqual({ clipPath: 'inset(50% 0 50% 0)', opacity: 1 });
	});

	it('should return blur filter for "dissolveIn"', () => {
		const style = getInitialStyleForEffect('dissolveIn');
		expect(style).toStrictEqual({ opacity: 0, filter: 'blur(8px)' });
	});

	it('should return rotate+scale for "wheelIn"', () => {
		const style = getInitialStyleForEffect('wheelIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'rotate(-360deg) scale(0.5)' });
	});

	it('should return clip-path for "blindsIn"', () => {
		const style = getInitialStyleForEffect('blindsIn');
		expect(style).toStrictEqual({ clipPath: 'inset(0 0 100% 0)', opacity: 1 });
	});

	it('should return clip-path for "boxIn"', () => {
		const style = getInitialStyleForEffect('boxIn');
		expect(style).toStrictEqual({ clipPath: 'inset(50% 50% 50% 50%)', opacity: 1 });
	});

	it('should return translateY(40px) for "floatIn"', () => {
		const style = getInitialStyleForEffect('floatIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateY(40px)' });
	});

	it('should return translateY(60px) for "riseUp"', () => {
		const style = getInitialStyleForEffect('riseUp');
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateY(60px)' });
	});

	it('should return rotateY(-90deg) for "swivel"', () => {
		const style = getInitialStyleForEffect('swivel');
		expect(style).toStrictEqual({ opacity: 0, transform: 'rotateY(-90deg)' });
	});

	it('should return scale(0, 0) for "expandIn"', () => {
		const style = getInitialStyleForEffect('expandIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'scale(0, 0)' });
	});

	it('should return opacity 0 for "checkerboardIn"', () => {
		const style = getInitialStyleForEffect('checkerboardIn');
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return opacity 0 for "flashIn"', () => {
		const style = getInitialStyleForEffect('flashIn');
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return clip-path for "peekIn"', () => {
		const style = getInitialStyleForEffect('peekIn');
		expect(style).toStrictEqual({ clipPath: 'inset(100% 0 0 0)', opacity: 1 });
	});

	it('should return rotate(-720deg) for "spinnerIn"', () => {
		const style = getInitialStyleForEffect('spinnerIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'rotate(-720deg) scale(0.4)' });
	});

	it('should return rotate(-90deg) for "growTurnIn"', () => {
		const style = getInitialStyleForEffect('growTurnIn');
		expect(style).toStrictEqual({ opacity: 0, transform: 'rotate(-90deg) scale(0.4)' });
	});

	it('should return opacity 0 as default for unknown effects', () => {
		const style = getInitialStyleForEffect('unknownEffect' as EffectName);
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return clip-path based style for "randomBarsIn"', () => {
		const style = getInitialStyleForEffect('randomBarsIn');
		expect(style).toStrictEqual({ clipPath: 'inset(0 100% 0 0)', opacity: 1 });
	});
});

describe('getAnimationInitialStyle', () => {
	it('should return empty object for undefined preset and no native animation', () => {
		const style = getAnimationInitialStyle(undefined);
		expect(style).toStrictEqual({});
	});

	it('should return initial style when nativeAnimation is an entrance effect', () => {
		const style = getAnimationInitialStyle(undefined, {
			targetId: 'el-1',
			presetClass: 'entr',
			presetId: 10, // fadeIn
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation);
		expect(style).toStrictEqual({ opacity: 0 });
	});

	it('should return empty object when nativeAnimation is an exit effect', () => {
		const style = getAnimationInitialStyle(undefined, {
			targetId: 'el-1',
			presetClass: 'exit',
			presetId: 10, // fadeOut
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation);
		expect(style).toStrictEqual({});
	});

	it('should return empty object when nativeAnimation is an emphasis effect', () => {
		const style = getAnimationInitialStyle(undefined, {
			targetId: 'el-1',
			presetClass: 'emph',
			presetId: 26, // pulse
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation);
		expect(style).toStrictEqual({});
	});

	it('should return empty object when nativeAnimation has unresolvable presetId', () => {
		const style = getAnimationInitialStyle(undefined, {
			targetId: 'el-1',
			presetClass: 'entr',
			presetId: 99999,
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation);
		expect(style).toStrictEqual({});
	});

	it('should return transform style for flyInBottom entrance via nativeAnimation', () => {
		const style = getAnimationInitialStyle(undefined, {
			targetId: 'el-1',
			presetClass: 'entr',
			presetId: 2, // flyInBottom
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation);
		expect(style).toStrictEqual({ opacity: 0, transform: 'translateY(100%)' });
	});

	it('should return empty object for preset-only calls (no nativeAnimation)', () => {
		expect(getAnimationInitialStyle('fadeIn')).toStrictEqual({});
		expect(getAnimationInitialStyle('fadeOut')).toStrictEqual({});
		expect(getAnimationInitialStyle('flyIn')).toStrictEqual({});
		expect(getAnimationInitialStyle('flyOut')).toStrictEqual({});
		expect(getAnimationInitialStyle('zoomIn')).toStrictEqual({});
		expect(getAnimationInitialStyle('zoomOut')).toStrictEqual({});
		expect(
			getAnimationInitialStyle('unknownPreset' as unknown as PptxAnimationPreset),
		).toStrictEqual({});
		expect(getAnimationInitialStyle('none' as unknown as PptxAnimationPreset)).toStrictEqual({});
	});
});
