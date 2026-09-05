import type { PptxData, ImagePptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { updateElementStyle, runAccessibilityCheck } from '../../tools/style-tools.js';
import type { ToolContext } from '../../types.js';
import { makeStylePresentation } from '../helpers/create-test-pptx.js';

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeStylePresentation() };
}

// ── updateElementStyle ──────────────────────────────────────────────────────

describe('updateElementStyle', () => {
	it('updates fill color on a shape', () => {
		const c = ctx();
		const result = updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			fillColor: '#00ff00',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.elementId).toBe('shape-0');
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		expect((el as { shapeStyle?: ShapeStyle }).shapeStyle?.fillColor).toBe('#00ff00');
	});

	it('updates stroke properties', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			strokeColor: '#0000ff',
			strokeWidth: 3,
			strokeDash: 'dash',
			strokeOpacity: 0.8,
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		const ss = (el as { shapeStyle?: ShapeStyle }).shapeStyle!;
		expect(ss.strokeColor).toBe('#0000ff');
		expect(ss.strokeWidth).toBe(3);
		expect(ss.strokeDash).toBe('dash');
		expect(ss.strokeOpacity).toBe(0.8);
	});

	it('sets fillColorRef/strokeColorRef and resolves the hex from themeColorMap', () => {
		const data = makeStylePresentation();
		data.themeColorMap = { accent1: '#4472C4', accent2: '#ED7D31' };
		const c = ctx(data);
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			// lumMod 0.2 / lumOff 0.8 is PowerPoint's "Lighter 80%" row.
			fillThemeColor: { scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 },
			strokeThemeColor: { scheme: 'accent2' },
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		const ss = (el as { shapeStyle?: ShapeStyle }).shapeStyle!;
		expect(ss.fillColorRef).toStrictEqual({ scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 });
		expect(ss.strokeColorRef).toStrictEqual({ scheme: 'accent2' });
		// Resolved immediately against the theme map (no explicit fillColor given).
		expect(ss.fillColor?.toLowerCase()).toBe('#dae3f3');
		expect(ss.strokeColor?.toLowerCase()).toBe('#ed7d31');
	});

	it('a plain fillColor with no theme colour clears a previously-set ref', () => {
		const c = ctx();
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0') as {
			shapeStyle?: ShapeStyle;
		};
		el.shapeStyle!.fillColorRef = { scheme: 'accent1' };
		updateElementStyle(c, { slideIndex: 0, elementId: 'shape-0', fillColor: '#123456' });
		expect(el.shapeStyle!.fillColor).toBe('#123456');
		expect(el.shapeStyle!.fillColorRef).toBeUndefined();
	});

	it('updates shadow properties', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			shadowColor: '#333333',
			shadowBlur: 10,
			shadowOffsetX: 5,
			shadowOffsetY: 5,
			shadowOpacity: 0.5,
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		const ss = (el as { shapeStyle?: ShapeStyle }).shapeStyle!;
		expect(ss.shadowColor).toBe('#333333');
		expect(ss.shadowBlur).toBe(10);
		expect(ss.shadowOffsetX).toBe(5);
		expect(ss.shadowOffsetY).toBe(5);
		expect(ss.shadowOpacity).toBe(0.5);
	});

	it('updates glow and soft edge', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			glowColor: '#ff00ff',
			glowRadius: 8,
			glowOpacity: 0.7,
			softEdgeRadius: 4,
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		const ss = (el as { shapeStyle?: ShapeStyle }).shapeStyle!;
		expect(ss.glowColor).toBe('#ff00ff');
		expect(ss.glowRadius).toBe(8);
		expect(ss.glowOpacity).toBe(0.7);
		expect(ss.softEdgeRadius).toBe(4);
	});

	it('updates gradient fill', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'shape-0',
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 45,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 1, opacity: 0.5 },
			],
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'shape-0');
		const ss = (el as { shapeStyle?: ShapeStyle }).shapeStyle!;
		expect(ss.fillMode).toBe('gradient');
		expect(ss.fillGradientType).toBe('linear');
		expect(ss.fillGradientAngle).toBe(45);
		expect(ss.fillGradientStops).toHaveLength(2);
	});

	it('updates image alt text', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'img-0',
			altText: 'A descriptive alt text',
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'img-0') as ImagePptxElement;
		expect(el.altText).toBe('A descriptive alt text');
	});

	it('updates image crop', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'img-0',
			cropLeft: 10,
			cropTop: 20,
			cropRight: 10,
			cropBottom: 20,
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'img-0') as ImagePptxElement;
		expect(el.cropLeft).toBe(10);
		expect(el.cropTop).toBe(20);
		expect(el.cropRight).toBe(10);
		expect(el.cropBottom).toBe(20);
	});

	it('updates image effects (brightness, contrast, grayscale)', () => {
		const c = ctx();
		updateElementStyle(c, {
			slideIndex: 0,
			elementId: 'img-0',
			brightness: 20,
			contrast: -10,
			grayscale: true,
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'img-0') as ImagePptxElement;
		expect(el.imageEffects?.brightness).toBe(20);
		expect(el.imageEffects?.contrast).toBe(-10);
		expect(el.imageEffects?.grayscale).toBeTruthy();
	});

	it('throws on nonexistent element', () => {
		expect(() =>
			updateElementStyle(ctx(), {
				slideIndex: 0,
				elementId: 'nonexistent',
				fillColor: '#000',
			}),
		).toThrow('not found');
	});

	it('throws on invalid slide index', () => {
		expect(() =>
			updateElementStyle(ctx(), {
				slideIndex: 99,
				elementId: 'shape-0',
				fillColor: '#000',
			}),
		).toThrow('out of range');
	});
});

// ── runAccessibilityCheck ───────────────────────────────────────────────────

describe('runAccessibilityCheck', () => {
	it('returns non-dirty result', () => {
		const result = runAccessibilityCheck(ctx());
		expect(result.dirty).toBeFalsy();
	});

	it('reports slide count', () => {
		const result = runAccessibilityCheck(ctx());
		expect(result.result.slideCount).toBe(2);
	});

	it('detects image without alt text', () => {
		const result = runAccessibilityCheck(ctx());
		const imgIssues = result.result.issues.filter(
			(i) => i.elementId === 'img-0' && i.severity === 'error',
		);
		expect(imgIssues.length).toBeGreaterThan(0);
		expect(imgIssues[0].message).toContain('alt text');
	});

	it('detects empty text element', () => {
		const result = runAccessibilityCheck(ctx());
		const emptyTextIssues = result.result.issues.filter(
			(i) => i.elementId === 'txt-1' && i.severity === 'info',
		);
		expect(emptyTextIssues.length).toBeGreaterThan(0);
		expect(emptyTextIssues[0].message).toContain('empty');
	});

	it('detects small font size', () => {
		const result = runAccessibilityCheck(ctx());
		const smallFontIssues = result.result.issues.filter(
			(i) => i.elementId === 'txt-1' && i.severity === 'warning',
		);
		expect(smallFontIssues.length).toBeGreaterThan(0);
		expect(smallFontIssues[0].message).toContain('small font');
	});

	it('detects text color matching background', () => {
		const c = ctx();
		// Set text color same as background
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'txt-0');
		(el as { textStyle: { color: string } }).textStyle.color = '#ffffff';
		const result = runAccessibilityCheck(c);
		const contrastIssues = result.result.issues.filter(
			(i) => i.elementId === 'txt-0' && i.severity === 'error' && i.message.includes('same color'),
		);
		expect(contrastIssues).toHaveLength(1);
	});

	it('no image alt text error when alt text is set', () => {
		const c = ctx();
		const img = c.pptxData.slides[0].elements.find((e) => e.id === 'img-0') as ImagePptxElement;
		img.altText = 'A photo';
		const result = runAccessibilityCheck(c);
		const imgIssues = result.result.issues.filter(
			(i) => i.elementId === 'img-0' && i.message.includes('alt text'),
		);
		expect(imgIssues).toHaveLength(0);
	});

	it('counts severities correctly', () => {
		const result = runAccessibilityCheck(ctx());
		const { errorCount, warningCount, infoCount, totalIssues, issues } = result.result;
		expect(totalIssues).toBe(issues.length);
		expect(errorCount).toBe(issues.filter((i) => i.severity === 'error').length);
		expect(warningCount).toBe(issues.filter((i) => i.severity === 'warning').length);
		expect(infoCount).toBe(issues.filter((i) => i.severity === 'info').length);
		expect(errorCount + warningCount + infoCount).toBe(totalIssues);
	});
});
