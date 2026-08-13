/**
 * Bullet-marker projection, asserted through the paragraph view model the
 * template actually renders.
 *
 * These cases used to exercise `resolveAngularParagraphBullet`, this binding's
 * own projection of a resolved bullet. That went with the hand-ported paragraph
 * builder; the same behaviours now come from shared `buildParagraphs`, so the
 * tests were re-pointed at `buildAngularParagraphs` rather than deleted: they
 * are the proof that retiring the copy kept every marker rule intact.
 */
import type { PptxElement, PptxElementWithText, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildAngularParagraphs } from './paragraph-view';

/** A text element carrying one bulleted paragraph made of `segments`. */
function textElement(segments: TextSegment[], fontSize?: number): PptxElement {
	return {
		type: 'text',
		id: 'bullet',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		...(fontSize ? { textStyle: { fontSize } } : {}),
		textSegments: segments,
	} as PptxElementWithText as PptxElement;
}

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
		const [para] = buildAngularParagraphs(
			textElement([segment, { text: 'Item', style: { fontSize: 16 } }]),
		);
		expect(para.bulletMarker).toBeUndefined();
		expect(para.bulletPicture).toMatchObject({
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
		const [para] = buildAngularParagraphs(
			textElement([segment, { text: 'Item', style: { fontFamily: 'Arial', fontSize: 18 } }]),
		);
		expect(para.bulletStyle['fontFamily']).toBe(
			'"Arial", "Liberation Sans", "Helvetica", sans-serif',
		);
	});

	it("takes the marker's weight from its own segment, not the bold body", () => {
		const segment: TextSegment = {
			text: '§ ',
			style: { fontSize: 14 },
			bulletInfo: { char: '§' },
		};
		const [para] = buildAngularParagraphs(
			textElement([segment, { text: 'Item', style: { fontSize: 14 } }]),
		);
		expect(para.bulletStyle['fontWeight']).toBe(400);
		expect(para.bulletStyle['fontStyle']).toBe('normal');
	});

	it('shrinks the marker with the body autofit font scale', () => {
		const segment: TextSegment = {
			text: '• ',
			style: { fontSize: 20 },
			bulletInfo: { char: '•' },
		};
		const scaled = {
			type: 'text',
			id: 'scaled',
			x: 0,
			y: 0,
			width: 400,
			height: 200,
			textStyle: { fontSize: 20, autoFitFontScale: 0.5 },
			textSegments: [segment, { text: 'Item', style: { fontSize: 20 } }],
		} as PptxElementWithText as PptxElement;
		expect(buildAngularParagraphs(scaled)[0].bulletStyle['fontSize']).toBe('10px');

		// An explicit `a:buSzPts` is absolute and is left where the deck put it.
		const sized: TextSegment = {
			text: '• ',
			style: { fontSize: 20 },
			bulletInfo: { char: '•', sizePts: 12 },
		};
		const sizedElement = {
			...(scaled as unknown as PptxElementWithText),
			textSegments: [sized, { text: 'Item', style: { fontSize: 20 } }],
		} as PptxElementWithText as PptxElement;
		expect(buildAngularParagraphs(sizedElement)[0].bulletStyle['fontSize']).toBe('12px');
	});

	it('retains an accessible glyph fallback for unresolved raw picture XML', () => {
		const segment: TextSegment = {
			text: '',
			style: {},
			bulletInfo: { imageBlipFillXml: '<a:blipFill />' },
		};
		const [para] = buildAngularParagraphs(textElement([segment, { text: 'Item', style: {} }]));
		expect(para.bulletMarker).toBe('•');
		expect(para.bulletPicture?.src).toBeUndefined();
		expect(para.bulletPicture).toMatchObject({
			sizePx: 16,
			accessibleLabel: 'Bullet',
		});
	});
});
