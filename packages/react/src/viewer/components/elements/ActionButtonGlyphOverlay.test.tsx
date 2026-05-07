import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	ActionButtonGlyphOverlay,
	getActionButtonGlyphPath,
	isActionButtonShape,
} from './ActionButtonGlyphOverlay';

const mkShape = (shapeType: string): PptxElement =>
	({
		id: 'b1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 50,
		height: 50,
		shapeType,
	}) as PptxElement;

describe('isActionButtonShape', () => {
	it('returns true for canonical action-button shape names', () => {
		expect(isActionButtonShape('actionButtonHome')).toBeTruthy();
		expect(isActionButtonShape('actionButtonHelp')).toBeTruthy();
		expect(isActionButtonShape('actionButtonBackPrevious')).toBeTruthy();
		expect(isActionButtonShape('actionButtonForwardNext')).toBeTruthy();
		expect(isActionButtonShape('actionButtonBeginning')).toBeTruthy();
		expect(isActionButtonShape('actionButtonEnd')).toBeTruthy();
		expect(isActionButtonShape('actionButtonReturn')).toBeTruthy();
		expect(isActionButtonShape('actionButtonInformation')).toBeTruthy();
		expect(isActionButtonShape('actionButtonDocument')).toBeTruthy();
		expect(isActionButtonShape('actionButtonSound')).toBeTruthy();
		expect(isActionButtonShape('actionButtonMovie')).toBeTruthy();
		expect(isActionButtonShape('actionButtonBlank')).toBeTruthy();
	});

	it('treats `Or` aliases as action buttons', () => {
		expect(isActionButtonShape('actionButtonForwardOrNext')).toBeTruthy();
		expect(isActionButtonShape('actionButtonBackOrPrevious')).toBeTruthy();
	});

	it('returns false for non-action shapes', () => {
		expect(isActionButtonShape('roundRect')).toBeFalsy();
		expect(isActionButtonShape('rect')).toBeFalsy();
		expect(isActionButtonShape(undefined)).toBeFalsy();
		expect(isActionButtonShape('')).toBeFalsy();
	});
});

describe('getActionButtonGlyphPath', () => {
	it('returns a non-empty path for shapes with glyphs', () => {
		expect(getActionButtonGlyphPath('actionButtonHome')).toContain('M');
		expect(getActionButtonGlyphPath('actionButtonHelp')).toContain('a');
	});

	it('returns undefined for actionButtonBlank (no glyph)', () => {
		expect(getActionButtonGlyphPath('actionButtonBlank')).toBeUndefined();
	});

	it('returns undefined for non-action shapes', () => {
		expect(getActionButtonGlyphPath('roundRect')).toBeUndefined();
		expect(getActionButtonGlyphPath(undefined)).toBeUndefined();
	});

	it('aliases ForwardOrNext / BackOrPrevious to the canonical glyph', () => {
		expect(getActionButtonGlyphPath('actionButtonForwardOrNext')).toBe(
			getActionButtonGlyphPath('actionButtonForwardNext'),
		);
		expect(getActionButtonGlyphPath('actionButtonBackOrPrevious')).toBe(
			getActionButtonGlyphPath('actionButtonBackPrevious'),
		);
	});
});

describe('actionButtonGlyphOverlay', () => {
	it('renders an SVG with the matched glyph path', () => {
		const html = renderToStaticMarkup(
			<ActionButtonGlyphOverlay element={mkShape('actionButtonHome')} />,
		);
		expect(html).toContain('<svg');
		expect(html).toContain('viewBox="0 0 24 24"');
		expect(html).toMatch(/<path d="M12 4 L20 11 L20 20/);
	});

	it('renders nothing for actionButtonBlank', () => {
		expect(
			renderToStaticMarkup(<ActionButtonGlyphOverlay element={mkShape('actionButtonBlank')} />),
		).toBe('');
	});

	it('renders nothing for non-action shapes', () => {
		expect(renderToStaticMarkup(<ActionButtonGlyphOverlay element={mkShape('roundRect')} />)).toBe(
			'',
		);
	});

	it('respects an explicit color prop', () => {
		const html = renderToStaticMarkup(
			<ActionButtonGlyphOverlay element={mkShape('actionButtonHome')} color='#ff0000' />,
		);
		expect(html).toContain('stroke="#ff0000"');
	});

	it('defaults to white stroke when no color is supplied or text colour set', () => {
		const html = renderToStaticMarkup(
			<ActionButtonGlyphOverlay element={mkShape('actionButtonHome')} />,
		);
		expect(html).toContain('stroke="#ffffff"');
	});

	it('uses the element text colour when present', () => {
		const el = {
			...mkShape('actionButtonHome'),
			textStyle: { color: '#003366' },
		} as unknown as PptxElement;
		const html = renderToStaticMarkup(<ActionButtonGlyphOverlay element={el} />);
		expect(html).toContain('stroke="#003366"');
	});
});
