import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import type React from 'react';
import { describe, it, expect } from 'vitest';

import { renderSingleSegment } from './text-segment-render';

function makeElement(): PptxElement & Partial<{ textStyle: TextStyle }> {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		textStyle: { fontSize: 20 },
	} as unknown as PptxElement & Partial<{ textStyle: TextStyle }>;
}

/** Render a single plain-text segment and return its resolved span style. */
function styleOf(style: TextStyle): React.CSSProperties {
	const node = renderSingleSegment(
		makeElement(),
		{ text: 'Hello', style },
		0,
		'#000000',
		undefined,
		undefined,
	) as React.ReactElement<{ style: React.CSSProperties }>;
	return node.props.style;
}

describe('renderSingleSegment - text capitalization (a:rPr/@cap)', () => {
	it('maps cap="all" to text-transform: uppercase', () => {
		const style = styleOf({ textCaps: 'all' });
		expect(style.textTransform).toBe('uppercase');
		expect(style.fontVariantCaps).toBeUndefined();
	});

	it('maps cap="small" to font-variant-caps: small-caps', () => {
		const style = styleOf({ textCaps: 'small' });
		expect(style.fontVariantCaps).toBe('small-caps');
		expect(style.textTransform).toBeUndefined();
	});

	it('leaves capitalization unset for cap="none"', () => {
		const style = styleOf({ textCaps: 'none' });
		expect(style.textTransform).toBeUndefined();
		expect(style.fontVariantCaps).toBeUndefined();
	});
});

describe('renderSingleSegment - baseline shift (a:rPr/@baseline)', () => {
	it('honours the authored percentage magnitude (thousandths-of-percent)', () => {
		// 30000 = 30% of a 20px font -> 6px raise.
		const style = styleOf({ baseline: 30000, fontSize: 20 });
		expect(style.verticalAlign).toBe('6px');
	});

	it('lowers the baseline for a negative (subscript) shift', () => {
		// -25000 = -25% of 20px -> -5px.
		const style = styleOf({ baseline: -25000, fontSize: 20 });
		expect(style.verticalAlign).toBe('-5px');
	});

	it('supports a bare-percent authored value', () => {
		// 30 (bare percent) of 20px -> 6px.
		const style = styleOf({ baseline: 30, fontSize: 20 });
		expect(style.verticalAlign).toBe('6px');
	});

	it('scales the font down for shifted text', () => {
		const style = styleOf({ baseline: 30000, fontSize: 20 });
		expect(style.fontSize).toBe(13); // 20 * 0.65
	});

	it('leaves the baseline unset when no shift is authored', () => {
		const style = styleOf({ fontSize: 20 });
		expect(style.verticalAlign).toBeUndefined();
		expect(style.fontSize).toBe(20);
	});
});

describe('renderSingleSegment - kerning threshold (a:rPr/@kern)', () => {
	it('disables kerning when kern=0', () => {
		const style = styleOf({ kerning: 0, fontSize: 20 });
		expect(style.fontKerning).toBe('none');
	});

	it('enables kerning when the font meets the threshold', () => {
		// kern=1200 -> 12pt threshold; 20px = 15pt >= 12pt.
		const style = styleOf({ kerning: 1200, fontSize: 20 });
		expect(style.fontKerning).toBe('normal');
	});

	it('disables kerning below the threshold', () => {
		// kern=2400 -> 24pt threshold; 20px = 15pt < 24pt.
		const style = styleOf({ kerning: 2400, fontSize: 20 });
		expect(style.fontKerning).toBe('none');
	});

	it('leaves kerning unset when not authored', () => {
		const style = styleOf({ fontSize: 20 });
		expect(style.fontKerning).toBeUndefined();
	});
});
