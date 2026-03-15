import { describe, it, expect } from 'vitest';
import {
	timingCurveToCss,
	buildPreviewAnimation,
	parseOoxmlBezierCurve,
} from './animation-preview';

describe('timingCurveToCss', () => {
	it('should return "ease" for undefined curve', () => {
		expect(timingCurveToCss(undefined)).toBe('ease');
	});

	it('should return "ease" for "ease" curve', () => {
		expect(timingCurveToCss('ease')).toBe('ease');
	});

	it('should return "ease-in" for "ease-in" curve', () => {
		expect(timingCurveToCss('ease-in')).toBe('ease-in');
	});

	it('should return "ease-out" for "ease-out" curve', () => {
		expect(timingCurveToCss('ease-out')).toBe('ease-out');
	});

	it('should return "linear" for "linear" curve', () => {
		expect(timingCurveToCss('linear')).toBe('linear');
	});

	it('should return "ease" for unknown curve name', () => {
		expect(timingCurveToCss('unknownCurve' as any)).toBe('ease');
	});

	it('should return cubic-bezier when valid cubicBezierValues are provided', () => {
		const result = timingCurveToCss(undefined, '0.25,0.1,0.25,1');
		expect(result).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)');
	});

	it('should return cubic-bezier with trimmed values', () => {
		const result = timingCurveToCss(undefined, ' 0.1 , 0.2 , 0.3 , 0.4 ');
		expect(result).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
	});

	it('should fall back to curve name when cubicBezierValues has wrong number of parts', () => {
		const result = timingCurveToCss('linear', '0.1,0.2,0.3');
		expect(result).toBe('linear');
	});

	it('should fall back to curve name when cubicBezierValues contains non-numbers', () => {
		const result = timingCurveToCss('ease-in', '0.1,abc,0.3,0.4');
		expect(result).toBe('ease-in');
	});

	it('should prefer cubicBezierValues over curve name when valid', () => {
		const result = timingCurveToCss('linear', '0.42,0,0.58,1');
		expect(result).toBe('cubic-bezier(0.42, 0, 0.58, 1)');
	});
});

describe('buildPreviewAnimation', () => {
	it('should return undefined for "none" preset', () => {
		expect(buildPreviewAnimation('none')).toBeUndefined();
	});

	it('should return a descriptor for "fadeIn" preset', () => {
		const result = buildPreviewAnimation('fadeIn');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-fadeIn');
		expect(result!.keyframesCss).toContain('@keyframes');
		expect(result!.durationMs).toBe(600);
		expect(result!.cssAnimation).toContain('pptx-fadeIn');
	});

	it('should use custom duration when provided', () => {
		const result = buildPreviewAnimation('fadeIn', { durationMs: 1000 });
		expect(result).toBeDefined();
		expect(result!.durationMs).toBe(1000);
		expect(result!.cssAnimation).toContain('1000ms');
	});

	it('should use default 600ms duration when not specified', () => {
		const result = buildPreviewAnimation('fadeIn');
		expect(result!.cssAnimation).toContain('600ms');
	});

	it('should use specified timing curve', () => {
		const result = buildPreviewAnimation('fadeIn', { timingCurve: 'linear' });
		expect(result).toBeDefined();
		expect(result!.cssAnimation).toContain('linear');
	});

	it('should return descriptor for "pulse" emphasis preset', () => {
		const result = buildPreviewAnimation('pulse');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-pulse');
	});

	it('should return descriptor for "spin" emphasis preset', () => {
		const result = buildPreviewAnimation('spin');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-spin');
	});

	it('should return undefined for an unknown preset', () => {
		const result = buildPreviewAnimation('unknownPreset' as any);
		expect(result).toBeUndefined();
	});

	it('should resolve direction-based flyIn to correct effect', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromLeft' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInLeft');
	});

	it('should resolve direction-based flyIn fromRight', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromRight' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInRight');
	});

	it('should resolve direction-based flyIn fromTop', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromTop' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInTop');
	});

	it('should resolve direction-based flyOut fromLeft to flyOutLeft', () => {
		const result = buildPreviewAnimation('flyOut', { direction: 'fromLeft' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyOutLeft');
	});

	it('should include cssAnimation with correct structure', () => {
		const result = buildPreviewAnimation('zoomIn', {
			durationMs: 800,
			timingCurve: 'ease-out',
		});
		expect(result).toBeDefined();
		expect(result!.cssAnimation).toContain('pptx-zoomIn');
		expect(result!.cssAnimation).toContain('800ms');
		expect(result!.cssAnimation).toContain('ease-out');
		expect(result!.cssAnimation).toContain('both');
	});

	it('should default flyIn without direction to flyInBottom', () => {
		const result = buildPreviewAnimation('flyIn');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInBottom');
	});

	it('should default flyOut without direction to flyOutBottom', () => {
		const result = buildPreviewAnimation('flyOut');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyOutBottom');
	});

	it('should resolve flyIn fromBottom direction', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromBottom' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInBottom');
	});

	it('should resolve flyOut fromRight direction', () => {
		const result = buildPreviewAnimation('flyOut', { direction: 'fromRight' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyOutRight');
	});

	it('should resolve flyIn fromTopLeft as flyInTop', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromTopLeft' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInTop');
	});

	it('should resolve flyIn fromBottomRight as flyInBottom', () => {
		const result = buildPreviewAnimation('flyIn', { direction: 'fromBottomRight' });
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flyInBottom');
	});

	it('should use cubicBezier option when provided', () => {
		const result = buildPreviewAnimation('fadeIn', {
			cubicBezier: '0.42,0,0.58,1',
		});
		expect(result).toBeDefined();
		expect(result!.cssAnimation).toContain('cubic-bezier(0.42, 0, 0.58, 1)');
	});

	it('should return descriptor for "colorWave" preset', () => {
		const result = buildPreviewAnimation('colorWave');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-colorWave');
	});

	it('should return descriptor for "bounce" preset', () => {
		const result = buildPreviewAnimation('bounce');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-bounce');
	});

	it('should return descriptor for "flash" preset', () => {
		const result = buildPreviewAnimation('flash');
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-flash');
	});
});

describe('parseOoxmlBezierCurve', () => {
	it('should return undefined when all values are undefined', () => {
		expect(parseOoxmlBezierCurve(undefined, undefined, undefined, undefined)).toBeUndefined();
	});

	it('should return undefined when any value is undefined', () => {
		expect(parseOoxmlBezierCurve(50000, undefined, 50000, 50000)).toBeUndefined();
		expect(parseOoxmlBezierCurve(50000, 50000, undefined, 50000)).toBeUndefined();
		expect(parseOoxmlBezierCurve(50000, 50000, 50000, undefined)).toBeUndefined();
		expect(parseOoxmlBezierCurve(undefined, 50000, 50000, 50000)).toBeUndefined();
	});

	it('should convert 100000-range values to 0-1 range', () => {
		const result = parseOoxmlBezierCurve(50000, 50000, 50000, 50000);
		expect(result).toBe('0.5000,0.5000,0.5000,0.5000');
	});

	it('should handle zero values', () => {
		const result = parseOoxmlBezierCurve(0, 0, 100000, 100000);
		expect(result).toBe('0.0000,0.0000,1.0000,1.0000');
	});

	it('should clamp x values to 0-1 range but allow y to exceed', () => {
		// x1 beyond 100000 should clamp to 1, y1 beyond 100000 can exceed 1
		const result = parseOoxmlBezierCurve(150000, 150000, -50000, -50000);
		expect(result).toBeDefined();
		// x1 clamped to 1, y1 = 1.5 (not clamped)
		expect(result).toContain('1.0000');
		expect(result).toContain('1.5000');
		// x2 clamped to 0 (negative -> 0)
		expect(result).toContain('0.0000');
		// y2 = -0.5 (not clamped)
		expect(result).toContain('-0.5000');
	});

	it('should produce standard ease-in-out values', () => {
		// ease-in-out is roughly cubic-bezier(0.42, 0, 0.58, 1)
		const result = parseOoxmlBezierCurve(42000, 0, 58000, 100000);
		expect(result).toBe('0.4200,0.0000,0.5800,1.0000');
	});
});
