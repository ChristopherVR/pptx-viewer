/**
 * Tests for `gradFill` `@flip`, `@rotWithShape`, `@scaled` round-trip
 * (Phase 5 Stream B item 4).
 */
import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { PptxGradientStyleCodec } from './PptxGradientStyleCodec';

const codec = new PptxGradientStyleCodec({
	ensureArray: (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]),
	parseColor: (n) =>
		(n as XmlObject | undefined)?.['a:srgbClr'] !== undefined
			? `#${((n as XmlObject)['a:srgbClr'] as XmlObject)['@_val'] as string}`
			: undefined,
	extractColorOpacity: () => undefined,
	clampUnitInterval: (v) => Math.max(0, Math.min(1, v)),
	hexToRgb: () => undefined,
	rgbToHex: () => '#000000',
});

describe('pptxGradientStyleCodec — flip / rotWithShape / scaled', () => {
	it('extracts gradFill@flip', () => {
		expect(codec.extractGradientFlip({ '@_flip': 'xy' } as XmlObject)).toBe('xy');
		expect(codec.extractGradientFlip({ '@_flip': 'x' } as XmlObject)).toBe('x');
		expect(codec.extractGradientFlip({} as XmlObject)).toBeUndefined();
	});

	it('extracts gradFill@rotWithShape as a typed boolean', () => {
		expect(codec.extractGradientRotWithShape({ '@_rotWithShape': '1' } as XmlObject)).toBeTruthy();
		expect(codec.extractGradientRotWithShape({ '@_rotWithShape': '0' } as XmlObject)).toBeFalsy();
		expect(codec.extractGradientRotWithShape({} as XmlObject)).toBeUndefined();
	});

	it('extracts a:lin@scaled as a typed boolean', () => {
		expect(codec.extractGradientScaled({ 'a:lin': { '@_scaled': '1' } } as XmlObject)).toBeTruthy();
		expect(codec.extractGradientScaled({ 'a:lin': { '@_scaled': '0' } } as XmlObject)).toBeFalsy();
		expect(codec.extractGradientScaled({} as XmlObject)).toBeUndefined();
	});

	it('round-trips flip / rotWithShape / scaled through buildGradientFillXml', () => {
		const style: ShapeStyle = {
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100 },
			],
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientFlip: 'xy',
			fillGradientRotWithShape: false,
			fillGradientScaled: false,
		};
		const xml = codec.buildGradientFillXml(style)!;
		expect(xml['@_flip']).toBe('xy');
		expect(xml['@_rotWithShape']).toBe('0');
		expect((xml['a:lin'] as XmlObject)['@_scaled']).toBe('0');
	});

	it('omits @flip when value is "none" (default)', () => {
		const style: ShapeStyle = {
			fillGradientStops: [{ color: '#FF0000', position: 0 }],
			fillGradientType: 'linear',
			fillGradientFlip: 'none',
		};
		const xml = codec.buildGradientFillXml(style)!;
		expect(xml['@_flip']).toBeUndefined();
	});

	it('defaults @scaled to "1" when not specified (back-compat)', () => {
		const style: ShapeStyle = {
			fillGradientStops: [{ color: '#FF0000', position: 0 }],
			fillGradientType: 'linear',
		};
		const xml = codec.buildGradientFillXml(style)!;
		expect((xml['a:lin'] as XmlObject)['@_scaled']).toBe('1');
	});

	it('extracts a:tileRect LTRB into 0..1 fractions (may be negative)', () => {
		const tileRect = codec.extractGradientTileRect({
			'a:tileRect': { '@_l': '10000', '@_t': '-20000', '@_r': '30000', '@_b': '40000' },
		} as XmlObject);
		expect(tileRect).toStrictEqual({ l: 0.1, t: -0.2, r: 0.3, b: 0.4 });
	});

	it('returns undefined tileRect when the child is absent', () => {
		expect(codec.extractGradientTileRect({} as XmlObject)).toBeUndefined();
	});

	it('round-trips fillGradientTileRect through buildGradientFillXml', () => {
		const style: ShapeStyle = {
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100 },
			],
			fillGradientType: 'linear',
			fillGradientTileRect: { l: 0.1, t: 0.2, r: 0.3, b: 0.4 },
		};
		const xml = codec.buildGradientFillXml(style)!;
		expect(xml['a:tileRect']).toStrictEqual({
			'@_l': '10000',
			'@_t': '20000',
			'@_r': '30000',
			'@_b': '40000',
		});
	});
});
