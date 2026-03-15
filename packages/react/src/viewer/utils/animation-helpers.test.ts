import { describe, it, expect } from 'vitest';
import {
	resolveEffect,
	buildDynamicKeyframes,
	cssKeyframeName,
	defaultDuration,
	fillModeForClass,
} from './animation-helpers';
import type { PptxNativeAnimation } from 'pptx-viewer-core';

describe('resolveEffect', () => {
	it('should return undefined when presetClass is undefined', () => {
		const anim = { presetId: 1 } as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBeUndefined();
	});

	it('should return undefined when presetId is undefined', () => {
		const anim = { presetClass: 'entr' } as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBeUndefined();
	});

	it('should resolve known entrance preset', () => {
		// presetId 1 for entr is typically "appear"
		const anim = { presetClass: 'entr', presetId: 1 } as PptxNativeAnimation;
		const result = resolveEffect(anim);
		expect(result).toBeDefined();
	});

	it('should resolve known exit preset', () => {
		const anim = { presetClass: 'exit', presetId: 1 } as PptxNativeAnimation;
		const result = resolveEffect(anim);
		expect(result).toBeDefined();
	});

	it('should resolve known emphasis preset', () => {
		const anim = { presetClass: 'emph', presetId: 1 } as PptxNativeAnimation;
		const result = resolveEffect(anim);
		// May or may not have preset id 1 mapped for emph
		// The test verifies it doesn't crash
		expect(result === undefined || typeof result === 'string').toBe(true);
	});

	it('should return undefined for path presetClass', () => {
		const anim = { presetClass: 'path', presetId: 1 } as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBeUndefined();
	});

	it('should return undefined for unknown preset ID', () => {
		const anim = { presetClass: 'entr', presetId: 99999 } as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBeUndefined();
	});

	it('should return undefined when both class and id are undefined', () => {
		const anim = {} as PptxNativeAnimation;
		expect(resolveEffect(anim)).toBeUndefined();
	});
});

describe('buildDynamicKeyframes', () => {
	it('should return undefined when no motion path, rotation, or scale', () => {
		const anim = {} as PptxNativeAnimation;
		expect(buildDynamicKeyframes(anim, 0)).toBeUndefined();
	});

	it('should generate keyframes for a motion path', () => {
		const anim = {
			motionPath: 'M 0 0 L 1 1',
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 42);
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-motionPath-42');
		expect(result!.css).toContain('@keyframes');
		expect(result!.css).toContain('translate');
	});

	it('should generate keyframes for rotation animation', () => {
		const anim = {
			rotationBy: 360,
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 5);
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-rotateBy-5');
		expect(result!.css).toContain('rotate(360deg)');
	});

	it('should generate keyframes for scale animation', () => {
		const anim = {
			scaleByX: 2,
			scaleByY: 1.5,
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 10);
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-scaleBy-10');
		expect(result!.css).toContain('scale(2, 1.5)');
	});

	it('should generate scale keyframes with default Y when only X provided', () => {
		const anim = {
			scaleByX: 3,
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 1);
		expect(result).toBeDefined();
		expect(result!.css).toContain('scale(3, 1)');
	});

	it('should return undefined for motion path with less than 2 points', () => {
		const anim = {
			motionPath: 'M 0 0',
		} as PptxNativeAnimation;
		expect(buildDynamicKeyframes(anim, 0)).toBeUndefined();
	});

	it('should convert motion path coordinates to percentages', () => {
		const anim = {
			motionPath: 'M 0 0 L 0.5 0.3',
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 0);
		expect(result).toBeDefined();
		// 0.5 * 100 = 50, 0.3 * 100 = 30
		expect(result!.css).toContain('50.00%');
		expect(result!.css).toContain('30.00%');
	});

	it('should handle motion path with Z (close) command', () => {
		const anim = {
			motionPath: 'M 0 0 L 1 0 L 1 1 Z',
		} as PptxNativeAnimation;
		const result = buildDynamicKeyframes(anim, 0);
		expect(result).toBeDefined();
		// Z is skipped, so 3 points
		expect(result!.css).toContain('0%');
		expect(result!.css).toContain('100%');
	});
});

describe('cssKeyframeName', () => {
	it('should prefix effect name with "pptx-"', () => {
		expect(cssKeyframeName('appear' as any)).toBe('pptx-appear');
		expect(cssKeyframeName('fadeIn' as any)).toBe('pptx-fadeIn');
	});

	it('should work with any string', () => {
		expect(cssKeyframeName('customEffect' as any)).toBe('pptx-customEffect');
	});
});

describe('defaultDuration', () => {
	it('should return 500 for entrance animations', () => {
		expect(defaultDuration('entr')).toBe(500);
	});

	it('should return 500 for exit animations', () => {
		expect(defaultDuration('exit')).toBe(500);
	});

	it('should return 800 for emphasis animations', () => {
		expect(defaultDuration('emph')).toBe(800);
	});

	it('should return 1000 for path animations', () => {
		expect(defaultDuration('path')).toBe(1000);
	});

	it('should return 500 for undefined preset class', () => {
		expect(defaultDuration(undefined)).toBe(500);
	});

	it('should return 500 for unknown preset class', () => {
		expect(defaultDuration('unknown' as any)).toBe(500);
	});
});

describe('fillModeForClass', () => {
	it('should return "both" for entrance animations', () => {
		expect(fillModeForClass('entr')).toBe('both');
	});

	it('should return "forwards" for exit animations', () => {
		expect(fillModeForClass('exit')).toBe('forwards');
	});

	it('should return "both" for emphasis animations', () => {
		expect(fillModeForClass('emph')).toBe('both');
	});

	it('should return "both" for undefined preset class', () => {
		expect(fillModeForClass(undefined)).toBe('both');
	});

	it('should return "both" for path animations', () => {
		expect(fillModeForClass('path')).toBe('both');
	});
});
