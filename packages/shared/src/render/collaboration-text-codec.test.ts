import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { YTextLike } from './collaboration-text-codec';
import {
	decodeDelta,
	decodeTextBody,
	encodeSegmentsToDelta,
	encodeTextBody,
} from './collaboration-text-codec';

function liveText(): YTextLike {
	const doc = new Y.Doc();
	return doc.getText('t') as unknown as YTextLike;
}

describe('encodeTextBody / decodeTextBody', () => {
	it('round-trips plain and styled segments', () => {
		const segments = [
			{ text: 'Hello ', style: { bold: true } },
			{ text: 'world', style: {} },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const decoded = decodeTextBody(ytext);
		expect(decoded).toStrictEqual([
			{ text: 'Hello ', style: { bold: true } },
			{ text: 'world', style: {} },
		]);
	});

	it('does not bleed formatting into following unstyled runs (regression)', () => {
		const segments = [
			{ text: 'Bold', style: { bold: true } },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Plain', style: {} },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const decoded = decodeTextBody(ytext);
		expect(decoded).toHaveLength(3);
		expect(decoded[2]).toStrictEqual({ text: 'Plain', style: {} });
		expect(decoded[2].isParagraphBreak).toBeUndefined();
	});

	it('preserves a literal newline text run without break flags (regression)', () => {
		// A run whose TEXT is "\n" (no isParagraphBreak/isLineBreak) must keep
		// its newline; it previously decoded to an empty segment, collapsing
		// "Project" + "\n" + "Atlas" into "ProjectAtlas".
		const segments = [
			{ text: 'Project', style: { bold: true } },
			{ text: '\n', style: {} },
			{ text: 'Atlas', style: { bold: true } },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const decoded = decodeTextBody(ytext);
		expect(decoded).toStrictEqual([
			{ text: 'Project', style: { bold: true } },
			{ text: '\n', style: {} },
			{ text: 'Atlas', style: { bold: true } },
		]);
	});

	it('preserves paragraph breaks, levels, and bullet info', () => {
		const segments = [
			{ text: 'Item', style: {}, paragraphLevel: 1, bulletInfo: { type: 'bullet', char: '-' } },
			{ text: '', style: {}, isParagraphBreak: true, paragraphLevel: 1 },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const decoded = decodeTextBody(ytext);
		expect(decoded[0].paragraphLevel).toBe(1);
		expect(decoded[0].bulletInfo).toStrictEqual({ type: 'bullet', char: '-' });
		expect(decoded[1].isParagraphBreak).toBeTruthy();
	});
});

describe('encodeSegmentsToDelta', () => {
	it('matches the delta a live Y.Text produces', () => {
		const cases: Record<string, unknown>[][] = [
			[{ text: 'Simple', style: {} }],
			[
				{ text: 'Bold', style: { bold: true } },
				{ text: ' plain', style: {} },
			],
			[
				{ text: 'A', style: {} },
				{ text: 'B', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: 'C', style: { italic: true } },
			],
			[{ text: '', style: { color: '#ff0000' } }],
		];
		for (const segments of cases) {
			const ytext = liveText();
			encodeTextBody(segments, ytext);
			expect(decodeDelta(encodeSegmentsToDelta(segments))).toStrictEqual(
				decodeDelta(ytext.toDelta()),
			);
		}
	});
});
