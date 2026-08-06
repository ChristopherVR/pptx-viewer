/**
 * StyleTextPropAtom parsing tests. The byte sequences are taken verbatim
 * from real PowerPoint-written .ppt files (see the fixture decks).
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_SCHEME } from '../color-scheme';
import { parseStyleTextPropAtom } from './style-props';

function parse(hex: string, textLength: number) {
	const bytes = new Uint8Array(hex.split(/\s+/).map((h) => parseInt(h, 16)));
	const view = new DataView(bytes.buffer);
	return parseStyleTextPropAtom(view, 0, bytes.length, textLength, DEFAULT_SCHEME);
}

describe('parseStyleTextPropAtom', () => {
	it('parses multi-run character formatting ("Project\\rAtlas", bold 40pt white)', () => {
		// From sample-deck.ppt slide 1 title: text length 13 (+1 terminator).
		const runs = parse(
			'0e 00 00 00 00 00 00 00 00 00 ' +
				'07 00 00 00 01 00 06 00 01 00 28 00 ff ff ff fe ' +
				'01 00 00 00 00 00 00 00 ' +
				'05 00 00 00 01 00 06 00 01 00 28 00 ff ff ff fe ' +
				'01 00 00 00 00 00 00 00',
			13,
		);
		expect(runs.paragraphRuns).toHaveLength(1);
		expect(runs.paragraphRuns[0].count).toBe(14);
		expect(runs.charRuns).toHaveLength(4);
		expect(runs.charRuns[0]).toMatchObject({
			count: 7,
			bold: true,
			sizePt: 40,
			colorRgb: 'FFFFFF',
		});
		expect(runs.charRuns[1]).toMatchObject({ count: 1 });
		expect(runs.charRuns[2]).toMatchObject({
			count: 5,
			bold: true,
			sizePt: 40,
			colorRgb: 'FFFFFF',
		});
	});

	it('parses paragraph wrap flags plus a color-only char run ("Sample Title")', () => {
		// From embedded-assets-sample.ppt title placeholder: length 12 (+1).
		// PF run first, then the CF run.
		const runs = parse(
			'0d 00 00 00 00 00 00 00 0a 00 07 00 0d 00 00 00 00 00 04 00 00 00 00 fe',
			12,
		);
		expect(runs.paragraphRuns).toHaveLength(1);
		expect(runs.paragraphRuns[0].count).toBe(13);
		expect(runs.charRuns).toHaveLength(1);
		expect(runs.charRuns[0]).toMatchObject({ count: 13, colorRgb: '000000' });
	});

	it('resolves scheme color indexes through the scheme table', () => {
		// One char run, color index 2 (shadows slot).
		// PF run first, then the CF run.
		const runs = parse('06 00 00 00 00 00 00 00 00 00 06 00 00 00 00 00 04 00 00 00 00 02', 5);
		expect(runs.charRuns[0].colorRgb).toBe(DEFAULT_SCHEME[2]);
	});

	it('survives truncated atoms without throwing', () => {
		const runs = parse('0e 00 00 00 00 00', 13);
		expect(runs.paragraphRuns).toHaveLength(0);
		expect(runs.charRuns).toHaveLength(0);
	});
});
