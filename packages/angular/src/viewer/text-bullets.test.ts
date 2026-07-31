import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveAngularParagraphBullet } from './text-bullets';

describe('angular picture bullet projection', () => {
	it('projects a resolved image and DrawingML percentage size', () => {
		const segment: TextSegment = {
			text: '',
			style: { fontSize: 16 },
			bulletInfo: {
				imageDataUrl: 'data:image/png;base64,iVBOR',
				imageRelId: 'rId5',
				sizePercent: 150,
			},
		};
		const bullet = resolveAngularParagraphBullet(segment, 16);
		expect(bullet?.marker).toBeUndefined();
		expect(bullet?.picture).toMatchObject({
			src: 'data:image/png;base64,iVBOR',
			sizePx: 24,
			accessibleLabel: 'Bullet',
		});
	});

	// The marker's advance is what the first line's text starts after, so its
	// font declaration has to agree with the other four bindings run for run.
	it("paints a bullet with no buFont in the paragraph's own typeface", () => {
		const segment: TextSegment = {
			text: '• ',
			style: { fontFamily: 'Arial', fontSize: 18 },
			bulletInfo: { char: '•' },
		};
		expect(resolveAngularParagraphBullet(segment, 18)?.style['font-family']).toBe(
			'"Arial", "Liberation Sans", "Helvetica", sans-serif',
		);
	});

	it("takes the marker's weight from its own segment, not the bold body", () => {
		const segment: TextSegment = {
			text: '§ ',
			style: { fontSize: 14 },
			bulletInfo: { char: '§' },
		};
		const style = resolveAngularParagraphBullet(segment, 14)?.style;
		expect(style?.['font-weight']).toBe(400);
		expect(style?.['font-style']).toBe('normal');
	});

	it('shrinks the marker with the body autofit font scale', () => {
		const segment: TextSegment = {
			text: '• ',
			style: { fontSize: 20 },
			bulletInfo: { char: '•' },
		};
		expect(resolveAngularParagraphBullet(segment, 20, 0.5)?.style['font-size']).toBe('10px');
		// An explicit `a:buSzPts` is absolute and is left where the deck put it.
		const sized: TextSegment = {
			text: '• ',
			style: { fontSize: 20 },
			bulletInfo: { char: '•', sizePts: 12 },
		};
		expect(resolveAngularParagraphBullet(sized, 20, 0.5)?.style['font-size']).toBe('12px');
	});

	it('retains an accessible glyph fallback for unresolved raw picture XML', () => {
		const segment: TextSegment = {
			text: '',
			style: {},
			bulletInfo: { imageBlipFillXml: '<a:blipFill />' },
		};
		const bullet = resolveAngularParagraphBullet(segment, 16);
		expect(bullet?.marker).toBe('•');
		expect(bullet?.picture?.src).toBeUndefined();
		expect(bullet?.picture).toMatchObject({
			sizePx: 16,
			accessibleLabel: 'Bullet',
		});
	});
});
