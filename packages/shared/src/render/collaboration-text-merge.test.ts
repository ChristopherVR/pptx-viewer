import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { DeltaOp } from './collaboration-text-codec';
import { decodeDelta, encodeSegmentsToDelta } from './collaboration-text-codec';
import type { YTextEditableLike } from './collaboration-text-merge';
import { isYTextEditable, mergeDeltaIntoYText } from './collaboration-text-merge';

/** Create an integrated Y.Text seeded with the given delta ops. */
function makeYText(doc: Y.Doc, key: string, ops: DeltaOp[]): Y.Text {
	const ytext = new Y.Text();
	doc.getMap('m').set(key, ytext);
	doc.transact(() => {
		let offset = 0;
		for (const op of ops) {
			if (typeof op.insert !== 'string') {
				continue;
			}
			ytext.insert(offset, op.insert, (op.attributes ?? {}) as Record<string, string>);
			offset += op.insert.length;
		}
	});
	return ytext;
}

const asEditable = (ytext: Y.Text): YTextEditableLike => ytext as unknown as YTextEditableLike;

const segs = (...segments: Record<string, unknown>[]): DeltaOp[] => encodeSegmentsToDelta(segments);

describe('isYTextEditable', () => {
	it('accepts a real Y.Text and rejects plain objects', () => {
		expect(isYTextEditable(new Y.Text())).toBeTruthy();
		expect(isYTextEditable({ toDelta: () => [] })).toBeFalsy();
		expect(isYTextEditable(null)).toBeFalsy();
	});
});

describe('mergeDeltaIntoYText', () => {
	it('applies a middle edit without touching the surrounding text', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(doc, 't', segs({ text: 'Hello cruel world', style: {} }));
		const desired = segs({ text: 'Hello world', style: {} });
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(ytext.toString()).toBe('Hello world');
		expect(decodeDelta(ytext.toDelta())).toStrictEqual(decodeDelta(desired));
	});

	it('handles pure insertion and pure deletion', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(doc, 't', segs({ text: 'abcdef', style: {} }));
		doc.transact(() => {
			expect(
				mergeDeltaIntoYText(asEditable(ytext), segs({ text: 'abcXYZdef', style: {} })),
			).toBeTruthy();
		});
		expect(ytext.toString()).toBe('abcXYZdef');
		doc.transact(() => {
			expect(
				mergeDeltaIntoYText(asEditable(ytext), segs({ text: 'abdef', style: {} })),
			).toBeTruthy();
		});
		expect(ytext.toString()).toBe('abdef');
	});

	it('does not split surrogate pairs at the diff boundary', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(doc, 't', segs({ text: 'a😀b', style: {} }));
		const desired = segs({ text: 'a😁b', style: {} });
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(ytext.toString()).toBe('a😁b');
	});

	it('inserts new runs with their own attributes (no formatting bleed)', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(
			doc,
			't',
			segs({ text: 'Bold', style: { bold: true } }, { text: ' tail', style: {} }),
		);
		// Insert an italic run between the bold head and plain tail.
		const desired = segs(
			{ text: 'Bold', style: { bold: true } },
			{ text: ' italic', style: { italic: true } },
			{ text: ' tail', style: {} },
		);
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(decodeDelta(ytext.toDelta())).toStrictEqual(decodeDelta(desired));
	});

	it('applies format-only changes in place', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(doc, 't', segs({ text: 'Hello world', style: {} }));
		const desired = segs({ text: 'Hello', style: { bold: true } }, { text: ' world', style: {} });
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(ytext.toString()).toBe('Hello world');
		expect(decodeDelta(ytext.toDelta())).toStrictEqual(decodeDelta(desired));
	});

	it('removes attributes that are gone from the desired state', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(doc, 't', segs({ text: 'Styled', style: { bold: true } }));
		const desired = segs({ text: 'Styled', style: {} });
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(decodeDelta(ytext.toDelta())).toStrictEqual(decodeDelta(desired));
	});

	it('round-trips paragraph breaks and multi-run bodies', () => {
		const doc = new Y.Doc();
		const ytext = makeYText(
			doc,
			't',
			segs(
				{ text: 'Line one', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: 'Line two', style: {} },
			),
		);
		const desired = segs(
			{ text: 'Line one edited', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Line two', style: { bold: true } },
		);
		doc.transact(() => {
			expect(mergeDeltaIntoYText(asEditable(ytext), desired)).toBeTruthy();
		});
		expect(decodeDelta(ytext.toDelta())).toStrictEqual(decodeDelta(desired));
	});

	it('merges concurrent edits to the same text at character level', () => {
		const docA = new Y.Doc();
		const ytextA = makeYText(docA, 't', segs({ text: 'Beta', style: {} }));
		const docB = new Y.Doc();
		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
		const ytextB = docB.getMap('m').get('t') as Y.Text;

		// Peer A prepends, peer B appends: both edits must survive the merge.
		docA.transact(() => {
			mergeDeltaIntoYText(asEditable(ytextA), segs({ text: 'Hello Beta', style: {} }));
		});
		docB.transact(() => {
			mergeDeltaIntoYText(asEditable(ytextB), segs({ text: 'Beta!', style: {} }));
		});
		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)));
		Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)));

		expect(ytextA.toString()).toBe('Hello Beta!');
		expect(ytextB.toString()).toBe('Hello Beta!');
	});
});
