import { describe, it, expect } from 'vitest';

import { getEffectKeyframes } from './animation-keyframes';
import type { EffectName } from './animation-timeline-types';

describe('getEffectKeyframes', () => {
	it('should return a keyframe string for "appear"', () => {
		const kf = getEffectKeyframes('appear');
		expect(kf).toContain('@keyframes pptx-appear');
		expect(kf).toContain('opacity: 0');
		expect(kf).toContain('opacity: 1');
	});

	it('should return a keyframe string for "fadeIn"', () => {
		const kf = getEffectKeyframes('fadeIn');
		expect(kf).toContain('@keyframes pptx-fadeIn');
		expect(kf).toContain('from');
		expect(kf).toContain('to');
	});

	it('should return a keyframe string for "flyInLeft"', () => {
		const kf = getEffectKeyframes('flyInLeft');
		expect(kf).toContain('@keyframes pptx-flyInLeft');
		expect(kf).toContain('translateX(-100%)');
		expect(kf).toContain('translateX(0)');
	});

	it('should return a keyframe string for "flyInRight"', () => {
		const kf = getEffectKeyframes('flyInRight');
		expect(kf).toContain('@keyframes pptx-flyInRight');
		expect(kf).toContain('translateX(100%)');
	});

	it('should return a keyframe string for "zoomIn"', () => {
		const kf = getEffectKeyframes('zoomIn');
		expect(kf).toContain('@keyframes pptx-zoomIn');
		expect(kf).toContain('scale(0.3)');
		expect(kf).toContain('scale(1)');
	});

	it('should return a keyframe string for "bounceIn" with multi-step percentages', () => {
		const kf = getEffectKeyframes('bounceIn');
		expect(kf).toContain('@keyframes pptx-bounceIn');
		expect(kf).toContain('0%');
		expect(kf).toContain('50%');
		expect(kf).toContain('100%');
	});

	it('should return mask-reveal keyframes for "wipeIn" (never clip-path)', () => {
		const kf = getEffectKeyframes('wipeIn');
		expect(kf).toContain('@keyframes pptx-wipeIn');
		// A clip-path keyframe would clobber the element's own geometry clip.
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-image: linear-gradient(to right, #000 50%, transparent 50%)');
		expect(kf).toContain('mask-position: 100% 0%');
		expect(kf).toContain('mask-position: 0% 0%');
	});

	it('should return mask-reveal keyframes for "splitIn"', () => {
		const kf = getEffectKeyframes('splitIn');
		expect(kf).toContain('@keyframes pptx-splitIn');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-size: 100% 0%');
		expect(kf).toContain('mask-size: 100% 101%');
	});

	it('should return exit keyframes for "fadeOut"', () => {
		const kf = getEffectKeyframes('fadeOut');
		expect(kf).toContain('@keyframes pptx-fadeOut');
		expect(kf).toContain('opacity: 1');
		expect(kf).toContain('opacity: 0');
	});

	it('should return exit keyframes for "zoomOut"', () => {
		const kf = getEffectKeyframes('zoomOut');
		expect(kf).toContain('@keyframes pptx-zoomOut');
		expect(kf).toContain('scale(1)');
		expect(kf).toContain('scale(0.3)');
	});

	it('should return emphasis keyframes for "pulse"', () => {
		const kf = getEffectKeyframes('pulse');
		expect(kf).toContain('@keyframes pptx-pulse');
		expect(kf).toContain('scale(1.1)');
	});

	it('should return emphasis keyframes for "spin"', () => {
		const kf = getEffectKeyframes('spin');
		expect(kf).toContain('@keyframes pptx-spin');
		expect(kf).toContain('rotate(0deg)');
		expect(kf).toContain('rotate(360deg)');
	});

	it('should return emphasis keyframes for "teeter"', () => {
		const kf = getEffectKeyframes('teeter');
		expect(kf).toContain('@keyframes pptx-teeter');
		expect(kf).toContain('rotate(5deg)');
		expect(kf).toContain('rotate(-5deg)');
	});

	it('should return emphasis keyframes for "boldFlash"', () => {
		const kf = getEffectKeyframes('boldFlash');
		expect(kf).toContain('@keyframes pptx-boldFlash');
		expect(kf).toContain('font-weight');
	});

	it('should return emphasis keyframes for "wave"', () => {
		const kf = getEffectKeyframes('wave');
		expect(kf).toContain('@keyframes pptx-wave');
		expect(kf).toContain('translateY(-8px)');
		expect(kf).toContain('translateY(8px)');
	});

	it('should return empty string for an unknown effect name', () => {
		const kf = getEffectKeyframes('nonExistentEffect' as EffectName);
		expect(kf).toBe('');
	});

	it('should return dissolve keyframes with blur filter', () => {
		const kf = getEffectKeyframes('dissolveIn');
		expect(kf).toContain('@keyframes pptx-dissolveIn');
		expect(kf).toContain('blur(8px)');
		expect(kf).toContain('blur(0)');
	});

	it('should return exit keyframes for "disappear"', () => {
		const kf = getEffectKeyframes('disappear');
		expect(kf).toContain('@keyframes pptx-disappear');
	});

	it('should return keyframes for "flyOutBottom"', () => {
		const kf = getEffectKeyframes('flyOutBottom');
		expect(kf).toContain('@keyframes pptx-flyOutBottom');
		expect(kf).toContain('translateY(100%)');
	});

	it('should return keyframes for "flyInTop"', () => {
		const kf = getEffectKeyframes('flyInTop');
		expect(kf).toContain('@keyframes pptx-flyInTop');
		expect(kf).toContain('translateY(-100%)');
		expect(kf).toContain('translateY(0)');
	});

	it('should return keyframes for "flyInBottom"', () => {
		const kf = getEffectKeyframes('flyInBottom');
		expect(kf).toContain('@keyframes pptx-flyInBottom');
		expect(kf).toContain('translateY(100%)');
		expect(kf).toContain('translateY(0)');
	});

	it('should return keyframes for "flyOutLeft"', () => {
		const kf = getEffectKeyframes('flyOutLeft');
		expect(kf).toContain('@keyframes pptx-flyOutLeft');
		expect(kf).toContain('translateX(-100%)');
	});

	it('should return keyframes for "flyOutRight"', () => {
		const kf = getEffectKeyframes('flyOutRight');
		expect(kf).toContain('@keyframes pptx-flyOutRight');
		expect(kf).toContain('translateX(100%)');
	});

	it('should return keyframes for "flyOutTop"', () => {
		const kf = getEffectKeyframes('flyOutTop');
		expect(kf).toContain('@keyframes pptx-flyOutTop');
		expect(kf).toContain('translateY(-100%)');
	});

	it('should return keyframes for "bounceOut"', () => {
		const kf = getEffectKeyframes('bounceOut');
		expect(kf).toContain('@keyframes pptx-bounceOut');
		expect(kf).toContain('scale(0.3)');
	});

	it('should return keyframes for "shrinkOut"', () => {
		const kf = getEffectKeyframes('shrinkOut');
		expect(kf).toContain('@keyframes pptx-shrinkOut');
		expect(kf).toContain('scale(0)');
	});

	it('should return keyframes for "wipeOut"', () => {
		const kf = getEffectKeyframes('wipeOut');
		expect(kf).toContain('@keyframes pptx-wipeOut');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-image');
		expect(kf).toContain('opacity: 0');
	});

	it('should return keyframes for "dissolveOut"', () => {
		const kf = getEffectKeyframes('dissolveOut');
		expect(kf).toContain('@keyframes pptx-dissolveOut');
		expect(kf).toContain('blur(8px)');
	});

	it('should return keyframes for "growShrink"', () => {
		const kf = getEffectKeyframes('growShrink');
		expect(kf).toContain('@keyframes pptx-growShrink');
		expect(kf).toContain('scale(1.25)');
	});

	it('should return keyframes for "transparency"', () => {
		const kf = getEffectKeyframes('transparency');
		expect(kf).toContain('@keyframes pptx-transparency');
		expect(kf).toContain('opacity: 0.4');
	});

	it('should return keyframes for "colorWave"', () => {
		const kf = getEffectKeyframes('colorWave');
		expect(kf).toContain('@keyframes pptx-colorWave');
		expect(kf).toContain('hue-rotate');
	});

	it('should return keyframes for "bounce"', () => {
		const kf = getEffectKeyframes('bounce');
		expect(kf).toContain('@keyframes pptx-bounce');
		expect(kf).toContain('translateY(-20px)');
	});

	it('should return mask-reveal keyframes for "diamondIn"', () => {
		const kf = getEffectKeyframes('diamondIn');
		expect(kf).toContain('@keyframes pptx-diamondIn');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-image');
		expect(kf).toContain('mask-size: 0% 0%');
		expect(kf).toContain('mask-size: 150% 150%');
	});

	it('should return a two-layer union mask for "plusIn"', () => {
		const kf = getEffectKeyframes('plusIn');
		expect(kf).toContain('@keyframes pptx-plusIn');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-size: 100% 0%, 0% 100%');
		expect(kf).toContain('mask-size: 100% 101%, 101% 100%');
	});

	it('should return mask-reveal keyframes for "wedgeIn"', () => {
		const kf = getEffectKeyframes('wedgeIn');
		expect(kf).toContain('@keyframes pptx-wedgeIn');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-size: 0% 0%');
		expect(kf).toContain('mask-size: 220% 220%');
	});

	it('should return a near-instant opacity swap for "cutIn" (not a gradual fade)', () => {
		const kf = getEffectKeyframes('cutIn');
		expect(kf).toContain('@keyframes pptx-cutIn');
		expect(kf).toContain('0% { opacity: 0; }');
		expect(kf).toContain('1% { opacity: 1; }');
		expect(kf).toContain('100% { opacity: 1; }');
	});

	it('should return a near-instant opacity swap for "cutOut" (not a gradual fade)', () => {
		const kf = getEffectKeyframes('cutOut');
		expect(kf).toContain('@keyframes pptx-cutOut');
		expect(kf).toContain('0% { opacity: 1; }');
		expect(kf).toContain('99% { opacity: 1; }');
		expect(kf).toContain('100% { opacity: 0; }');
	});

	it('should return a mask-reveal keyframe for "boxOut" that closes (shown -> hidden)', () => {
		const kf = getEffectKeyframes('boxOut');
		expect(kf).toContain('@keyframes pptx-boxOut');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-size: 101% 101%');
		expect(kf).toContain('mask-size: 0% 0%');
		expect(kf).toContain('opacity: 0');
	});

	it('should return a reverse fade for "checkerboardOut" (mirrors checkerboardIn)', () => {
		const kf = getEffectKeyframes('checkerboardOut');
		expect(kf).toContain('@keyframes pptx-checkerboardOut');
		expect(kf).toContain('0% { opacity: 1; }');
		expect(kf).toContain('100% { opacity: 0; }');
	});

	it('should return an edge-mask reveal for "blindsOut" that closes from the top', () => {
		const kf = getEffectKeyframes('blindsOut');
		expect(kf).toContain('@keyframes pptx-blindsOut');
		expect(kf).toContain('mask-image');
		expect(kf).toContain('opacity: 0');
	});

	it('should return a reverse rotate/scale for "wheelOut" (mirrors wheelIn)', () => {
		const kf = getEffectKeyframes('wheelOut');
		expect(kf).toContain('@keyframes pptx-wheelOut');
		expect(kf).toContain('rotate(0deg)');
		expect(kf).toContain('rotate(360deg)');
		expect(kf).toContain('opacity: 0');
	});

	it('should return a closing bar-sweep mask for "randomBarsOut"', () => {
		const kf = getEffectKeyframes('randomBarsOut');
		expect(kf).toContain('@keyframes pptx-randomBarsOut');
		expect(kf).toContain('mask-image');
		expect(kf).toContain('opacity: 0');
	});

	it('should return a mask-reveal keyframe for "diamondOut" that closes (shown -> hidden)', () => {
		const kf = getEffectKeyframes('diamondOut');
		expect(kf).toContain('@keyframes pptx-diamondOut');
		expect(kf).not.toContain('clip-path');
		expect(kf).toContain('mask-size: 150% 150%');
		expect(kf).toContain('mask-size: 0% 0%');
	});

	it('should return a two-layer union mask for "plusOut" that closes (shown -> hidden)', () => {
		const kf = getEffectKeyframes('plusOut');
		expect(kf).toContain('@keyframes pptx-plusOut');
		expect(kf).toContain('mask-size: 100% 101%, 101% 100%');
		expect(kf).toContain('mask-size: 100% 0%, 0% 100%');
	});

	it('should return a mask-reveal keyframe for "wedgeOut" that closes (shown -> hidden)', () => {
		const kf = getEffectKeyframes('wedgeOut');
		expect(kf).toContain('@keyframes pptx-wedgeOut');
		expect(kf).toContain('mask-size: 220% 220%');
		expect(kf).toContain('mask-size: 0% 0%');
	});

	it('should return keyframes for "flash"', () => {
		const kf = getEffectKeyframes('flash');
		expect(kf).toContain('@keyframes pptx-flash');
		expect(kf).toContain('opacity: 0');
		expect(kf).toContain('opacity: 1');
	});

	it('should return keyframes with from/to structure for entrance effects', () => {
		const kf = getEffectKeyframes('appear');
		expect(kf).toContain('from');
		expect(kf).toContain('to');
	});

	it('should return keyframes for all exit effects', () => {
		const exitEffects = [
			'disappear',
			'fadeOut',
			'flyOutLeft',
			'flyOutRight',
			'flyOutTop',
			'flyOutBottom',
			'zoomOut',
			'bounceOut',
			'wipeOut',
			'shrinkOut',
			'dissolveOut',
		] as const;
		for (const effect of exitEffects) {
			const kf = getEffectKeyframes(effect);
			expect(kf).toContain(`@keyframes pptx-${effect}`);
		}
	});
});
