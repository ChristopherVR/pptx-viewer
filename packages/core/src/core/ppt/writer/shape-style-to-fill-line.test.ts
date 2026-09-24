/**
 * @module ppt/writer/shape-style-to-fill-line.test
 */
import { describe, expect, it } from 'vitest';

import type { ShapeStyle } from '../../types/shape-style';
import { resolveFill, resolveLine } from './shape-style-to-fill-line';

describe('resolveFill', () => {
	it('returns none for an unset style', () => {
		expect(resolveFill(undefined)).toStrictEqual({ kind: 'none' });
	});

	it('returns none for an explicit noFill', () => {
		expect(resolveFill({ fillMode: 'none' })).toStrictEqual({ kind: 'none' });
	});

	it('returns solid for a resolved fillColor', () => {
		expect(resolveFill({ fillMode: 'solid', fillColor: '#4472C4' })).toStrictEqual({
			kind: 'solid',
			rgb: '4472C4',
		});
	});

	it('returns gradient stops for a gradient fill', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientAngle: 45,
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 1 },
			],
		};
		expect(resolveFill(style)).toStrictEqual({
			kind: 'gradient',
			angleDeg: 45,
			stops: [
				{ rgb: 'FF0000', position: 0 },
				{ rgb: '0000FF', position: 1 },
			],
		});
	});

	it('degrades a pattern fill with a plain srgbClr foreground to that solid', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternPreset: 'pct50',
			fillPatternFgClrXml: { 'a:srgbClr': { '@_val': 'AABBCC' } },
		};
		expect(resolveFill(style)).toStrictEqual({ kind: 'solid', rgb: 'AABBCC' });
	});

	it('falls back to the resolved pattern background colour when no fillColor/fgClr is set', () => {
		// This is the SDK-authored case: ElementFactory only ever sets
		// fillPatternBackgroundColor, never fillColor or fillPatternFgClrXml.
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternPreset: 'dkUpDiag',
			fillPatternBackgroundColor: '#123456',
		};
		expect(resolveFill(style)).toStrictEqual({ kind: 'solid', rgb: '123456' });
	});

	it('falls back to a plain srgbClr background when nothing else resolves', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternBgClrXml: { 'a:srgbClr': { '@_val': '00FF00' } },
		};
		expect(resolveFill(style)).toStrictEqual({ kind: 'solid', rgb: '00FF00' });
	});

	it('degrades a pattern fill with only a theme colour reference to none', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternFgClrXml: { 'a:schemeClr': { '@_val': 'accent1' } },
		};
		expect(resolveFill(style)).toStrictEqual({ kind: 'none' });
	});

	it('degrades an image fill with no resolved colour to none', () => {
		expect(
			resolveFill({ fillMode: 'image', fillImageUrl: 'data:image/png;base64,AAA' }),
		).toStrictEqual({
			kind: 'none',
		});
	});
});

describe('resolveLine', () => {
	it('returns none for an unset style', () => {
		expect(resolveLine(undefined)).toStrictEqual({ kind: 'none' });
	});

	it('returns none for a zero-width stroke', () => {
		expect(resolveLine({ strokeColor: '#000000', strokeWidth: 0 })).toStrictEqual({ kind: 'none' });
	});

	it('returns a line for a coloured stroke', () => {
		expect(
			resolveLine({ strokeColor: '#2E528F', strokeWidth: 2, strokeDash: 'dash' }),
		).toStrictEqual({
			kind: 'line',
			rgb: '2E528F',
			widthEmu: 19050,
			dash: 'dash',
		});
	});
});
