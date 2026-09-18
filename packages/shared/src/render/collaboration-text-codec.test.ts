import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { YTextLike } from './collaboration-text-codec';
import {
	decodeDelta,
	decodeTextBody,
	encodeSegmentsToDelta,
	encodeTextBody,
} from './collaboration-text-codec';
import { mergeDeltaIntoYText } from './collaboration-text-merge';

function liveText(): YTextLike {
	const doc = new Y.Doc();
	return doc.getText('t') as unknown as YTextLike;
}

describe('encodeTextBody / decodeTextBody', () => {
	it.each([
		{
			name: 'paragraph',
			flag: { isParagraphBreak: true },
			metadata: {
				paragraphLevel: 2,
				endParaRunProperties: { '@_sz': '1800' },
				paragraphInsertionStyle: { bold: true, fontSize: 18 },
				paragraphProperties: {
					paragraphSpacingAfter: 12,
					tabStops: [{ position: 72, align: 'l' }],
				},
			},
		},
		{
			name: 'soft line',
			flag: { isLineBreak: true },
			metadata: { breakRunProperties: { '@_lang': 'ja-JP', '@_sz': '1800' } },
		},
	])('restores each coalesced $name break with its metadata', ({ flag, metadata }) => {
		const breakSegment = {
			text: '',
			style: { fontSize: 18, authoredRunStyle: { fontSize: 18 } },
			...flag,
			...metadata,
		};
		const segments = [
			{ text: 'before', style: {} },
			structuredClone(breakSegment),
			structuredClone(breakSegment),
			structuredClone(breakSegment),
			{ text: 'after', style: {} },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const delta = ytext.toDelta();
		expect(delta.map((op) => op.insert)).toStrictEqual(['before', '\n\n\n', 'after']);
		const decoded = decodeTextBody(ytext);
		expect(decoded).toStrictEqual(segments);
		expect(decoded[1]).not.toBe(decoded[2]);
		expect(decoded[1].style).not.toBe(decoded[2].style);
		expect((decoded[1].style as Record<string, unknown>).authoredRunStyle).not.toBe(
			(decoded[2].style as Record<string, unknown>).authoredRunStyle,
		);
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof value === 'object') {
				expect(decoded[1][key]).not.toBe(decoded[2][key]);
			}
		}
		expect(encodeSegmentsToDelta(decoded)).toStrictEqual(delta);
	});

	it.each([
		{ insert: '\n\n', attributes: undefined, expected: { text: '\n\n', style: {} } },
		{ insert: 'A\n\nB', attributes: undefined, expected: { text: 'A\n\nB', style: {} } },
		{ insert: '\n\n', attributes: { pb: '0' }, expected: { text: '\n\n', style: {} } },
		{
			insert: '\nA\n',
			attributes: { pb: '1' },
			expected: { text: '\nA\n', style: {}, isParagraphBreak: true },
		},
		{
			insert: '\r\n',
			attributes: { lb: '1' },
			expected: { text: '\r\n', style: {}, isLineBreak: true },
		},
	])('preserves the existing non-marker fallback for %j', ({ insert, attributes, expected }) => {
		expect(decodeDelta([{ insert, attributes }])).toStrictEqual([expected]);
	});

	it('preserves per-paragraph geometry through a document update to another peer', () => {
		const paragraphProperties: TextStyle = {
			align: 'right',
			paragraphMarginLeft: 54,
			paragraphMarginRight: 12,
			paragraphIndent: -18,
			lineSpacing: 1.5,
			paragraphSpacingBefore: 7,
			paragraphSpacingAfter: 13,
			tabStops: [{ position: 96, align: 'dec' }],
		};
		const segments: TextSegment[] = [
			{ text: 'First', style: { fontSize: 24 }, paragraphProperties },
			{ text: '', style: {}, isParagraphBreak: true },
			{
				text: 'Second',
				style: { fontSize: 24 },
				paragraphProperties: {
					paragraphMarginLeft: 0,
					paragraphIndent: 0,
					lineSpacingExactPt: 30,
					paragraphSpacingBefore: 0,
					paragraphSpacingAfter: 0,
				},
			},
		];
		const source = new Y.Doc();
		const peer = new Y.Doc();
		encodeTextBody(segments, source.getText('body'));
		Y.applyUpdate(peer, Y.encodeStateAsUpdate(source));
		expect(decodeTextBody(peer.getText('body'))).toStrictEqual(segments);
		expect(encodeSegmentsToDelta(segments)).toStrictEqual(source.getText('body').toDelta());
		source.destroy();
		peer.destroy();
	});

	it('preserves paragraph properties on empty carriers and paragraph terminators independently', () => {
		const paragraphProperties: TextStyle = {
			paragraphSpacingAfter: 14,
			tabStops: [{ position: 72, align: 'l' }],
		};
		const segments: TextSegment[] = [
			{ text: '', style: {}, paragraphProperties },
			{ text: '', style: {}, isParagraphBreak: true, paragraphProperties },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		const decoded = decodeTextBody(ytext);
		expect(decoded).toStrictEqual(segments);
		const first = decoded[0].paragraphProperties as TextStyle;
		const second = decoded[1].paragraphProperties as TextStyle;
		expect(first).not.toBe(second);
		expect(first.tabStops).not.toBe(second.tabStops);
		first.tabStops![0].position = 10;
		expect(second.tabStops![0].position).toBe(72);
		expect(paragraphProperties.tabStops![0].position).toBe(72);
	});

	it('does not merge runs with different paragraph properties or inherit them into an unstyled run', () => {
		const segments: TextSegment[] = [
			{ text: 'A', style: {}, paragraphProperties: { paragraphIndent: 12 } },
			{ text: 'B', style: {}, paragraphProperties: { paragraphIndent: 24 } },
			{ text: 'C', style: {} },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		expect(ytext.toDelta()).toHaveLength(3);
		expect(decodeTextBody(ytext)).toStrictEqual(segments);
		expect(encodeSegmentsToDelta(segments)).toStrictEqual(ytext.toDelta());
	});

	it('coalesces equal paragraph properties without dropping them', () => {
		const paragraphProperties: TextStyle = { paragraphSpacingBefore: 8 };
		const segments: TextSegment[] = [
			{ text: 'A', style: {}, paragraphProperties },
			{ text: 'B', style: {}, paragraphProperties: structuredClone(paragraphProperties) },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		expect(ytext.toDelta()).toHaveLength(1);
		expect(decodeTextBody(ytext)).toStrictEqual([{ text: 'AB', style: {}, paragraphProperties }]);
		expect(encodeSegmentsToDelta(segments)).toStrictEqual(ytext.toDelta());
	});

	it('removes paragraph properties through the existing incremental reconciliation', () => {
		const doc = new Y.Doc();
		const ytext = doc.getText('body');
		const segments = [
			{ text: 'Body', style: {}, paragraphProperties: { paragraphSpacingAfter: 18 } },
		];
		encodeTextBody(segments, ytext);
		expect(decodeTextBody(ytext)).toStrictEqual(segments);
		const cleared = [{ text: 'Body', style: {} }];
		doc.transact(() => {
			expect(mergeDeltaIntoYText(ytext, encodeSegmentsToDelta(cleared))).toBeTruthy();
		});
		expect(decodeTextBody(ytext)).toStrictEqual(cleared);
		expect(ytext.toDelta()).toStrictEqual([{ insert: 'Body' }]);
		doc.destroy();
	});

	it('ignores malformed paragraph-property JSON and leaves legacy deltas unchanged', () => {
		expect(decodeDelta([{ insert: 'Body', attributes: { pp: '{invalid' } }])).toStrictEqual([
			{ text: 'Body', style: {} },
		]);
		expect(decodeDelta([{ insert: 'Legacy' }])).toStrictEqual([{ text: 'Legacy', style: {} }]);
	});

	it('preserves insertion formatting on an empty carrier and a paragraph terminator', () => {
		const paragraphInsertionStyle = {
			fontSize: 40,
			bold: true,
			authoredRunStyle: { bold: true },
			inheritedRunStyle: { fontSize: 40 },
		};
		const segments = [
			{ text: '', style: {}, paragraphInsertionStyle },
			{ text: '\n', style: {}, isParagraphBreak: true, paragraphInsertionStyle },
		];
		const ytext = liveText();
		encodeTextBody(segments, ytext);
		expect(decodeTextBody(ytext)).toStrictEqual(
			segments.map((segment) => ({ ...segment, text: '' })),
		);
		expect(
			decodeDelta([{ insert: 'Body', attributes: { pi: '{invalid' } }])[0].paragraphInsertionStyle,
		).toBeUndefined();
	});

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
