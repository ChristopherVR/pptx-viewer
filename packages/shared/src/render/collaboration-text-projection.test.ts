import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { DeltaOp } from './collaboration-text-codec';
import { decodeTextBody, encodeSegmentsToDelta, encodeTextBody } from './collaboration-text-codec';
import { createNativeCollaborationTextEdit } from './collaboration-text-native-edit';
import { createCollaborationTextProjection } from './collaboration-text-projection';
import { createCollaborationTextSession } from './collaboration-text-session';
import { inlineListBodyText } from './inline-list-body';

const run = (text: string, extras: Partial<TextSegment> = {}): TextSegment => ({
	text,
	style: {},
	...extras,
});

describe('createNativeCollaborationTextEdit', () => {
	const bullet = { char: '•' };
	const numbered = (paragraphIndex: number) => ({
		autoNumType: 'romanUcPeriod',
		paragraphIndex,
		autoNumStartAt: 3,
	});
	const paragraphs = [
		run('III. ', { bulletInfo: numbered(0) }),
		run('First'),
		run('', { isParagraphBreak: true }),
		run('IV. ', { bulletInfo: numbered(1) }),
		run('Last'),
	];
	const edit = (
		before: TextSegment[],
		after: TextSegment[],
		paragraphSources: (number | null)[],
		from: number,
		to = from,
		hiddenSources: (number | null)[] = [],
	) =>
		createNativeCollaborationTextEdit(
			{ segments: before, delta: encodeSegmentsToDelta(before), body: inlineListBodyText(before) },
			{ segments: after, body: inlineListBodyText(after), paragraphSources, hiddenSources },
			{ from, to },
		);

	it('retains authored characters while a parsed marker moves into paragraph metadata', () => {
		const plan = edit(
			[run('• ', { bulletInfo: bullet }), run('Body')],
			[run('BodyX', { bulletInfo: bullet })],
			[0],
			4,
		);
		expect(plan?.correspondence).toStrictEqual({
			retainedIndices: [2, 3, 4, 5, null],
			paragraphSources: [0, 0, 0, 0, 0],
		});
	});

	it('maps numbered Enter without treating normalized markers as authored deletions', () => {
		const plan = edit(
			paragraphs,
			[
				run('First', { bulletInfo: numbered(0) }),
				run('', { isParagraphBreak: true }),
				run('', { bulletInfo: numbered(1) }),
				run('', { isParagraphBreak: true }),
				run('Last', { bulletInfo: numbered(2) }),
			],
			[0, 0, 3],
			5,
			5,
			[null],
		);
		expect(plan?.correspondence).toStrictEqual({
			retainedIndices: [5, 6, 7, 8, 9, null, null, 10, 15, 16, 17, 18],
			paragraphSources: [0, 0, 0, 0, 0, null, 0, null, 11, 11, 11, 11],
		});
	});

	it('retains both paragraph bodies when deleting their boundary and markers normalize', () => {
		const plan = edit(paragraphs, [run('FirstLast', { bulletInfo: numbered(0) })], [0], 5, 6);
		expect(plan?.correspondence).toStrictEqual({
			retainedIndices: [5, 6, 7, 8, 9, 15, 16, 17, 18],
			paragraphSources: Array(9).fill(0),
		});
	});

	it('uses explicit paragraph provenance after deleting the entire first paragraph', () => {
		const plan = edit(paragraphs, [run('Last', { bulletInfo: numbered(0) })], [3], 0, 6);
		expect(plan?.correspondence).toStrictEqual({
			retainedIndices: [15, 16, 17, 18],
			paragraphSources: [11, 11, 11, 11],
		});
	});

	it('uses the native range to identify which repeated character was removed', () => {
		expect(
			edit([run('aaaa')], [run('aaa')], [0], 1, 2)?.correspondence.retainedIndices,
		).toStrictEqual([0, 2, 3]);
	});

	it('retains unchanged hidden carriers, rather than rewriting every marker on each input', () => {
		expect(
			edit(
				[run('• ', { bulletInfo: bullet }), run('Body')],
				[run('• ', { bulletInfo: bullet }), run('BodyX')],
				[0],
				4,
				4,
				[0],
			)?.correspondence.retainedIndices,
		).toStrictEqual([0, 1, 2, 3, 4, 5, null]);
		expect(
			edit([run('')], [run('')], [0], 0, 0, [0])?.correspondence.retainedIndices,
		).toStrictEqual([0]);
	});

	it('retains an unchanged empty run inside a paragraph when typing beside it', () => {
		const empty = run('', { style: { bold: true } });
		const plan = edit([run('A'), empty, run('B')], [run('AX'), empty, run('B')], [0], 1, 1, [1]);
		expect(plan?.correspondence.retainedIndices).toStrictEqual([0, null, 1, 2]);
	});

	it('does not rewrite non-leading empty field carriers on an exact no-op snapshot', () => {
		const segments = [
			run('A'),
			run('', { fieldType: 'slidenum', fieldGuid: 'original-field' }),
			run('B'),
		];
		expect(edit(segments, segments, [0], 0, 0, [1])?.correspondence.retainedIndices).toStrictEqual([
			0, 1, 2,
		]);
	});

	it('preserves peer formatting on an unchanged empty run when applying the native plan', () => {
		const empty = run('', { style: { bold: true } });
		const before = [run('A'), empty, run('B')];
		const doc = new Y.Doc();
		const text = doc.getText('body');
		encodeTextBody(before, text);
		const session = createCollaborationTextSession({
			text,
			positions: {
				capture: (index, association) =>
					Y.createRelativePositionFromTypeIndex(text, index, association),
				resolve: (position) =>
					Y.createAbsolutePositionFromRelativePosition(position, doc)?.index ?? null,
			},
			transact: (callback) => doc.transact(callback),
			isCurrent: () => true,
		})!;
		text.format(1, 1, { s: JSON.stringify({ bold: true, italic: true }) });
		const plan = edit(before, [run('AX'), empty, run('B')], [0], 1, 1, [1])!;
		expect(session.applyLocalDelta(plan.delta, plan.correspondence)).toBeTruthy();
		expect(text.toString()).toBe('AX\u200bB');
		expect(decodeTextBody(text).find((segment) => segment.text === '')?.style).toStrictEqual({
			bold: true,
			italic: true,
		});
		session.dispose();
		doc.destroy();
	});

	it('keeps literal marker-looking replacement text distinct from an existing display marker', () => {
		const plan = edit(
			[run('• ', { bulletInfo: bullet }), run('B')],
			[run('• ', { bulletInfo: bullet }), run('• ')],
			[0],
			0,
			1,
			[0],
		);
		expect(plan?.correspondence.retainedIndices).toStrictEqual([0, 1, null, null]);
	});

	it('keeps repeated soft and paragraph breaks separate while inserting ordinary text', () => {
		const tail = [
			run('', { isLineBreak: true }),
			run('', { isLineBreak: true }),
			run('', { isParagraphBreak: true }),
			run(''),
			run('B'),
		];
		expect(
			edit([run('A'), ...tail], [run('AX'), ...tail], [0, 4], 1, 1, [4])?.correspondence
				.retainedIndices,
		).toStrictEqual([0, null, 1, 2, 3, 4, 5]);
	});

	it('never reuses a hidden marker identity for two cloned paragraphs', () => {
		const plan = edit(
			[run('• ', { bulletInfo: bullet })],
			[
				run('• ', { bulletInfo: bullet }),
				run('', { isParagraphBreak: true }),
				run('• ', { bulletInfo: bullet }),
			],
			[0, 0],
			0,
			0,
			[0, null],
		);
		expect(plan?.correspondence.retainedIndices).toStrictEqual([0, 1, null, null, null]);
	});

	it('does not retain a carrier on the wrong side of a known body identity', () => {
		const plan = edit(
			[run('Body'), run('', { isParagraphBreak: true }), run('')],
			[run(''), run('', { isParagraphBreak: true }), run('Body')],
			[2, 0],
			0,
			5,
			[2],
		);
		// All authored content is explicitly replaced; carrier provenance may move.
		expect(plan?.correspondence.retainedIndices).toStrictEqual([5, null, null, null, null, null]);
	});

	it('supports new/default paragraphs without inventing a metadata source', () => {
		expect(edit([], [run('A')], [null], 0)?.correspondence).toStrictEqual({
			retainedIndices: [null],
			paragraphSources: [null],
		});
	});

	it.each([[1], [-1], [0.5], [Number.NaN], [], [0, null]])(
		'rejects missing or non-carrier provenance: %j',
		(...sources) => {
			expect(edit([run('A'), run('B')], [run('ABX')], sources, 2)).toBeUndefined();
		},
	);

	it('rejects edits outside the native range, stale bodies and stale encoded snapshots', () => {
		expect(edit([run('AB')], [run('XY')], [0], 1, 2)).toBeUndefined();
		for (const before of [
			{ segments: [run('AB')], delta: [{ insert: 'AC' }], body: 'AB' },
			{ segments: [run('AB')], delta: [{ insert: 'AB' }], body: 'stale' },
		]) {
			expect(
				createNativeCollaborationTextEdit(
					before,
					{ segments: [run('ABX')], body: 'ABX', paragraphSources: [0], hiddenSources: [] },
					{ from: 2, to: 2 },
				),
			).toBeUndefined();
		}
	});

	it('keeps UTF-16 pairs intact and rejects a native range inside an emoji', () => {
		expect(
			edit([run('A😀B')], [run('AX😀B')], [0], 1)?.correspondence.retainedIndices,
		).toStrictEqual([0, null, 1, 2, 3]);
		expect(edit([run('A😀B')], [run('A\ud83dX\ude00B')], [0], 2)).toBeUndefined();
	});

	it.each([
		{ sources: [] },
		{ sources: [0] },
		{ sources: [1, 1] },
		{ sources: [-1] },
		{ sources: [0.5] },
	])('rejects incomplete or invalid hidden identity provenance: $sources', ({ sources }) => {
		const segments = [run('A'), run(''), run('B')];
		expect(edit(segments, segments, [0], 0, 0, sources)).toBeUndefined();
	});

	it('rejects reusing a hidden identity or placing it across retained authored characters', () => {
		expect(edit([run('')], [run(''), run('')], [0], 0, 0, [0, 0])).toBeUndefined();
		expect(edit([run('A'), run('')], [run(''), run('A')], [0], 0, 0, [1])).toBeUndefined();
	});

	it('requires explicit new hidden carriers independently from their paragraph format source', () => {
		expect(edit([run('')], [run('')], [0], 0, 0, [null])?.correspondence).toStrictEqual({
			retainedIndices: [null],
			paragraphSources: [0],
		});
	});

	it('rejects sparse provenance arrays rather than treating missing entries as new', () => {
		expect(edit([run('')], [run('')], [0], 0, 0, new Array(1))).toBeUndefined();
		expect(edit([run('A')], [run('A')], new Array(1), 0)).toBeUndefined();
	});

	it('retains leading, adjacent interior and trailing carriers around a native insertion', () => {
		const leading = run('', { style: { bold: true } });
		const interior = run('', { style: { italic: true } });
		const trailing = run('', { fieldType: 'slidenum', fieldGuid: 'tail-field' });
		const before = [leading, run('A'), interior, run(''), run('B'), trailing];
		const after = [leading, run('AX'), interior, run(''), run('B'), trailing];
		expect(
			edit(before, after, [0], 1, 1, [0, 2, 3, 5])?.correspondence.retainedIndices,
		).toStrictEqual([0, 1, null, 2, 3, 4, 5]);
	});

	it('retains exact hidden identities even when their encoded empty-run attributes coalesce', () => {
		const before = [run('A'), run(''), run(''), run('B')];
		const after = [run('AX'), run(''), run(''), run('B')];
		expect(encodeSegmentsToDelta(before)).toStrictEqual([{ insert: 'A\u200b\u200bB' }]);
		expect(edit(before, after, [0], 1, 1, [1, 2])?.correspondence.retainedIndices).toStrictEqual([
			0,
			null,
			1,
			2,
			3,
		]);
	});

	it('retains carrier identity for a style-only edit rather than replacing its character', () => {
		const before = [run('A'), run('', { style: { bold: true } }), run('B')];
		const after = [run('A'), run('', { style: { bold: false, underline: true } }), run('B')];
		const plan = edit(before, after, [0], 1, 1, [1]);
		expect(plan?.correspondence.retainedIndices).toStrictEqual([0, 1, 2]);
		expect(plan?.delta[1].attributes).toStrictEqual({ s: '{"bold":false,"underline":true}' });
	});

	it('preserves every UTF-16 unit in a picture marker independently of new paragraph metadata', () => {
		const marker = run('📎 ', { bulletInfo: { imageRelId: 'rId1' } });
		const plan = edit([marker, run('A')], [marker, run('AX')], [null], 1, 1, [0]);
		expect(plan?.correspondence).toStrictEqual({
			retainedIndices: [0, 1, 2, 3, null],
			paragraphSources: [null, null, null, null, null],
		});
	});

	it('rejects reordered adjacent carrier identities even if all encoded characters are equal', () => {
		const segments = [run('A'), run(''), run(''), run('B')];
		expect(edit(segments, segments, [0], 1, 1, [2, 1])).toBeUndefined();
	});

	it('does not revive a remotely deleted carrier while applying a local text insertion', () => {
		const empty = run('', { style: { bold: true } });
		const before = [run('A'), empty, run('B')];
		const doc = new Y.Doc();
		const text = doc.getText('body');
		encodeTextBody(before, text);
		const session = createCollaborationTextSession({
			text,
			positions: {
				capture: (index, association) =>
					Y.createRelativePositionFromTypeIndex(text, index, association),
				resolve: (position) =>
					Y.createAbsolutePositionFromRelativePosition(position, doc)?.index ?? null,
			},
			transact: (callback) => doc.transact(callback),
			isCurrent: () => true,
		})!;
		text.delete(1, 1);
		const plan = edit(before, [run('AX'), empty, run('B')], [0], 1, 1, [1])!;
		expect(session.applyLocalDelta(plan.delta, plan.correspondence)).toBeTruthy();
		expect(text.toString()).toBe('AXB');
		session.dispose();
		doc.destroy();
	});
});

function project(segments: TextSegment[], body = inlineListBodyText(segments)) {
	const doc = new Y.Doc();
	const text = doc.getText('body');
	encodeTextBody(segments, text);
	const projection = createCollaborationTextProjection(segments, text.toDelta(), body);
	doc.destroy();
	if (!projection) {
		throw new Error('Expected a valid authored-body projection');
	}
	return projection;
}

describe('createCollaborationTextProjection', () => {
	it('maps ordinary text in UTF-16 units and rejects surrogate interiors', () => {
		const projection = project([run('A😀B')]);
		expect(projection.spans).toStrictEqual([
			{ segmentIndex: 0, bodyStart: 0, bodyEnd: 4, encodedStart: 0, encodedEnd: 4, kind: 'text' },
		]);
		for (const offset of [0, 1, 3, 4]) {
			expect(projection.bodyOffsetToEncoded(offset)).toStrictEqual({ start: offset, end: offset });
			expect(projection.encodedOffsetToBody(offset)).toBe(offset);
		}
		expect(projection.bodyOffsetToEncoded(2)).toBeUndefined();
		expect(projection.encodedOffsetToBody(2)).toBeUndefined();
	});

	it('keeps literal newlines and zero-width characters as authored content', () => {
		const projection = project([run('A\n\n\u200bB')]);
		expect(projection.spans[0].kind).toBe('text');
		for (let offset = 0; offset <= 5; offset++) {
			expect(projection.bodyOffsetToEncoded(offset)).toStrictEqual({ start: offset, end: offset });
		}
	});

	it('distinguishes empty carriers from adjacent literal zero-width characters after coalescing', () => {
		const projection = project([run(''), run('\u200b'), run(''), run('A'), run('')]);
		expect(projection.spans.map((span) => span.kind)).toStrictEqual([
			'empty-carrier',
			'text',
			'empty-carrier',
			'text',
			'empty-carrier',
		]);
		expect(projection.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 1 });
		expect(projection.bodyOffsetToEncoded(1)).toStrictEqual({ start: 2, end: 3 });
		expect(projection.bodyOffsetToEncoded(2)).toStrictEqual({ start: 4, end: 5 });
		expect([0, 1, 2, 3, 4, 5].map(projection.encodedOffsetToBody)).toStrictEqual([
			0, 0, 1, 1, 2, 2,
		]);
	});

	it('retains each explicit paragraph and soft break despite Y.Text coalescing', () => {
		const projection = project([
			run('A'),
			run('', { isParagraphBreak: true }),
			run('', { isParagraphBreak: true }),
			run('', { isLineBreak: true }),
			run('', { isLineBreak: true }),
			run('B'),
		]);
		expect(projection.spans.map((span) => span.kind)).toStrictEqual([
			'text',
			'paragraph-break',
			'paragraph-break',
			'line-break',
			'line-break',
			'text',
		]);
		for (let offset = 0; offset <= 6; offset++) {
			expect(projection.bodyOffsetToEncoded(offset)).toStrictEqual({ start: offset, end: offset });
		}
	});

	it('follows the existing standalone literal-newline paragraph boundary contract', () => {
		const projection = project([
			run('A'),
			run('\n'),
			run('• ', { bulletInfo: { char: '•' } }),
			run('B'),
		]);
		expect(projection.spans[1].kind).toBe('paragraph-break');
		expect(projection.spans[2].kind).toBe('bullet-marker');
		expect(projection.bodyOffsetToEncoded(2)).toStrictEqual({ start: 2, end: 4 });
	});

	it('excludes only the genuine first paragraph marker, including picture markers', () => {
		const projection = project([
			run('• ', { bulletInfo: { char: '•' } }),
			run('• ', { bulletInfo: { char: '•' } }),
			run('', { isParagraphBreak: true }),
			run('📎 ', { bulletInfo: { imageRelId: 'rId1' } }),
			run('Body'),
		]);
		expect(projection.spans.map((span) => span.kind)).toStrictEqual([
			'bullet-marker',
			'text',
			'paragraph-break',
			'bullet-marker',
			'text',
		]);
		expect(projection.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 2 });
		expect(projection.bodyOffsetToEncoded(3)).toStrictEqual({ start: 5, end: 8 });
		expect(projection.encodedOffsetToBody(6)).toBeUndefined();
		expect(projection.encodedOffsetToBody(7)).toBe(3);
	});

	it('treats a numbered literal without runtime marker provenance as authored text', () => {
		const literal = project([run('1. ', { bulletInfo: { autoNumType: 'arabicPeriod' } })]);
		const marker = project([
			run('1. ', { bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 } }),
		]);
		expect(literal.spans[0].kind).toBe('text');
		expect(literal.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 0 });
		expect(marker.spans[0].kind).toBe('bullet-marker');
		expect(marker.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 3 });
	});

	it('does not hide a marker after a preceding empty run or a soft break', () => {
		for (const first of [run(''), run('', { isLineBreak: true })]) {
			const projection = project([first, run('• ', { bulletInfo: { char: '•' } })]);
			expect(projection.spans[1].kind).toBe('text');
		}
	});

	it('honors the soft-break flag before interpreting text as a bullet marker', () => {
		const segments = [run('• ', { isLineBreak: true, bulletInfo: { char: '•' } })];
		const projection = project(segments);
		expect(projection.spans[0].kind).toBe('line-break');
		expect(projection.bodyOffsetToEncoded(1)).toStrictEqual({ start: 1, end: 1 });
		expect(projection.encodedOffsetToBody(1)).toBe(1);
	});

	it('accepts equivalent delta run boundaries and attribute key ordering', () => {
		const segments = [run('AB', { style: { bold: true }, fieldType: 'slidenum' }), run('C')];
		const delta = [
			{ insert: 'A', attributes: { ft: 'slidenum', s: '{"bold":true}' } },
			{ insert: '', attributes: {} },
			{ insert: 'B', attributes: { s: '{"bold":true}', ft: 'slidenum' } },
			{ insert: 'C', attributes: {} },
		];
		expect(createCollaborationTextProjection(segments, delta, 'ABC')).toBeDefined();
	});

	it.each<{ delta: DeltaOp[] }>([
		{ delta: [{ insert: 'AC' }] },
		{ delta: [{ insert: 'AB', attributes: { s: '{"bold":true}' } }] },
		{ delta: [{ insert: 'AB', attributes: { custom: 1 } }] },
		{ delta: [{ insert: { image: 'not text' } }] },
		{ delta: [{ insert: 'A' }] },
	])('rejects mismatched or unsupported encoded snapshots: $delta', ({ delta }) => {
		expect(createCollaborationTextProjection([run('AB')], delta, 'AB')).toBeUndefined();
	});

	it('rejects visible display substitutions but not unchanged field/equation metadata', () => {
		for (const metadata of [{ fieldType: 'slidenum' }, { equationXml: { 'm:r': 'x' } }]) {
			const segments = [run('1', metadata)];
			const delta = encodeSegmentsToDelta(segments);
			expect(createCollaborationTextProjection(segments, delta, '42')).toBeUndefined();
			expect(createCollaborationTextProjection(segments, delta, '1')).toBeDefined();
		}
	});

	it('rejects stale DOM body or a scalar-text fallback not represented in segments', () => {
		expect(
			createCollaborationTextProjection([run('before')], [{ insert: 'before' }], 'after'),
		).toBeUndefined();
		expect(createCollaborationTextProjection([], [], 'scalar fallback')).toBeUndefined();
	});

	it('distinguishes no segments from one or more known empty runs', () => {
		const absent = project([]);
		const empty = project([run(''), run('')]);
		expect(absent.spans).toStrictEqual([]);
		expect(absent.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 0 });
		expect(absent.encodedOffsetToBody(0)).toBe(0);
		expect(empty.bodyOffsetToEncoded(0)).toStrictEqual({ start: 0, end: 2 });
	});

	it.each([-1, 0.5, 5, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid offset %s',
		(offset) => {
			const projection = project([run('ABCD')]);
			expect(projection.bodyOffsetToEncoded(offset)).toBeUndefined();
			expect(projection.encodedOffsetToBody(offset)).toBeUndefined();
		},
	);

	it('rejects surrogate interiors even when the pair straddles segment boundaries', () => {
		const projection = project([run('\ud83d'), run('\ude00')]);
		expect(projection.bodyOffsetToEncoded(1)).toBeUndefined();
		expect(projection.encodedOffsetToBody(1)).toBeUndefined();
	});

	it('does not map an encoded carrier boundary into the middle of an authored surrogate pair', () => {
		const segments = [run('\ud83d'), run(''), run('\ude00')];
		const projection = createCollaborationTextProjection(
			segments,
			encodeSegmentsToDelta(segments),
			'😀',
		);
		expect(projection?.bodyOffsetToEncoded(1)).toBeUndefined();
		expect(projection?.encodedOffsetToBody(1)).toBeUndefined();
		expect(projection?.encodedOffsetToBody(2)).toBeUndefined();
	});
});
