import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { bulletIndentPx, resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';

function seg(overrides: Partial<TextSegment> = {}): TextSegment {
	return { text: 'Hello', style: {}, ...overrides };
}

describe('resolveParagraphBullet', () => {
	it('returns undefined when no firstSegment / no bulletInfo', () => {
		expect(resolveParagraphBullet(undefined)).toBeUndefined();
		expect(resolveParagraphBullet(seg())).toBeUndefined();
	});

	it('returns undefined when bulletInfo.none is true (buNone)', () => {
		expect(resolveParagraphBullet(seg({ bulletInfo: { none: true } }))).toBeUndefined();
	});

	it('returns undefined when listType is "none"', () => {
		expect(
			resolveParagraphBullet(seg({ style: { listType: 'none' }, bulletInfo: { char: '•' } })),
		).toBeUndefined();
	});

	it('returns a "•" character bullet marker', () => {
		const result = resolveParagraphBullet(seg({ bulletInfo: { char: '•' } }));
		expect(result?.marker).toBe('•');
		expect(result?.isNumbered).toBeFalsy();
	});

	it('carries colour / font / size from bulletInfo', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: { char: '→', color: '#FF0000', fontFamily: 'Wingdings', sizePercent: 75 },
			}),
		);
		expect(result?.marker).toBe('→');
		expect(result?.color).toBe('#FF0000');
		expect(result?.fontFamily).toBe('Wingdings');
		expect(result?.sizePercent).toBe(75);
	});

	it('renders auto-numbered markers using startAt + paragraphIndex', () => {
		expect(
			resolveParagraphBullet(seg({ bulletInfo: { autoNumType: 'arabicPeriod' } }))?.marker,
		).toBe('1.');
		expect(
			resolveParagraphBullet(
				seg({ bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 2 } }),
			)?.marker,
		).toBe('3.');
		expect(
			resolveParagraphBullet(
				seg({ bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 3 } }),
			)?.marker,
		).toBe('IV.');
	});

	it('returns an accessible fallback for unresolved picture bullets', () => {
		expect(resolveParagraphBullet(seg({ bulletInfo: { imageRelId: 'rId1' } }), 20)).toMatchObject({
			marker: '•',
			picture: {
				sizePx: 20,
				fallbackMarker: '•',
				accessibleLabel: 'Bullet',
				imageRelId: 'rId1',
			},
		});
	});

	it('resolves picture data and canonical percentage sizing', () => {
		expect(
			resolveParagraphBullet(
				seg({
					bulletInfo: { imageDataUrl: 'data:image/png;base64,abc', sizePercent: 75 },
				}),
				24,
			),
		).toMatchObject({
			picture: { src: 'data:image/png;base64,abc', sizePx: 18 },
		});
	});

	it('falls back when only raw picture-bullet XML is retained', () => {
		expect(
			resolveParagraphBullet(seg({ bulletInfo: { imageBlipFillXml: { 'a:blip': {} } } }), 16)
				?.picture,
		).toMatchObject({ fallbackMarker: '•', accessibleLabel: 'Bullet' });
	});
});

describe('bulletIndentPx', () => {
	it('scales 18px per level, clamps undefined / negative to 0', () => {
		expect(bulletIndentPx(0)).toBe(0);
		expect(bulletIndentPx(1)).toBe(18);
		expect(bulletIndentPx(3)).toBe(54);
		expect(bulletIndentPx(undefined)).toBe(0);
		expect(bulletIndentPx(-2)).toBe(0);
	});
});

describe('resolveParagraphIndent', () => {
	it('uses explicit marginLeft / indent verbatim, omitting zeros', () => {
		expect(resolveParagraphIndent({ marginLeft: 40, indent: -20 }, 0)).toStrictEqual({
			marginLeftPx: 40,
			textIndentPx: -20,
		});
		expect(resolveParagraphIndent({ marginLeft: 0, indent: 0 }, 0)).toStrictEqual({});
	});

	it('falls back to per-level indent when no explicit indent present', () => {
		expect(resolveParagraphIndent(undefined, 2)).toStrictEqual({ marginLeftPx: 36 });
		expect(resolveParagraphIndent(undefined, 0)).toStrictEqual({});
	});
});
