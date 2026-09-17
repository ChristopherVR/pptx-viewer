import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
	createCollaborationLivePatcher,
	findElementYMap,
	publishLiveGeometry,
	publishLiveInlineText,
} from './collaboration-live-patch';
import { LOCAL_SYNC_ORIGIN, reconcileSlidesInYDoc } from './collaboration-reconcile';
import type { YDocLike, YjsFactories } from './collaboration-sync';
import { COMPLEX_ELEMENT_FIELDS, readSlidesFromYDoc } from './collaboration-sync';
import { createSnapshotTextPositions } from './collaboration-text-snapshot-positions';
import { buildInlineTextCommitPatch } from './inline-text-commit';

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;

function makeElement(id: string, text: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 10,
		y: 20,
		width: 300,
		height: 80,
		text,
		textSegments: [{ text, style: {} }],
	} as unknown as PptxElement;
}

function makeSlide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, slideNumber: 1, elements } as unknown as PptxSlide;
}

function seedDoc(): Y.Doc {
	const doc = new Y.Doc();
	reconcileSlidesInYDoc([makeSlide('s1', [makeElement('e1', 'Hello')])], asDoc(doc), factories);
	return doc;
}

const firstElement = (doc: Y.Doc): Record<string, unknown> =>
	readSlidesFromYDoc(asDoc(doc))[0].elements[0] as unknown as Record<string, unknown>;

function textState(doc: Y.Doc): { text: unknown; textBody: string } {
	const textBody = findElementYMap(asDoc(doc), 's1', 'e1')?.get('textBody');
	if (!(textBody instanceof Y.Text)) {
		throw new Error('Expected the seeded element to retain its Y.Text');
	}
	return { text: firstElement(doc).text, textBody: textBody.toString() };
}

function nativeFactories(doc: Y.Doc): YjsFactories {
	return {
		...factories,
		createTextPositions: (text) =>
			createSnapshotTextPositions(text as unknown as Y.Text, {
				read: () => Y.snapshot(doc),
				equal: Y.equalSnapshots,
				subscribeBeforeObservers: (listener) => {
					doc.on('beforeObserverCalls', listener);
					return () => doc.off('beforeObserverCalls', listener);
				},
			}),
	};
}
function nativePatcher(doc: Y.Doc) {
	const patcher = createCollaborationLivePatcher();
	patcher.configure(asDoc(doc), nativeFactories(doc));
	return patcher;
}

function createTextPeers(connected = true) {
	const docs = [seedDoc(), new Y.Doc()] as const;
	Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]));
	const patchers = docs.map(nativePatcher);
	const sessions = patchers.map((patcher) => patcher.beginTextEdit?.('s1', 'e1'));
	const relay = (source: Y.Doc, target: Y.Doc) => (update: Uint8Array, origin: unknown) => {
		if (origin !== target) {
			Y.applyUpdate(target, update, source);
		}
	};
	const toSecond = relay(docs[0], docs[1]);
	const toFirst = relay(docs[1], docs[0]);
	if (connected) {
		docs[0].on('update', toSecond);
		docs[1].on('update', toFirst);
	}
	// Both native editors opened before either peer typed; their DOM drafts
	// retain this baseline even as the live document receives remote updates.
	const openedSlide = makeSlide('s1', [makeElement('e1', 'Hello')]);
	return {
		docs,
		publish(index: number, text: string): void {
			expect(sessions[index]?.applyLocalDelta([{ insert: text }])).toBeTruthy();
			publishLiveInlineText(patchers[index], openedSlide, 'e1', text);
			patchers[index].flush();
		},
		commit(index: number, text: string): void {
			patchers[index].flush();
			const slides = readSlidesFromYDoc(asDoc(docs[index]));
			const element = slides[0].elements[0];
			const snapshot = sessions[index]?.readMerged()?.inline;
			expect(snapshot).toBeDefined();
			const patch = buildInlineTextCommitPatch(element, snapshot?.text ?? text, snapshot);
			if (patch) {
				slides[0].elements[0] = { ...element, ...patch } as PptxElement;
				reconcileSlidesInYDoc(slides, asDoc(docs[index]), factories);
			}
		},
		dispose(): void {
			docs[0].off('update', toSecond);
			docs[1].off('update', toFirst);
			patchers.forEach((patcher) => patcher.dispose());
			docs.forEach((doc) => doc.destroy());
		},
	};
}

describe('createCollaborationLivePatcher', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not replace an editor opened reentrantly by the previous editor retirement', () => {
		const doc = seedDoc();
		const patcher = nativePatcher(doc);
		let newer: ReturnType<NonNullable<typeof patcher.beginTextEdit>>;
		const retired = vi.fn(() => {
			newer = patcher.beginTextEdit!('s1', 'e1');
		});
		const old = patcher.beginTextEdit!('s1', 'e1', retired)!;
		expect(patcher.beginTextEdit!('s1', 'e1')).toBeUndefined();
		expect(retired).toHaveBeenCalledOnce();
		old.dispose();
		expect(newer?.applyLocalDelta([{ insert: 'Hello!' }])).toBe(true);
		expect(textState(doc).textBody).toBe('Hello!');
		patcher.dispose();
		doc.destroy();
	});

	it('does not clear a reentrant configuration when retiring the previous channel', () => {
		const doc = seedDoc();
		const patcher = nativePatcher(doc);
		let newer: ReturnType<NonNullable<typeof patcher.beginTextEdit>>;
		const retired = vi.fn(() => {
			patcher.configure(doc, nativeFactories(doc));
			newer = patcher.beginTextEdit!('s1', 'e1');
		});
		const old = patcher.beginTextEdit!('s1', 'e1', retired)!;
		patcher.configure(null, null);
		expect(retired).toHaveBeenCalledOnce();
		expect(patcher.isActive()).toBe(true);
		old.dispose();
		expect(newer?.applyLocalDelta([{ insert: 'Hello!' }])).toBe(true);
		expect(textState(doc).textBody).toBe('Hello!');
		patcher.dispose();
		doc.destroy();
	});

	it.each(['missing', 'empty'])(
		'seeds %s legacy text from the same authored plain paragraphs',
		(kind) => {
			const doc = seedDoc();
			const map = findElementYMap(asDoc(doc), 's1', 'e1')!;
			if (kind === 'missing') {
				map.delete('textBody');
			} else {
				map.set('textBody', new Y.Text());
			}
			map.set('text', 'First\nSecond\n');
			map.set(COMPLEX_ELEMENT_FIELDS.textStyle, JSON.stringify({ bold: true }));
			const patcher = nativePatcher(doc);
			const target = patcher.beginTextEdit!('s1', 'e1');
			expect(target?.readMerged()?.inline).toMatchObject({
				text: 'First\nSecond\n',
				textSegments: [
					{ text: 'First', style: { bold: true } },
					{ text: '', isParagraphBreak: true },
					{ text: 'Second', style: { bold: true } },
					{ text: '', isParagraphBreak: true },
					{ text: '', style: { bold: true } },
				],
			});
			patcher.dispose();
			doc.destroy();
		},
	);

	it('retires replaced text handles without letting old cleanup release a new editor', () => {
		const doc = seedDoc();
		const patcher = nativePatcher(doc);
		const old = patcher.beginTextEdit!('s1', 'e1')!;
		const current = patcher.beginTextEdit!('s1', 'e1')!;
		old.dispose();
		expect(old.applyLocalDelta([{ insert: 'stale' }])).toBeFalsy();
		expect(current.applyLocalDelta([{ insert: 'Hello!' }])).toBeTruthy();
		patcher.patchText('s1', 'e1', 'stale fallback');
		expect(textState(doc).textBody).toBe('Hello!');
		findElementYMap(asDoc(doc), 's1', 'e1')!.set('textBody', new Y.Text('replacement'));
		expect(current.applyLocalDelta([{ insert: 'Hello!stale' }])).toBeFalsy();
		expect(textState(doc).textBody).toBe('replacement');
		patcher.dispose();
		doc.destroy();
	});

	it('does not seed legacy text when a transaction-start host revokes authority', () => {
		const doc = seedDoc();
		const map = findElementYMap(asDoc(doc), 's1', 'e1')!;
		map.delete('textBody');
		const patcher = nativePatcher(doc);
		const revoke = () => patcher.configure(null, null);
		doc.on('beforeTransaction', revoke);
		expect(patcher.beginTextEdit!('s1', 'e1')).toBeUndefined();
		expect(map.get('textBody')).toBeUndefined();
		expect(map.get('text')).toBe('Hello');
		doc.off('beforeTransaction', revoke);
		patcher.dispose();
		doc.destroy();
	});

	it('drops only queued legacy text before a host flushes during native initialization', () => {
		const doc = seedDoc();
		const patcher = nativePatcher(doc);
		patcher.patchGeometry('s1', 'e1', { x: 42 });
		patcher.patchText('s1', 'e1', 'queued stale draft');
		patcher.patchGeometry('s1', 'e1', { y: 53 });
		findElementYMap(asDoc(doc), 's1', 'e1')!.delete('textBody');
		const flush = () => {
			patcher.patchText('s1', 'e1', 'reentrant stale draft');
			patcher.flush();
		};
		doc.on('beforeTransaction', flush);
		const target = patcher.beginTextEdit!('s1', 'e1');
		doc.off('beforeTransaction', flush);
		expect(target?.readMerged()?.inline.text).toBe('Hello');
		expect(firstElement(doc)).toMatchObject({ x: 42, y: 53, text: 'Hello' });
		patcher.dispose();
		doc.destroy();
	});

	it('does not let an outer initialization replace a newer reentrant editor', () => {
		const doc = seedDoc();
		const patcher = nativePatcher(doc);
		findElementYMap(asDoc(doc), 's1', 'e1')!.delete('textBody');
		let newer: ReturnType<NonNullable<typeof patcher.beginTextEdit>>;
		const replace = () => {
			doc.off('beforeTransaction', replace);
			newer = patcher.beginTextEdit!('s1', 'e1');
		};
		doc.on('beforeTransaction', replace);
		expect(patcher.beginTextEdit!('s1', 'e1')).toBeUndefined();
		expect(newer?.applyLocalDelta([{ insert: 'Hello!' }])).toBeTruthy();
		patcher.patchText('s1', 'e1', 'stale fallback');
		patcher.flush();
		expect(textState(doc).textBody).toBe('Hello!');
		patcher.dispose();
		doc.destroy();
	});

	it('no-ops safely without a doc', () => {
		const patcher = createCollaborationLivePatcher();
		expect(patcher.isActive()).toBeFalsy();
		expect(() => {
			patcher.patchGeometry('s1', 'e1', { x: 5 });
			patcher.patchText('s1', 'e1', 'hi');
			patcher.flush();
			patcher.dispose();
		}).not.toThrow();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('writes the first geometry patch immediately', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		expect(patcher.isActive()).toBeTruthy();

		patcher.patchGeometry('s1', 'e1', { x: 111, y: 222 });
		expect(firstElement(doc).x).toBe(111);
		expect(firstElement(doc).y).toBe(222);
	});

	it('throttles bursts to one write per window and flushes the trailing state', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);

		let writes = 0;
		doc.on('afterTransaction', () => {
			writes++;
		});

		patcher.patchGeometry('s1', 'e1', { x: 1 });
		expect(writes).toBe(1);
		for (let i = 2; i <= 10; i++) {
			vi.advanceTimersByTime(4);
			patcher.patchGeometry('s1', 'e1', { x: i });
		}
		// Still inside the first 50ms window: nothing extra was written yet.
		expect(writes).toBe(1);
		expect(firstElement(doc).x).toBe(1);

		vi.advanceTimersByTime(50);
		expect(writes).toBe(2);
		expect(firstElement(doc).x).toBe(10);
	});

	it('writes immediately only for the configured session, retaining the built-in throttle', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories, true);
		patcher.patchGeometry('s1', 'e1', { x: 1 });
		patcher.patchGeometry('s1', 'e1', { x: 2 });
		expect(firstElement(doc).x).toBe(2);
		expect(vi.getTimerCount()).toBe(0);
		patcher.configure(asDoc(doc), factories);
		patcher.patchGeometry('s1', 'e1', { x: 3 });
		patcher.patchGeometry('s1', 'e1', { x: 4 });
		expect(firstElement(doc).x).toBe(3);
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(50);
		expect(firstElement(doc).x).toBe(4);
		patcher.dispose();
		doc.destroy();
	});

	it('flush() writes pending state synchronously and cancels the timer', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);

		patcher.patchGeometry('s1', 'e1', { x: 1 });
		patcher.patchGeometry('s1', 'e1', { x: 2, width: 400 });
		expect(vi.getTimerCount()).toBe(1);

		patcher.flush();
		expect(vi.getTimerCount()).toBe(0);
		expect(firstElement(doc).x).toBe(2);
		expect(firstElement(doc).width).toBe(400);
	});

	it('tags every transaction with LOCAL_SYNC_ORIGIN', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		const origins: unknown[] = [];
		doc.on('afterTransaction', (transaction: Y.Transaction) => {
			origins.push(transaction.origin);
		});

		patcher.patchGeometry('s1', 'e1', { x: 9 });
		patcher.patchText('s1', 'e1', 'Hey');
		patcher.flush();

		expect(origins.length).toBeGreaterThan(0);
		expect(origins.every((o) => o === LOCAL_SYNC_ORIGIN)).toBeTruthy();
	});

	it('patches text through the character-level Y.Text merge', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		const before = findElementYMap(asDoc(doc), 's1', 'e1')?.get('textBody');
		patcher.patchText('s1', 'e1', 'Hello world', {
			textSegments: [{ text: 'Hello', style: {} }],
		});
		patcher.flush();

		const element = firstElement(doc);
		expect(element.text).toBe('Hello world');
		expect(element.textSegments).toStrictEqual([{ text: 'Hello world', style: {} }]);
		// In-place merge: the Y.Text instance is reused, not replaced.
		expect(findElementYMap(asDoc(doc), 's1', 'e1')?.get('textBody')).toBe(before);
	});

	it('merges concurrent typing on the same element instead of last-write-wins', () => {
		const docA = seedDoc();
		const docB = new Y.Doc();
		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

		const patcherA = createCollaborationLivePatcher();
		const patcherB = createCollaborationLivePatcher();
		patcherA.configure(asDoc(docA), factories);
		patcherB.configure(asDoc(docB), factories);

		patcherA.patchText('s1', 'e1', 'Hello!', { textSegments: [{ text: 'Hello', style: {} }] });
		patcherA.flush();
		patcherB.patchText('s1', 'e1', '>Hello', { textSegments: [{ text: 'Hello', style: {} }] });
		patcherB.flush();

		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)));
		Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)));

		const merged = (firstElement(docA).textSegments as Array<{ text: string }>)
			.map((s) => s.text)
			.join('');
		expect(merged).toBe('>Hello!');
		expect(merged).toBe(
			(firstElement(docB).textSegments as Array<{ text: string }>).map((s) => s.text).join(''),
		);
	});

	it('preserves a delivered prefix when another open editor publishes its stale append draft', () => {
		const peers = createTextPeers();
		try {
			peers.publish(0, 'ALPHA Hello');
			// Unlike the disconnected merge above, delivery happens before B writes.
			expect(textState(peers.docs[1]).textBody).toBe('ALPHA Hello');
			peers.publish(1, 'Hello OMEGA');
			for (const doc of peers.docs) {
				expect(textState(doc)).toStrictEqual({
					text: 'ALPHA Hello OMEGA',
					textBody: 'ALPHA Hello OMEGA',
				});
			}
		} finally {
			peers.dispose();
		}
	});

	it.each([
		[0, 1],
		[1, 0],
	])('preserves both connected drafts when peer %i blurs before peer %i', (first, second) => {
		const peers = createTextPeers();
		const drafts = ['ALPHA Hello', 'Hello OMEGA'];
		try {
			peers.publish(0, drafts[0]);
			peers.publish(1, drafts[1]);
			// The existing binding commit path remaps the native draft onto the
			// latest element, then reconciles the resulting full slide snapshot.
			for (const index of [first, second]) {
				peers.commit(index, drafts[index]);
				for (const doc of peers.docs) {
					expect.soft(textState(doc)).toStrictEqual({
						text: 'ALPHA Hello OMEGA',
						textBody: 'ALPHA Hello OMEGA',
					});
				}
			}
		} finally {
			peers.dispose();
		}
	});

	it('keeps scalar text aligned with textBody after concurrent updates merge', () => {
		const peers = createTextPeers(false);
		try {
			peers.publish(0, 'ALPHA Hello');
			peers.publish(1, 'Hello OMEGA');
			Y.applyUpdate(peers.docs[1], Y.encodeStateAsUpdate(peers.docs[0]));
			Y.applyUpdate(peers.docs[0], Y.encodeStateAsUpdate(peers.docs[1]));
			for (const doc of peers.docs) {
				const state = textState(doc);
				// The existing character merge assertion passes, but the plain-text
				// projection used to seed several inline editors must agree too.
				expect(state.textBody).toBe('ALPHA Hello OMEGA');
				expect.soft(state.text).toBe(state.textBody);
			}
		} finally {
			peers.dispose();
		}
	});

	it('finds the element without a slide id and ignores unknown ids', () => {
		const doc = seedDoc();
		expect(findElementYMap(asDoc(doc), undefined, 'e1')).toBeDefined();
		expect(findElementYMap(asDoc(doc), 's1', 'missing')).toBeUndefined();

		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		expect(() => {
			patcher.patchGeometry('nope', 'missing', { x: 1 });
			patcher.flush();
		}).not.toThrow();
	});

	it('configure(null) goes dormant and drops pending patches', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);
		patcher.patchGeometry('s1', 'e1', { x: 1 });
		patcher.patchGeometry('s1', 'e1', { x: 77 });

		patcher.configure(null, null);
		expect(patcher.isActive()).toBeFalsy();
		expect(vi.getTimerCount()).toBe(0);
		patcher.flush();
		expect(firstElement(doc).x).toBe(1);
	});
});

describe('publishLiveInlineText / publishLiveGeometry', () => {
	it('publishes the interim text of an element on the slide', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		publishLiveInlineText(patcher, makeSlide('s1', [makeElement('e1', 'Hello')]), 'e1', 'Hello!!');
		patcher.flush();
		expect(firstElement(doc).text).toBe('Hello!!');
	});

	it('no-ops for a missing patcher, slide, element or non-text element', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		const slide = makeSlide('s1', [makeElement('e1', 'Hello')]);
		const imageSlide = makeSlide('s1', [
			{ id: 'e1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as unknown as PptxElement,
		]);

		publishLiveInlineText(null, slide, 'e1', 'x');
		publishLiveInlineText(patcher, undefined, 'e1', 'x');
		publishLiveInlineText(patcher, slide, null, 'x');
		publishLiveInlineText(patcher, slide, 'nope', 'x');
		publishLiveInlineText(patcher, imageSlide, 'e1', 'x');
		publishLiveGeometry(patcher, 's1', null, { x: 5 });
		patcher.flush();

		expect(firstElement(doc).text).toBe('Hello');
		expect(firstElement(doc).x).toBe(10);
	});

	it('publishLiveGeometry forwards to the patcher', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		publishLiveGeometry(patcher, 's1', 'e1', { x: 42, rotation: 15 });
		patcher.flush();
		expect(firstElement(doc).x).toBe(42);
		expect(firstElement(doc).rotation).toBe(15);
	});
});
