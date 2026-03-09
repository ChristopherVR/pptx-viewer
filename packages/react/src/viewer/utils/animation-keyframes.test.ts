import { describe, it, expect } from 'vitest';
import { getEffectKeyframes } from './animation-keyframes';
import type { EffectName } from './animation-types';

describe('getEffectKeyframes', () => {
	it('should return a keyframe string for "appear"', () => {
		const kf = getEffectKeyframes('appear');
		expect(kf).toContain('@keyframes fuzor-appear');
		expect(kf).toContain('opacity: 0');
		expect(kf).toContain('opacity: 1');
	});

	it('should return a keyframe string for "fadeIn"', () => {
		const kf = getEffectKeyframes('fadeIn');
		expect(kf).toContain('@keyframes fuzor-fadeIn');
		expect(kf).toContain('from');
		expect(kf).toContain('to');
	});

	it('should return a keyframe string for "flyInLeft"', () => {
		const kf = getEffectKeyframes('flyInLeft');
		expect(kf).toContain('@keyframes fuzor-flyInLeft');
		expect(kf).toContain('translateX(-100%)');
		expect(kf).toContain('translateX(0)');
	});

	it('should return a keyframe string for "flyInRight"', () => {
		const kf = getEffectKeyframes('flyInRight');
		expect(kf).toContain('@keyframes fuzor-flyInRight');
		expect(kf).toContain('translateX(100%)');
	});

	it('should return a keyframe string for "zoomIn"', () => {
		const kf = getEffectKeyframes('zoomIn');
		expect(kf).toContain('@keyframes fuzor-zoomIn');
		expect(kf).toContain('scale(0.3)');
		expect(kf).toContain('scale(1)');
	});

	it('should return a keyframe string for "bounceIn" with multi-step percentages', () => {
		const kf = getEffectKeyframes('bounceIn');
		expect(kf).toContain('@keyframes fuzor-bounceIn');
		expect(kf).toContain('0%');
		expect(kf).toContain('50%');
		expect(kf).toContain('100%');
	});

	it('should return clip-path keyframes for "wipeIn"', () => {
		const kf = getEffectKeyframes('wipeIn');
		expect(kf).toContain('@keyframes fuzor-wipeIn');
		expect(kf).toContain('clip-path');
		expect(kf).toContain('inset(0 100% 0 0)');
	});

	it('should return clip-path keyframes for "splitIn"', () => {
		const kf = getEffectKeyframes('splitIn');
		expect(kf).toContain('@keyframes fuzor-splitIn');
		expect(kf).toContain('inset(50% 0 50% 0)');
	});

	it('should return exit keyframes for "fadeOut"', () => {
		const kf = getEffectKeyframes('fadeOut');
		expect(kf).toContain('@keyframes fuzor-fadeOut');
		expect(kf).toContain('opacity: 1');
		expect(kf).toContain('opacity: 0');
	});

	it('should return exit keyframes for "zoomOut"', () => {
		const kf = getEffectKeyframes('zoomOut');
		expect(kf).toContain('@keyframes fuzor-zoomOut');
		expect(kf).toContain('scale(1)');
		expect(kf).toContain('scale(0.3)');
	});

	it('should return emphasis keyframes for "pulse"', () => {
		const kf = getEffectKeyframes('pulse');
		expect(kf).toContain('@keyframes fuzor-pulse');
		expect(kf).toContain('scale(1.1)');
	});

	it('should return emphasis keyframes for "spin"', () => {
		const kf = getEffectKeyframes('spin');
		expect(kf).toContain('@keyframes fuzor-spin');
		expect(kf).toContain('rotate(0deg)');
		expect(kf).toContain('rotate(360deg)');
	});

	it('should return emphasis keyframes for "teeter"', () => {
		const kf = getEffectKeyframes('teeter');
		expect(kf).toContain('@keyframes fuzor-teeter');
		expect(kf).toContain('rotate(5deg)');
		expect(kf).toContain('rotate(-5deg)');
	});

	it('should return emphasis keyframes for "boldFlash"', () => {
		const kf = getEffectKeyframes('boldFlash');
		expect(kf).toContain('@keyframes fuzor-boldFlash');
		expect(kf).toContain('font-weight');
	});

	it('should return emphasis keyframes for "wave"', () => {
		const kf = getEffectKeyframes('wave');
		expect(kf).toContain('@keyframes fuzor-wave');
		expect(kf).toContain('translateY(-8px)');
		expect(kf).toContain('translateY(8px)');
	});

	it('should return empty string for an unknown effect name', () => {
		const kf = getEffectKeyframes('nonExistentEffect' as EffectName);
		expect(kf).toBe('');
	});

	it('should return dissolve keyframes with blur filter', () => {
		const kf = getEffectKeyframes('dissolveIn');
		expect(kf).toContain('@keyframes fuzor-dissolveIn');
		expect(kf).toContain('blur(8px)');
		expect(kf).toContain('blur(0)');
	});

	it('should return exit keyframes for "disappear"', () => {
		const kf = getEffectKeyframes('disappear');
		expect(kf).toContain('@keyframes fuzor-disappear');
	});

	it('should return keyframes for "flyOutBottom"', () => {
		const kf = getEffectKeyframes('flyOutBottom');
		expect(kf).toContain('@keyframes fuzor-flyOutBottom');
		expect(kf).toContain('translateY(100%)');
	});
});
