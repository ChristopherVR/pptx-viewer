import { describe, it, expect } from 'vitest';
import {
	resolveListLevel,
	resolveListMarker,
	isCodeLikeFont,
	type SegmentBulletInfo,
} from './ListMarkerHelper';
import type { TextSegment } from '../core';

describe('resolveListMarker', () => {
	it('should return "-" as the default bullet character', () => {
		const bullet: SegmentBulletInfo = {};
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});

	it('should return the char directly for dash bullet', () => {
		const bullet: SegmentBulletInfo = { char: '-' };
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});

	it('should return the char for asterisk bullet', () => {
		const bullet: SegmentBulletInfo = { char: '*' };
		expect(resolveListMarker(bullet, 0)).toBe('*');
	});

	it('should return the char for plus bullet', () => {
		const bullet: SegmentBulletInfo = { char: '+' };
		expect(resolveListMarker(bullet, 0)).toBe('+');
	});

	it('should return the char for greater-than bullet', () => {
		const bullet: SegmentBulletInfo = { char: '>' };
		expect(resolveListMarker(bullet, 0)).toBe('>');
	});

	it('should return "-" for non-standard bullet characters (e.g. disc)', () => {
		const bullet: SegmentBulletInfo = { char: '\u2022' }; // bullet character
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});

	it('should format arabicPeriod as "1."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('1.');
	});

	it('should format arabicPeriod with startAt offset', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 5,
			paragraphIndex: 2,
		};
		// value = max(1, startAt + offset) = max(1, 5 + 2) = 7
		expect(resolveListMarker(bullet, 0)).toBe('7.');
	});

	it('should format alphaLcPeriod as "a."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'alphaLcPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('a.');
	});

	it('should format alphaUcPeriod as "A."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'alphaUcPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('A.');
	});

	it('should format romanUcPeriod as "I."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'romanUcPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('I.');
	});

	it('should format romanLcPeriod as "i."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'romanLcPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('i.');
	});

	it('should format arabicParenR as "1)"', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicParenR',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('1)');
	});

	it('should format arabicParenBoth as "(1)"', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicParenBoth',
			autoNumStartAt: 1,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('(1)');
	});

	it('should use paragraphIndex from bulletInfo when available', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
			paragraphIndex: 4,
		};
		// value = max(1, 1 + 4) = 5
		expect(resolveListMarker(bullet, 99)).toBe('5.');
	});

	it('should fall back to paragraphIndex argument when bulletInfo.paragraphIndex is undefined', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 1,
		};
		// offset = paragraphIndex argument = 3, value = max(1, 1 + 3) = 4
		expect(resolveListMarker(bullet, 3)).toBe('4.');
	});

	it('should format romanUcPeriod value 4 as "IV."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'romanUcPeriod',
			autoNumStartAt: 4,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('IV.');
	});

	it('should format alphaLcPeriod for 27th item as "aa."', () => {
		const bullet: SegmentBulletInfo = {
			autoNumType: 'alphaLcPeriod',
			autoNumStartAt: 27,
			paragraphIndex: 0,
		};
		expect(resolveListMarker(bullet, 0)).toBe('aa.');
	});

	it('should return "-" for picture bullets with imageRelId', () => {
		const bullet: SegmentBulletInfo = {
			imageRelId: 'rId5',
		};
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});

	it('should return "-" for picture bullets with imageDataUrl', () => {
		const bullet: SegmentBulletInfo = {
			imageDataUrl: 'data:image/png;base64,iVBOR',
		};
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});

	it('should return "-" for picture bullets with both imageRelId and imageDataUrl', () => {
		const bullet: SegmentBulletInfo = {
			imageRelId: 'rId5',
			imageDataUrl: 'data:image/png;base64,iVBOR',
		};
		expect(resolveListMarker(bullet, 0)).toBe('-');
	});
});

describe('resolveListLevel', () => {
	it('should return 0 when no level info is available', () => {
		const bullet: SegmentBulletInfo = {};
		expect(resolveListLevel(bullet, 0, undefined)).toBe(0);
	});

	it('should return explicit level from bulletInfo', () => {
		const bullet: SegmentBulletInfo = { level: 2 } as any;
		expect(resolveListLevel(bullet, 0, undefined)).toBe(2);
	});

	it('should floor explicit level', () => {
		const bullet: SegmentBulletInfo = { level: 1.7 } as any;
		expect(resolveListLevel(bullet, 0, undefined)).toBe(1);
	});

	it('should clamp explicit level to 0 minimum', () => {
		const bullet: SegmentBulletInfo = { level: -1 } as any;
		expect(resolveListLevel(bullet, 0, undefined)).toBe(0);
	});

	it('should compute level from paragraph indents', () => {
		const bullet: SegmentBulletInfo = {};
		const indents = [{ marginLeft: 48, indent: 0 }];
		// spacingPoints = max(0, 48 + max(0, 0)) = 48
		// level = round(48 / 24) = 2
		expect(resolveListLevel(bullet, 0, indents)).toBe(2);
	});

	it('should return 0 when marginLeft is 0', () => {
		const bullet: SegmentBulletInfo = {};
		const indents = [{ marginLeft: 0, indent: 0 }];
		expect(resolveListLevel(bullet, 0, indents)).toBe(0);
	});
});

describe('isCodeLikeFont', () => {
	const makeSegment = (fontFamily: string, hyperlink?: string): TextSegment => ({
		text: 'test',
		style: { fontFamily, hyperlink },
	});

	it('should detect Courier as monospace', () => {
		expect(isCodeLikeFont(makeSegment('Courier New'))).toBe(true);
	});

	it('should detect Consolas as monospace', () => {
		expect(isCodeLikeFont(makeSegment('Consolas'))).toBe(true);
	});

	it('should detect Fira Code as monospace', () => {
		expect(isCodeLikeFont(makeSegment('Fira Code'))).toBe(true);
	});

	it('should not detect Arial as monospace', () => {
		expect(isCodeLikeFont(makeSegment('Arial'))).toBe(false);
	});

	it('should return false for hyperlink segments even with mono font', () => {
		expect(isCodeLikeFont(makeSegment('Courier New', 'https://example.com'))).toBe(false);
	});

	it('should return false when fontFamily is undefined', () => {
		const segment: TextSegment = { text: 'x', style: {} };
		expect(isCodeLikeFont(segment)).toBe(false);
	});

	it('should be case-insensitive', () => {
		expect(isCodeLikeFont(makeSegment('CONSOLAS'))).toBe(true);
	});
});
