import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type { DeltaOp } from './collaboration-text-codec';
import { decodeDelta, encodeSegmentsToDelta } from './collaboration-text-codec';
import type { YTextEditableLike } from './collaboration-text-merge';
import { isYTextEditable, mergeDeltaIntoYText } from './collaboration-text-merge';
import { createTextPositionTracker } from './collaboration-text-positions';
import { createCollaborationTextSession } from './collaboration-text-session';
import { createSnapshotTextPositions } from './collaboration-text-snapshot-positions';

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

describe('tracked collaboration text positions', () => {
	it('tracks observed characters without spanning an unseen inserted character', () => {
		const positions = createTextPositionTracker(2);
		const a = [positions.capture(0, 0), positions.capture(1, -1)];
		const b = [positions.capture(1, 0), positions.capture(2, -1)];
		positions.apply([{ retain: 1 }, { insert: 'X' }]);
		expect(a.map(positions.resolve)).toStrictEqual([0, 1]);
		expect(b.map(positions.resolve)).toStrictEqual([2, 3]);
	});

	it('does not revive a deleted identity when the same spelling is reinserted', () => {
		const positions = createTextPositionTracker(1);
		const old = [positions.capture(0, 0), positions.capture(1, -1)];
		positions.apply([{ delete: 1 }, { insert: 'a' }]);
		const replacement = [positions.capture(0, 0), positions.capture(1, -1)];
		expect(old.map(positions.resolve)).toStrictEqual([0, 0]);
		expect(replacement.map(positions.resolve)).toStrictEqual([0, 1]);
		positions.apply([{ insert: 'B' }]);
		expect(old.map(positions.resolve)).toStrictEqual([1, 0]);
		expect(replacement.map(positions.resolve)).toStrictEqual([1, 2]);
	});

	it('keeps character identities across separated removals', () => {
		const positions = createTextPositionTracker(6);
		const observed = Array.from({ length: 6 }, (_, index) => [
			positions.capture(index, 0),
			positions.capture(index + 1, -1),
		]);
		positions.apply([{ retain: 1 }, { delete: 1 }, { retain: 1 }, { delete: 2 }]);
		expect(observed.map((pair) => pair.map(positions.resolve))).toStrictEqual([
			[0, 1],
			[1, 1],
			[1, 2],
			[2, 2],
			[2, 2],
			[2, 3],
		]);
	});

	it('uses explicit start/end gap affinity for an emptied document', () => {
		const positions = createTextPositionTracker(2);
		const start = positions.capture(0, -1);
		const end = positions.capture(2, 0);
		const removed = [positions.capture(0, 0), positions.capture(1, -1)];
		positions.apply([{ delete: 2 }]);
		positions.apply([{ insert: 'new' }]);
		expect(positions.resolve(start)).toBe(0);
		expect(positions.resolve(end)).toBe(3);
		expect(removed.map(positions.resolve)).toStrictEqual([3, 0]);
	});

	it('resolves a long chain of deleted neighbours without recursive stack growth', () => {
		const positions = createTextPositionTracker(3_000);
		const first = positions.capture(0, 0);
		for (let index = 0; index < 3_000; index++) {
			positions.apply([{ delete: 1 }]);
		}
		expect(positions.resolve(first)).toBe(0);
		positions.apply([{ insert: 'new' }]);
		expect(positions.resolve(first)).toBe(3);
	});

	it.each([
		{ changes: [{ delete: 3 }] },
		{ changes: [{ retain: -1 }] },
		{ changes: [{ retain: 1, insert: 'x' }] },
	])('invalidates positions on an inconsistent identity change: %j', ({ changes }) => {
		const positions = createTextPositionTracker(2);
		const position = positions.capture(0, 0);
		expect(positions.apply(changes)).toBeFalsy();
		expect(positions.resolve(position)).toBeNull();
		expect(positions.apply([{ insert: 'later' }])).toBeFalsy();
	});

	it('invalidates only its own positions on disposal', () => {
		const positions = createTextPositionTracker(1);
		const position = positions.capture(0, 0);
		positions.dispose();
		expect(positions.resolve(position)).toBeNull();
		expect(() => positions.capture(0, 0)).toThrow(RangeError);
	});

	it.each([false, true])(
		'never spans replacement characters when insertion comes first: %s',
		(insertFirst) => {
			const positions = createTextPositionTracker(3);
			const removed = [positions.capture(1, 0), positions.capture(2, -1)];
			const replacement = [{ insert: 'XY' }, { delete: 1 }];
			positions.apply([{ retain: 1 }, ...(insertFirst ? replacement : replacement.reverse())]);
			const [start, end] = removed.map(positions.resolve) as number[];
			expect(end).toBeLessThanOrEqual(start);
			positions.apply([{ retain: 2 }, { insert: 'Z' }]);
			const [nextStart, nextEnd] = removed.map(positions.resolve) as number[];
			expect(nextEnd).toBeLessThanOrEqual(nextStart);
		},
	);

	it('keeps UTF-16 units distinct without reviving a replaced emoji', () => {
		const positions = createTextPositionTracker('a😀b'.length);
		const emoji = [positions.capture(1, 0), positions.capture(3, -1)];
		const b = [positions.capture(3, 0), positions.capture(4, -1)];
		positions.apply([{ retain: 1 }, { delete: 2 }, { insert: '😀' }]);
		expect(emoji.map(positions.resolve)).toStrictEqual([1, 1]);
		expect(b.map(positions.resolve)).toStrictEqual([3, 4]);
		positions.apply([{ retain: 1 }, { insert: '🚀' }]);
		expect(emoji.map(positions.resolve)).toStrictEqual([3, 1]);
		expect(b.map(positions.resolve)).toStrictEqual([5, 6]);
	});

	it('resolves dead neighbour chains in both directions after alternating end deletions', () => {
		const positions = createTextPositionTracker(2_000);
		const left = positions.capture(0, 0);
		const right = positions.capture(2_000, -1);
		for (let remaining = 2_000; remaining > 0; remaining--) {
			positions.apply(
				remaining % 2 === 0 ? [{ delete: 1 }] : [{ retain: remaining - 1 }, { delete: 1 }],
			);
		}
		expect(positions.resolve(left)).toBe(0);
		expect(positions.resolve(right)).toBe(0);
		positions.apply([{ insert: 'new' }]);
		expect(positions.resolve(left)).toBe(3);
		expect(positions.resolve(right)).toBe(0);
	});

	it('preserves live identities and never revives removed identities through mixed edits', () => {
		const positions = createTextPositionTracker(8);
		let nextId = 8;
		const ids = Array.from({ length: 8 }, (_, index) => index);
		const observed = new Map(
			ids.map((id, index) => [id, [positions.capture(index, 0), positions.capture(index + 1, -1)]]),
		);
		let seed = 71;
		const pick = (maximum: number) => {
			seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
			return seed % maximum;
		};
		for (let step = 0; step < 300; step++) {
			const at = pick(ids.length + 1);
			const deleted = pick(Math.min(3, ids.length - at) + 1);
			const inserted = ids.length > 24 ? 0 : pick(3);
			const edits = [{ delete: deleted }, { insert: 'X'.repeat(inserted) }];
			if (pick(2)) {
				edits.reverse();
			}
			expect(positions.apply([{ retain: at }, ...edits])).toBeTruthy();
			const addedIds: number[] = [];
			for (let index = 0; index < inserted; index++) {
				addedIds.push(nextId++);
			}
			ids.splice(at, deleted, ...addedIds);
			addedIds.forEach((id, index) => {
				observed.set(id, [positions.capture(at + index, 0), positions.capture(at + index + 1, -1)]);
			});
			for (const [id, pair] of observed) {
				const liveIndex = ids.indexOf(id);
				const [start, end] = pair.map(positions.resolve) as number[];
				if (liveIndex >= 0) {
					expect([start, end]).toStrictEqual([liveIndex, liveIndex + 1]);
				} else {
					expect(end).toBeLessThanOrEqual(start);
				}
			}
		}
	});
});

function relativeEditSession(doc: Y.Doc, text: Y.Text, canEdit = () => true) {
	const session = createCollaborationTextSession({
		text: asEditable(text),
		positions: {
			capture: (index, association) =>
				Y.createRelativePositionFromTypeIndex(text, index, association),
			resolve: (position) => {
				const absolute = Y.createAbsolutePositionFromRelativePosition(position, doc);
				return absolute?.type === text ? absolute.index : null;
			},
		},
		transact: (callback) => doc.transact(callback, 'local-text-session'),
		isCurrent: () => canEdit() && doc.getMap('m').get('t') === text,
	});
	if (!session) {
		throw new Error('Expected an editable text session');
	}
	return session;
}

/** Exercise the production snapshot bridge with the same public Yjs runtime. */
function trackedEditSession(doc: Y.Doc, text: Y.Text, canEdit = () => true) {
	const session = createCollaborationTextSession({
		text: asEditable(text),
		positions: createSnapshotTextPositions(text, {
			read: () => Y.snapshot(doc),
			equal: Y.equalSnapshots,
			subscribeBeforeObservers: (listener) => {
				doc.on('beforeObserverCalls', listener);
				return () => doc.off('beforeObserverCalls', listener);
			},
		}),
		transact: (callback) => doc.transact(callback, 'local-text-session'),
		isCurrent: () => canEdit() && doc.getMap('m').get('t') === text,
	});
	if (!session) {
		throw new Error('Expected an editable tracked text session');
	}
	return session;
}

describe('snapshot text position lifecycle', () => {
	it.each([
		{ event: 'beforeObserverCalls' as const, observerFirst: true, replacement: true },
		{ event: 'beforeObserverCalls' as const, observerFirst: false, replacement: true },
		{ event: 'beforeObserverCalls' as const, observerFirst: true, replacement: false },
		{ event: 'beforeObserverCalls' as const, observerFirst: false, replacement: false },
		{ event: 'beforeTransaction' as const, observerFirst: true, replacement: true },
		{ event: 'beforeTransaction' as const, observerFirst: false, replacement: true },
		{ event: 'beforeTransaction' as const, observerFirst: true, replacement: false },
		{ event: 'beforeTransaction' as const, observerFirst: false, replacement: false },
	])(
		'preserves identity across garbage collection and host callbacks: %j',
		({ event, observerFirst, replacement }) => {
			const doc = new Y.Doc({ gc: true });
			const text = makeYText(doc, 't', [{ insert: 'abc' }]);
			let changed = false;
			const hostObserver = (transaction: Y.Transaction) => {
				const origin = event === 'beforeTransaction' ? 'cleanup' : 'outer';
				if (changed || transaction.origin !== origin) {
					return;
				}
				changed = true;
				doc.transact(() => {
					if (replacement) {
						text.delete(1, 1);
						text.insert(1, 'b');
					} else {
						text.insert(0, 'R');
					}
				}, 'host-inner');
			};
			if (observerFirst) {
				doc.on(event, hostObserver);
			}
			const session = trackedEditSession(doc, text);
			if (!observerFirst) {
				doc.on(event, hostObserver);
			}
			try {
				doc.transact(() => text.insert(text.length, 'X'), 'outer');
				expect(changed).toBeTruthy();
				expect(session.applyLocalDelta([{ insert: 'ac' }])).toBeTruthy();
				expect(text.toString()).toBe(replacement ? 'abcX' : 'RacX');
			} finally {
				session.dispose();
				doc.off(event, hostObserver);
				doc.destroy();
			}
		},
	);

	it('retires unsupported remote embeds without removing host observers or destroying the document', () => {
		const doc = new Y.Doc();
		const text = makeYText(doc, 't', [{ insert: 'abc' }]);
		const hostObserver = vi.fn();
		const stopped = vi.fn();
		doc.on('beforeObserverCalls', hostObserver);
		const positions = createSnapshotTextPositions(text, {
			read: () => Y.snapshot(doc),
			equal: Y.equalSnapshots,
			subscribeBeforeObservers: (listener) => {
				doc.on('beforeObserverCalls', listener);
				return () => {
					stopped();
					doc.off('beforeObserverCalls', listener);
				};
			},
		});
		const position = positions.capture(1, 0);
		try {
			expect(() => text.insertEmbed(1, { image: 'unsupported' })).not.toThrow();
			expect(positions.refresh()).toBeFalsy();
			expect(positions.resolve(position)).toBeNull();
			expect(stopped).toHaveBeenCalledOnce();
			const priorHostCalls = hostObserver.mock.calls.length;
			doc.getMap('host').set('still-active', true);
			expect(hostObserver.mock.calls.length).toBeGreaterThan(priorHostCalls);
			expect(doc.isDestroyed).toBeFalsy();
			positions.dispose();
			expect(stopped).toHaveBeenCalledOnce();
		} finally {
			positions.dispose();
			doc.off('beforeObserverCalls', hostObserver);
			doc.destroy();
		}
	});

	it.each(['snapshot', 'delta'])(
		'contains a %s callback failure and releases its subscription',
		(fault) => {
			const doc = new Y.Doc();
			const text = makeYText(doc, 't', [{ insert: 'abc' }]);
			let shouldFail = false;
			const stopped = vi.fn();
			const positions = createSnapshotTextPositions(
				{
					toString: () => text.toString(),
					toDelta: (current: Y.Snapshot, previous: Y.Snapshot, mark) => {
						if (shouldFail && fault === 'delta') {
							throw new Error('Snapshot delta unavailable');
						}
						return text.toDelta(current, previous, mark);
					},
				},
				{
					read: () => {
						if (shouldFail && fault === 'snapshot') {
							throw new Error('Snapshot unavailable');
						}
						return Y.snapshot(doc);
					},
					equal: Y.equalSnapshots,
					subscribeBeforeObservers: (listener) => {
						doc.on('beforeObserverCalls', listener);
						return () => {
							stopped();
							doc.off('beforeObserverCalls', listener);
						};
					},
				},
			);
			try {
				shouldFail = true;
				expect(() => doc.getMap('host').set('revision', 1)).not.toThrow();
				expect(positions.refresh()).toBeFalsy();
				expect(stopped).toHaveBeenCalledOnce();
				shouldFail = false;
				expect(positions.refresh()).toBeFalsy();
				expect(text.toString()).toBe('abc');
				expect(doc.isDestroyed).toBeFalsy();
			} finally {
				positions.dispose();
				doc.destroy();
			}
		},
	);

	it('keeps observed text identities across unrelated host changes', () => {
		const doc = new Y.Doc();
		const text = makeYText(doc, 't', [{ insert: 'abc' }]);
		const session = trackedEditSession(doc, text);
		try {
			const painted = session.readMerged()!;
			doc.getMap('host').set('revision', 1);
			doc.getMap('host').set('revision', 2);
			expect(session.adoptMerged(painted)).toBeTruthy();
			expect(session.applyLocalDelta([{ insert: 'ac' }])).toBeTruthy();
			expect(text.toString()).toBe('ac');
			expect(doc.getMap('host').get('revision')).toBe(2);
		} finally {
			session.dispose();
			doc.destroy();
		}
	});
});

function makeConnectedEditors(
	editSession: typeof relativeEditSession,
	initial = segs({ text: 'Hello', style: {} }),
) {
	const first = new Y.Doc();
	const a = makeYText(first, 't', initial);
	const second = new Y.Doc();
	Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
	const b = second.getMap('m').get('t') as Y.Text;
	const fromFirst = (update: Uint8Array, origin: unknown) => {
		if (origin !== second) {
			Y.applyUpdate(second, update, first);
		}
	};
	const fromSecond = (update: Uint8Array, origin: unknown) => {
		if (origin !== first) {
			Y.applyUpdate(first, update, second);
		}
	};
	first.on('update', fromFirst);
	second.on('update', fromSecond);
	const sessions = [editSession(first, a), editSession(second, b)];
	return {
		first,
		second,
		a,
		b,
		sessions,
		dispose() {
			sessions.forEach((session) => session.dispose());
			first.off('update', fromFirst);
			second.off('update', fromSecond);
			first.destroy();
			second.destroy();
		},
	};
}

describe.each([
	{ name: 'relative positions', editSession: relativeEditSession },
	{ name: 'tracked snapshot positions', editSession: trackedEditSession },
])('active collaboration text session: $name', ({ editSession }) => {
	const connectedEditors = (initial?: DeltaOp[]) => makeConnectedEditors(editSession, initial);

	it.each([0, 1])(
		'normalizes multiple observed markers while preserving a connected peer insertion: %i',
		(first) => {
			const peers = connectedEditors([{ insert: '>ab|>cd' }]);
			const edits = [
				() =>
					peers.sessions[0].applyLocalDelta([{ insert: 'aXb|cd' }], {
						retainedIndices: [1, null, 2, 3, 5, 6],
					}),
				() => peers.sessions[1].applyLocalDelta([{ insert: '>aRb|>cd' }]),
			];
			try {
				expect(edits[first]()).toBeTruthy();
				expect(edits[1 - first]()).toBeTruthy();
				expect(peers.a.toString()).toBe(first === 0 ? 'aXRb|cd' : 'aRXb|cd');
				expect(peers.b.toString()).toBe(peers.a.toString());
				expect(
					peers.sessions[0].applyLocalDelta([{ insert: 'aXb|c!d' }], {
						retainedIndices: [0, 1, 2, 3, 4, null, 5],
					}),
				).toBeTruthy();
				expect(
					peers.sessions[0].applyLocalDelta([{ insert: 'ab|c!d' }], {
						retainedIndices: [0, 2, 3, 4, 5, 6],
					}),
				).toBeTruthy();
				expect(peers.a.toString()).toBe('aRb|c!d');
				expect(peers.b.toString()).toBe('aRb|c!d');
			} finally {
				peers.dispose();
			}
		},
	);

	it('merges retained run styles and metadata without formatting an unseen peer character', () => {
		const style = { fontSize: 20, color: '#111111' };
		const initial = [
			{ insert: '>', attributes: { bi: '{"char":"•"}' } },
			{ insert: 'ab', attributes: { s: JSON.stringify(style), ft: 'slidenum', fg: 'field-id' } },
			{ insert: '|', attributes: { pb: '1', pr: '{"@_lang":"en-US"}' } },
			{ insert: '>', attributes: { bi: '{"char":"•"}' } },
			{ insert: 'cd', attributes: { s: JSON.stringify(style) } },
		];
		const peers = connectedEditors(structuredClone(initial));
		try {
			peers.b.format(1, 2, { s: JSON.stringify({ ...style, italic: true }), host: 'kept' });
			peers.b.insert(2, 'R', { s: JSON.stringify({ color: '#008800' }) });
			const bold = JSON.stringify({ ...style, bold: true });
			expect(
				peers.sessions[0].applyLocalDelta(
					[
						{ insert: 'a', attributes: { s: bold, ft: 'slidenum', fg: 'field-id' } },
						{ insert: 'X', attributes: { s: bold } },
						{ insert: 'b', attributes: { s: bold, ft: 'slidenum', fg: 'field-id' } },
						initial[2],
						initial[4],
					],
					{ retainedIndices: [1, null, 2, 3, 5, 6] },
				),
			).toBeTruthy();
			const delta = peers.a.toDelta() as DeltaOp[];
			for (const letter of ['a', 'b']) {
				const attributes = delta.find((op) => op.insert === letter)?.attributes;
				expect(attributes).toMatchObject({ ft: 'slidenum', fg: 'field-id', host: 'kept' });
				expect(JSON.parse(attributes!.s as string)).toStrictEqual({
					...style,
					italic: true,
					bold: true,
				});
			}
			expect(delta.find((op) => op.insert === 'R')?.attributes).toStrictEqual({
				s: JSON.stringify({ color: '#008800' }),
			});
			expect(delta.find((op) => op.insert === '|')?.attributes).toStrictEqual(
				initial[2].attributes,
			);
			expect(peers.b.toDelta()).toStrictEqual(delta);
		} finally {
			peers.dispose();
		}
	});

	it.each([
		{ before: 'abc', after: 'abc', retainedIndices: [0, 1] },
		{ before: 'abc', after: 'abc', retainedIndices: [0, 1, 2, null] },
		{ before: 'abc', after: 'abc', retainedIndices: [-1, 1, 2] },
		{ before: 'aaa', after: 'aaa', retainedIndices: [0, 0, 2] },
		{ before: 'aaa', after: 'aaa', retainedIndices: [1, 0, 2] },
		{ before: 'abc', after: 'abc', retainedIndices: [0, 1, 3] },
		{ before: 'abc', after: 'abc', retainedIndices: [0, 1.5, 2] },
		{ before: 'abc', after: 'abc', retainedIndices: [0, NaN, 2] },
		{ before: 'abc', after: 'aXc', retainedIndices: [0, 1, 2] },
		{ before: 'a😀b', after: 'a\ud83db', retainedIndices: [0, 1, 3] },
		{ before: 'a😀b', after: 'aX\ude00b', retainedIndices: [0, null, 2, 3] },
		{ before: 'a😀b', after: 'a\ud83dX\ude00b', retainedIndices: [0, 1, null, 2, 3] },
		{ before: 'a😀b', after: 'a😀b', retainedIndices: [0, null, 2, 3] },
	])('rejects an invalid identity plan without changing acknowledgements: %j', (test) => {
		const peers = connectedEditors([{ insert: test.before }]);
		try {
			const painted = peers.sessions[0].readMerged()!;
			const state = Y.encodeStateAsUpdate(peers.first);
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: test.after }], {
					retainedIndices: test.retainedIndices,
				}),
			).toBeFalsy();
			expect(Y.encodeStateAsUpdate(peers.first)).toStrictEqual(state);
			expect(peers.sessions[0].adoptMerged(painted)).toBeTruthy();
		} finally {
			peers.dispose();
		}
	});

	it('keeps a newly inserted surrogate pair when the peer deletes the old pair', () => {
		const peers = connectedEditors([{ insert: 'a😀b' }]);
		try {
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'a🚀😀b' }], {
					retainedIndices: [0, null, null, 1, 2, 3],
				}),
			).toBeTruthy();
			expect(
				peers.sessions[1].applyLocalDelta([{ insert: 'ab' }], {
					retainedIndices: [0, 3],
				}),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('a🚀b');
			expect(peers.b.toString()).toBe('a🚀b');
		} finally {
			peers.dispose();
		}
	});

	it('preserves multiple new runs when their retained neighbours were remotely deleted', () => {
		const peers = connectedEditors([{ insert: 'abc' }]);
		try {
			peers.sessions[1].applyLocalDelta([{ insert: 'R' }]);
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'aXbYc' }], {
					retainedIndices: [0, null, 1, null, 2],
				}),
			).toBeTruthy();
			expect(peers.a.toString().replace('R', '')).toBe('XY');
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'abYc' }], {
					retainedIndices: [0, 2, 3, 4],
				}),
			).toBeTruthy();
			expect(peers.a.toString().replace('R', '')).toBe('Y');
			expect(peers.a.toString()).toContain('R');
			expect(peers.b.toString()).toBe(peers.a.toString());
		} finally {
			peers.dispose();
		}
	});

	it('distinguishes an identity-plan no-op from same-spelling replacement', () => {
		const peers = connectedEditors([{ insert: 'aaa' }]);
		try {
			const painted = peers.sessions[0].readMerged()!;
			const state = Y.encodeStateAsUpdate(peers.first);
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'aaa' }], {
					retainedIndices: [0, 1, 2],
				}),
			).toBeTruthy();
			expect(Y.encodeStateAsUpdate(peers.first)).toStrictEqual(state);
			expect(peers.sessions[0].adoptMerged(painted)).toBeTruthy();
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'aaa' }], {
					retainedIndices: [null, 1, 2],
				}),
			).toBeTruthy();
			expect(
				peers.sessions[1].applyLocalDelta([{ insert: 'aa' }], {
					retainedIndices: [1, 2],
				}),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('aaa');
		} finally {
			peers.dispose();
		}
	});

	it.each(['insert', 'permission', 'embed', 'mutate-plan'] as const)(
		'rechecks host transaction guards before applying an identity plan: %s',
		(mutation) => {
			const doc = new Y.Doc();
			const text = makeYText(doc, 't', [{ insert: 'abcd' }]);
			let canEdit = true;
			const session = editSession(doc, text, () => canEdit);
			const edit = { retainedIndices: [0, null, 2, null, 3] };
			let changed = false;
			let hostDelta: DeltaOp[] | undefined;
			const hostObserver = (transaction: Y.Transaction) => {
				if (changed || transaction.origin !== 'local-text-session') {
					return;
				}
				changed = true;
				if (mutation === 'insert') {
					text.insert(2, 'R');
				} else if (mutation === 'permission') {
					canEdit = false;
				} else if (mutation === 'embed') {
					text.insertEmbed(2, { image: 'unsupported' });
				} else {
					edit.retainedIndices[0] = 999;
				}
				hostDelta = text.toDelta();
			};
			doc.on('beforeTransaction', hostObserver);
			try {
				const succeeds = mutation === 'insert' || mutation === 'mutate-plan';
				expect(session.applyLocalDelta([{ insert: 'aXcYd' }], edit)).toBe(succeeds);
				expect(changed).toBeTruthy();
				if (succeeds) {
					expect(text.toString()).toBe(mutation === 'insert' ? 'aXRcYd' : 'aXcYd');
				} else {
					expect(text.toDelta()).toStrictEqual(hostDelta);
					canEdit = true;
					expect(
						session.applyLocalDelta([{ insert: 'stale' }], {
							retainedIndices: [null, null, null, null, null],
						}),
					).toBeFalsy();
				}
				session.dispose();
				expect(doc.isDestroyed).toBeFalsy();
			} finally {
				session.dispose();
				doc.off('beforeTransaction', hostObserver);
				doc.destroy();
			}
		},
	);

	it('relocates paragraph provenance without overwriting connected carrier formatting', () => {
		const bullet = { char: '•', color: '#111111', paragraphIndex: 2 };
		const carrier = {
			bi: JSON.stringify(bullet),
			pl: '1',
			pr: '{"lang":"en"}',
			pi: '{"fontSize":20}',
			pp: '{"spacing":{"before":3,"after":4}}',
			s: '{"fontFamily":"Symbol"}',
		};
		const body = { s: '{"fontFamily":"Arial","fontSize":20}' };
		const peers = connectedEditors([
			{ insert: '>', attributes: { ...carrier } },
			{ insert: 'ab', attributes: { ...body } },
			{ insert: '|', attributes: { pb: '1' } },
			{ insert: '>', attributes: { bi: JSON.stringify({ ...bullet, paragraphIndex: 3 }) } },
			{ insert: 'cd', attributes: { ...body } },
		]);
		try {
			peers.b.format(0, 1, {
				bi: JSON.stringify({ ...bullet, color: '#CC0000' }),
				pl: '3',
				pr: '{"lang":"fr","remote":true}',
				pi: '{"fontSize":30}',
				pp: '{"spacing":{"before":9,"after":4},"remote":true}',
			});
			peers.b.format(4, 1, {
				bi: JSON.stringify({ ...bullet, color: '#0000CC', paragraphIndex: 3 }),
			});
			const first = {
				...carrier,
				...body,
				bi: JSON.stringify({ ...bullet, paragraphIndex: 0 }),
				pp: '{"spacing":{"before":3,"after":8}}',
			};
			const second = { ...body, bi: JSON.stringify({ ...bullet, paragraphIndex: 1 }) };
			expect(
				peers.sessions[0].applyLocalDelta(
					[
						{ insert: 'aXb', attributes: first },
						{ insert: '|', attributes: { pb: '1' } },
						{ insert: 'cd', attributes: second },
					],
					{ retainedIndices: [1, null, 2, 3, 5, 6], paragraphSources: [0, 0, 0, null, 4, 4] },
				),
			).toBeTruthy();
			const runs = peers.a.toDelta() as DeltaOp[];
			const firstAttrs = runs.find((op) => op.insert === 'aXb')!.attributes!;
			expect(JSON.parse(firstAttrs.bi as string)).toStrictEqual({
				...bullet,
				color: '#CC0000',
				paragraphIndex: 0,
			});
			expect(firstAttrs.pl).toBe('3');
			expect(JSON.parse(firstAttrs.pr as string)).toStrictEqual({ lang: 'fr', remote: true });
			expect(JSON.parse(firstAttrs.pi as string)).toStrictEqual({ fontSize: 30 });
			expect(JSON.parse(firstAttrs.pp as string)).toStrictEqual({
				spacing: { before: 9, after: 8 },
				remote: true,
			});
			expect(firstAttrs.s).toBe(body.s);
			expect(
				JSON.parse(runs.find((op) => op.insert === 'cd')!.attributes!.bi as string),
			).toStrictEqual({
				...bullet,
				color: '#0000CC',
				paragraphIndex: 1,
			});
			// A later unpainted draft must keep comparing with local attributes, not merged ones.
			expect(
				peers.sessions[0].applyLocalDelta(
					[
						{ insert: 'aXbY', attributes: first },
						{ insert: '|', attributes: { pb: '1' } },
						{ insert: 'cd', attributes: second },
					],
					{ retainedIndices: [0, 1, 2, null, 3, 4, 5], paragraphSources: [0, 0, 0, 0, null, 4, 4] },
				),
			).toBeTruthy();
			expect(
				(peers.a.toDelta() as DeltaOp[]).find((op) => op.insert === 'aXbY')?.attributes,
			).toStrictEqual(firstAttrs);
			expect(peers.b.toDelta()).toStrictEqual(peers.a.toDelta());
		} finally {
			peers.dispose();
		}
	});

	it('does not copy paragraph attributes from a remotely replaced carrier identity', () => {
		const attributes = { bi: '{"char":"•","color":"#111111"}' };
		const peers = connectedEditors([
			{ insert: '>', attributes: { ...attributes } },
			{ insert: 'a' },
		]);
		try {
			peers.second.transact(() => {
				peers.b.delete(0, 1);
				peers.b.insert(0, '>', { bi: '{"char":"•","color":"#0000CC"}' });
			});
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'Xa', attributes }], {
					retainedIndices: [null, 1],
					paragraphSources: [0, 0],
				}),
			).toBeTruthy();
			const runs = peers.a.toDelta() as DeltaOp[];
			const local = runs.filter((op) => op.insert !== '>');
			for (const run of local) {
				expect(run.attributes?.bi).toBeUndefined();
			}
			expect(runs.find((op) => op.insert === '>')?.attributes?.bi).toBe(
				'{"char":"•","color":"#0000CC"}',
			);
			expect(local.map((op) => op.insert).join('')).toBe('Xa');
		} finally {
			peers.dispose();
		}
	});

	it('retains paragraph metadata when a peer deletes only the first carrier character', () => {
		const attributes = { bi: '{"char":"•"}', pp: '{"paragraphSpacingAfter":18}' };
		const peers = connectedEditors([{ insert: 'Body', attributes: { ...attributes } }]);
		try {
			peers.b.delete(0, 1);
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'BodyX', attributes }], {
					retainedIndices: [0, 1, 2, 3, null],
					paragraphSources: [0, 0, 0, 0, 0],
				}),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('odyX');
			expect(peers.a.toDelta()).toStrictEqual([{ insert: 'odyX', attributes }]);
			expect(peers.b.toDelta()).toStrictEqual(peers.a.toDelta());
		} finally {
			peers.dispose();
		}
	});

	it('retains paragraph metadata after a peer relocates the same dedicated marker', () => {
		const attributes = { bi: '{"char":"•"}', pp: '{"paragraphSpacingAfter":18}' };
		const peers = connectedEditors([
			{ insert: '>', attributes: { ...attributes } },
			{ insert: 'ab' },
		]);
		const correspondence = { retainedIndices: [1, null, 2], paragraphSources: [0, 0, 0] };
		try {
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'aXb', attributes }], correspondence),
			).toBeTruthy();
			expect(
				peers.sessions[1].applyLocalDelta([{ insert: 'aYb', attributes }], correspondence),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('aXYb');
			expect(peers.a.toDelta()).toStrictEqual([{ insert: 'aXYb', attributes }]);
			expect(peers.b.toDelta()).toStrictEqual(peers.a.toDelta());
		} finally {
			peers.dispose();
		}
	});

	it('uses current surviving paragraph metadata, including explicit remote removal', () => {
		const attributes = { bi: '{"char":"•"}', pp: '{"paragraphSpacingAfter":18}' };
		const peers = connectedEditors([{ insert: 'Body', attributes: { ...attributes } }]);
		try {
			peers.second.transact(() => {
				peers.b.delete(0, 1);
				peers.b.format(0, 3, { bi: null, pp: '{"paragraphSpacingAfter":36}' });
			});
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'BodyX', attributes }], {
					retainedIndices: [0, 1, 2, 3, null],
					paragraphSources: [0, 0, 0, 0, 0],
				}),
			).toBeTruthy();
			expect(peers.a.toDelta()).toStrictEqual([
				{ insert: 'odyX', attributes: { pp: '{"paragraphSpacingAfter":36}' } },
			]);
		} finally {
			peers.dispose();
		}
	});

	it('does not borrow metadata from a following paragraph after all source identities disappear', () => {
		const attributes = { bi: '{"char":"•"}' };
		const next = { bi: '{"char":"◆"}' };
		const peers = connectedEditors([
			{ insert: 'a', attributes: { ...attributes } },
			{ insert: '|', attributes: { pb: '1' } },
			{ insert: 'b', attributes: { ...next } },
		]);
		try {
			peers.b.delete(0, 1);
			expect(
				peers.sessions[0].applyLocalDelta(
					[
						{ insert: 'aX', attributes },
						{ insert: '|', attributes: { pb: '1' } },
						{ insert: 'b', attributes: next },
					],
					{
						retainedIndices: [0, null, 1, 2],
						paragraphSources: [0, 0, null, 2],
					},
				),
			).toBeTruthy();
			expect(peers.a.toDelta()).toStrictEqual([
				{ insert: 'X' },
				{ insert: '|', attributes: { pb: '1' } },
				{ insert: 'b', attributes: next },
			]);
		} finally {
			peers.dispose();
		}
	});

	it('reads paragraph provenance after a host transaction-start update and before deletion', () => {
		const doc = new Y.Doc();
		const original = { char: '•', color: '#111111', paragraphIndex: 2 };
		const text = makeYText(doc, 't', [
			{ insert: '>', attributes: { bi: JSON.stringify(original) } },
			{ insert: 'a' },
		]);
		const session = editSession(doc, text);
		const edit = { retainedIndices: [1, null], paragraphSources: [0, 0] };
		const hostObserver = (transaction: Y.Transaction) => {
			if (transaction.origin === 'local-text-session') {
				text.format(0, 1, { bi: JSON.stringify({ ...original, color: '#008800' }) });
				edit.paragraphSources[0] = 999;
			}
		};
		doc.on('beforeTransaction', hostObserver);
		try {
			expect(
				session.applyLocalDelta(
					[
						{
							insert: 'aX',
							attributes: {
								bi: JSON.stringify({ ...original, paragraphIndex: 0 }),
							},
						},
					],
					edit,
				),
			).toBeTruthy();
			expect(JSON.parse(text.toDelta()[0].attributes.bi)).toStrictEqual({
				...original,
				color: '#008800',
				paragraphIndex: 0,
			});
		} finally {
			session.dispose();
			doc.off('beforeTransaction', hostObserver);
			doc.destroy();
		}
	});

	it.each([[0], [0, 1, 2, null], [-1, 1, 2], [0, 1, 3], [0, 0.5, 2], [0, NaN, 2]])(
		'rejects invalid paragraph provenance before changing text: %j',
		(...paragraphSources) => {
			const peers = connectedEditors([{ insert: 'abc' }]);
			try {
				const state = Y.encodeStateAsUpdate(peers.first);
				const painted = peers.sessions[0].readMerged()!;
				expect(
					peers.sessions[0].applyLocalDelta([{ insert: 'aXc' }], {
						retainedIndices: [0, null, 2],
						paragraphSources,
					}),
				).toBeFalsy();
				expect(Y.encodeStateAsUpdate(peers.first)).toStrictEqual(state);
				expect(peers.sessions[0].adoptMerged(painted)).toBeTruthy();
			} finally {
				peers.dispose();
			}
		},
	);

	it.each([
		{ from: 0, to: 1, expected: 'Xaa' },
		{ from: 2, to: 3, expected: 'aXa' },
	])('deletes the explicitly selected repeated character: %j', ({ from, to, expected }) => {
		const peers = connectedEditors([{ insert: 'aaa' }]);
		try {
			peers.sessions[0].applyLocalDelta([{ insert: 'aXaa' }]);
			expect(peers.sessions[1].applyLocalDelta([{ insert: 'aa' }], { from, to })).toBeTruthy();
			expect(peers.a.toString()).toBe(expected);
			expect(peers.b.toString()).toBe(expected);
		} finally {
			peers.dispose();
		}
	});

	it('preserves same-spelling replacement identity against a stale peer deletion', () => {
		const peers = connectedEditors([{ insert: 'aaa' }]);
		try {
			expect(
				peers.sessions[0].applyLocalDelta([{ insert: 'aaa' }], { from: 0, to: 1 }),
			).toBeTruthy();
			expect(
				peers.sessions[1].applyLocalDelta([{ insert: 'aa' }], { from: 0, to: 1 }),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('aaa');
			expect(peers.b.toString()).toBe('aaa');
		} finally {
			peers.dispose();
		}
	});

	it('replaces the selected repeated range without deleting an unseen insertion inside it', () => {
		const peers = connectedEditors([{ insert: 'aaaa' }]);
		try {
			peers.sessions[0].applyLocalDelta([{ insert: 'aaXaa' }]);
			expect(
				peers.sessions[1].applyLocalDelta([{ insert: 'aaa' }], { from: 1, to: 3 }),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('aaXa');
			expect(peers.b.toString()).toBe('aaXa');
		} finally {
			peers.dispose();
		}
	});

	it.each([
		{ before: 'abc', after: 'bc', range: { from: -1, to: 1 } },
		{ before: 'abc', after: 'bc', range: { from: 0.5, to: 1 } },
		{ before: 'abc', after: 'bc', range: { from: 2, to: 1 } },
		{ before: 'abc', after: 'bc', range: { from: 0, to: 4 } },
		{ before: 'abc', after: 'bc', range: { from: NaN, to: 1 } },
		{ before: 'abc', after: 'bc', range: { from: 0, to: Infinity } },
		{ before: 'abc', after: 'XYc', range: { from: 1, to: 2 } },
		{ before: 'abc', after: 'aXY', range: { from: 1, to: 2 } },
		{ before: 'a😀b', after: 'aXb', range: { from: 1, to: 2 } },
		{ before: 'a😀b', after: 'aXb', range: { from: 2, to: 3 } },
	])(
		'rejects an inconsistent explicit edit without mutating anything: %j',
		({ before, after, range }) => {
			const peers = connectedEditors([{ insert: before }]);
			try {
				const snapshot = peers.sessions[0].readMerged()!;
				const state = Y.encodeStateAsUpdate(peers.first);
				expect(peers.sessions[0].applyLocalDelta([{ insert: after }], range)).toBeFalsy();
				expect(Y.encodeStateAsUpdate(peers.first)).toStrictEqual(state);
				expect(peers.sessions[0].adoptMerged(snapshot)).toBeTruthy();
				expect(peers.sessions[0].applyLocalDelta([{ insert: `${before}!` }])).toBeTruthy();
				expect(peers.a.toString()).toBe(`${before}!`);
			} finally {
				peers.dispose();
			}
		},
	);

	it('refreshes host edits made at the start of the write transaction before resolving ranges', () => {
		const doc = new Y.Doc();
		const text = makeYText(doc, 't', [{ insert: 'abc' }]);
		const session = editSession(doc, text);
		let inserted = false;
		const hostObserver = (transaction: Y.Transaction) => {
			if (!inserted && transaction.origin === 'local-text-session') {
				inserted = true;
				text.insert(0, 'R');
			}
		};
		doc.on('beforeTransaction', hostObserver);
		try {
			expect(session.applyLocalDelta([{ insert: 'bc' }], { from: 0, to: 1 })).toBeTruthy();
			expect(text.toString()).toBe('Rbc');
		} finally {
			session.dispose();
			doc.off('beforeTransaction', hostObserver);
			doc.destroy();
		}
	});

	it('does not publish after a host revokes permission at the start of the write transaction', () => {
		const doc = new Y.Doc();
		const text = makeYText(doc, 't', [{ insert: 'abc' }]);
		let canEdit = true;
		const session = editSession(doc, text, () => canEdit);
		const hostObserver = (transaction: Y.Transaction) => {
			if (transaction.origin === 'local-text-session') {
				canEdit = false;
			}
		};
		doc.on('beforeTransaction', hostObserver);
		try {
			expect(session.applyLocalDelta([{ insert: 'abc!' }])).toBeFalsy();
			expect(text.toString()).toBe('abc');
			canEdit = true;
			expect(session.applyLocalDelta([{ insert: 'stale' }])).toBeFalsy();
			expect(text.toString()).toBe('abc');
		} finally {
			session.dispose();
			doc.off('beforeTransaction', hostObserver);
			doc.destroy();
		}
	});

	it.each(['attribute', 'embed'] as const)(
		'retires before writing when a host introduces an unsupported %s at transaction start',
		(mutation) => {
			const doc = new Y.Doc();
			const text = makeYText(doc, 't', [{ insert: 'abc' }]);
			const session = editSession(doc, text);
			const painted = session.readMerged()!;
			let changed = false;
			let hostDelta: DeltaOp[] | undefined;
			const hostObserver = (transaction: Y.Transaction) => {
				if (changed || transaction.origin !== 'local-text-session') {
					return;
				}
				changed = true;
				if (mutation === 'attribute') {
					text.format(0, 1, { bold: true });
				} else {
					text.insertEmbed(1, { image: 'unsupported' });
				}
				hostDelta = text.toDelta();
			};
			doc.on('beforeTransaction', hostObserver);
			try {
				expect(session.applyLocalDelta([{ insert: 'ac!' }])).toBeFalsy();
				expect(changed).toBeTruthy();
				expect(text.toDelta()).toStrictEqual(hostDelta);
				expect(session.adoptMerged(painted)).toBeFalsy();
				expect(session.readMerged()).toBeUndefined();
				if (mutation === 'attribute') {
					text.format(0, 1, { bold: null });
				} else {
					text.delete(1, 1);
				}
				expect(session.applyLocalDelta([{ insert: 'stale after recovery' }])).toBeFalsy();
				expect(text.toString()).toBe('abc');
				expect(doc.isDestroyed).toBeFalsy();
			} finally {
				session.dispose();
				doc.off('beforeTransaction', hostObserver);
				doc.destroy();
			}
		},
	);

	it.each([false, true])(
		'preserves reentrant host edits when the observer was registered first: %s',
		(observerFirst) => {
			const doc = new Y.Doc();
			const text = makeYText(doc, 't', [{ insert: 'abc' }]);
			let inserted = false;
			const hostObserver = () => {
				if (!inserted) {
					inserted = true;
					text.insert(0, 'R');
				}
			};
			if (observerFirst) {
				text.observe(hostObserver);
			}
			const session = editSession(doc, text);
			if (!observerFirst) {
				text.observe(hostObserver);
			}
			try {
				expect(session.applyLocalDelta([{ insert: 'abc!' }])).toBeTruthy();
				expect(text.toString()).toBe('Rabc!');
				expect(session.applyLocalDelta([{ insert: 'abc!?' }])).toBeTruthy();
				expect(text.toString()).toBe('Rabc!?');
				expect(session.applyLocalDelta([{ insert: 'abc?' }])).toBeTruthy();
				expect(text.toString()).toBe('Rabc?');
			} finally {
				session.dispose();
				text.unobserve(hostObserver);
				doc.destroy();
			}
		},
	);

	it('keeps the remote replacement after the entire baseline is deleted and typed into again', () => {
		const peers = connectedEditors([{ insert: 'abc' }]);
		try {
			peers.sessions[0].applyLocalDelta([{ insert: 'R' }]);
			peers.sessions[1].applyLocalDelta([{ insert: 'abc!' }]);
			expect(peers.a.toString()).toContain('R');
			expect(peers.a.toString()).toContain('!');
			expect(peers.a).toHaveLength(2);
			peers.sessions[1].applyLocalDelta([{ insert: 'abc' }]);
			expect(peers.a.toString()).toBe('R');
			peers.sessions[1].applyLocalDelta([{ insert: 'abc?' }]);
			expect(peers.a.toString()).toContain('R');
			expect(peers.a.toString()).toContain('?');
			expect(peers.a).toHaveLength(2);
			expect(peers.b.toString()).toBe(peers.a.toString());
		} finally {
			peers.dispose();
		}
	});

	it.each([0, 1])('combines overlapping observed deletions with peer %i writing first', (first) => {
		const peers = connectedEditors(segs({ text: 'abcdef', style: {} }));
		const drafts = ['abef', 'af'];
		try {
			expect(
				peers.sessions[first].applyLocalDelta(segs({ text: drafts[first], style: {} })),
			).toBeTruthy();
			expect(
				peers.sessions[1 - first].applyLocalDelta(segs({ text: drafts[1 - first], style: {} })),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('af');
			expect(peers.b.toString()).toBe('af');
		} finally {
			peers.dispose();
		}
	});

	it('keeps remote deletions through two successive nonadjacent local deletes', () => {
		const peers = connectedEditors(segs({ text: 'abcdef', style: {} }));
		try {
			peers.sessions[1].applyLocalDelta([{ insert: 'acdef' }]);
			peers.sessions[0].applyLocalDelta([{ insert: 'abef' }]);
			peers.sessions[1].applyLocalDelta([{ insert: 'acf' }]);
			expect(peers.a.toString()).toBe('af');
			expect(peers.b.toString()).toBe('af');
		} finally {
			peers.dispose();
		}
	});

	it.each([0, 1])(
		'retains replacement text inside another stale deletion with peer %i writing first',
		(first) => {
			const peers = connectedEditors(segs({ text: 'abcdef', style: {} }));
			const drafts = ['abXYef', 'af'];
			try {
				peers.sessions[first].applyLocalDelta(segs({ text: drafts[first], style: {} }));
				peers.sessions[1 - first].applyLocalDelta(segs({ text: drafts[1 - first], style: {} }));
				expect(peers.a.toString()).toBe('aXYf');
				expect(peers.b.toString()).toBe('aXYf');
			} finally {
				peers.dispose();
			}
		},
	);

	it.each([0, 1])(
		'supports initially empty editors and subsequent local-only deletion with peer %i first',
		(first) => {
			const peers = connectedEditors([]);
			try {
				peers.sessions[first].applyLocalDelta([{ insert: 'A' }]);
				peers.sessions[1 - first].applyLocalDelta([{ insert: 'B' }]);
				expect(peers.a.toString()).toBe('AB');
				peers.sessions[first].applyLocalDelta([]);
				expect(peers.a.toString()).toBe('B');
				peers.sessions[first].applyLocalDelta([{ insert: 'C' }]);
				expect(peers.a.toString()).toContain('C');
				expect(peers.a.toString()).toContain('B');
				expect(peers.a).toHaveLength(2);
				expect(peers.b.toString()).toBe(peers.a.toString());
			} finally {
				peers.dispose();
			}
		},
	);

	it('can insert after the remote peer deletes the entire observed baseline', () => {
		const peers = connectedEditors(segs({ text: 'abc', style: {} }));
		try {
			peers.sessions[0].applyLocalDelta([]);
			peers.sessions[1].applyLocalDelta([{ insert: 'abc!' }]);
			expect(peers.a.toString()).toBe('!');
			expect(peers.b.toString()).toBe('!');
			peers.sessions[1].applyLocalDelta([{ insert: 'abc!?' }]);
			expect(peers.a.toString()).toBe('!?');
		} finally {
			peers.dispose();
		}
	});

	it('rejects a stale acknowledgement after another exact snapshot was adopted', () => {
		const peers = connectedEditors();
		try {
			const firstSnapshot = peers.sessions[0].readMerged()!;
			peers.sessions[1].applyLocalDelta([{ insert: 'Hello!' }]);
			const secondSnapshot = peers.sessions[0].readMerged()!;
			expect(peers.sessions[0].adoptMerged(secondSnapshot)).toBeTruthy();
			expect(peers.sessions[0].adoptMerged(firstSnapshot)).toBeFalsy();
			peers.sessions[0].applyLocalDelta([{ insert: 'Hello!?' }]);
			expect(peers.a.toString()).toBe('Hello!?');
		} finally {
			peers.dispose();
		}
	});

	it('does not change text or acknowledge a draft after editing permission is revoked', () => {
		const doc = new Y.Doc();
		const text = makeYText(doc, 't', [{ insert: 'Hello' }]);
		let canEdit = true;
		const session = editSession(doc, text, () => canEdit);
		try {
			const snapshot = session.readMerged()!;
			canEdit = false;
			expect(session.applyLocalDelta([{ insert: 'stale' }])).toBeFalsy();
			expect(session.adoptMerged(snapshot)).toBeFalsy();
			expect(session.readMerged()).toBeUndefined();
			expect(text.toString()).toBe('Hello');
			canEdit = true;
			expect(session.applyLocalDelta([{ insert: 'stale after regrant' }])).toBeFalsy();
			expect(session.adoptMerged(snapshot)).toBeFalsy();
			expect(text.toString()).toBe('Hello');
		} finally {
			session.dispose();
			doc.destroy();
		}
	});

	it.each([
		{ delta: [{ insert: { image: 'unsupported' } }] },
		{ delta: [{ attributes: { s: '{}' } }] },
		{ delta: [{ insert: 'Hello', attributes: { bold: true } }] },
		{ delta: [{ insert: 'Hello', attributes: { s: null } }] },
	])('rejects unsupported deltas without changing the baseline or document: %j', ({ delta }) => {
		const peers = connectedEditors();
		try {
			const before = Y.encodeStateVector(peers.first);
			expect(peers.sessions[0].applyLocalDelta(delta)).toBeFalsy();
			expect(Y.encodeStateVector(peers.first)).toStrictEqual(before);
			expect(peers.sessions[0].applyLocalDelta([{ insert: 'Hello!' }])).toBeTruthy();
			expect(peers.a.toString()).toBe('Hello!');
		} finally {
			peers.dispose();
		}
	});

	it.each([false, true])(
		'retires unsupported remote attributes with prior read %s',
		(readFirst) => {
			const peers = connectedEditors();
			try {
				peers.b.format(0, 1, { bold: true });
				if (readFirst) {
					expect(peers.sessions[0].readMerged()).toBeUndefined();
				}
				const before = peers.a.toDelta();
				expect(peers.sessions[0].applyLocalDelta([{ insert: 'Hello!' }])).toBeFalsy();
				expect(peers.a.toDelta()).toStrictEqual(before);
				peers.b.format(0, 1, { bold: null });
				expect(peers.sessions[0].applyLocalDelta([{ insert: 'stale after recovery' }])).toBeFalsy();
			} finally {
				peers.dispose();
			}
		},
	);

	it('rejects duplicate and reconstructed snapshot acknowledgements', () => {
		const peers = connectedEditors();
		try {
			const snapshot = peers.sessions[0].readMerged()!;
			expect(peers.sessions[0].adoptMerged({ delta: snapshot.delta })).toBeFalsy();
			expect(peers.sessions[0].adoptMerged(snapshot)).toBeTruthy();
			expect(peers.sessions[0].adoptMerged(snapshot)).toBeFalsy();
			expect(peers.a.toString()).toBe('Hello');
		} finally {
			peers.dispose();
		}
	});

	it('keeps a pending remote snapshot valid across an unchanged local draft notification', () => {
		const peers = connectedEditors();
		try {
			peers.sessions[1].applyLocalDelta([{ insert: 'remote Hello' }]);
			const painted = peers.sessions[0].readMerged()!;
			expect(peers.sessions[0].applyLocalDelta([{ insert: 'Hello' }])).toBeTruthy();
			expect(peers.sessions[0].adoptMerged(painted)).toBeTruthy();
			peers.sessions[0].applyLocalDelta([{ insert: 'remote Hello!' }]);
			expect(peers.a.toString()).toBe('remote Hello!');
		} finally {
			peers.dispose();
		}
	});

	it('preserves independent remote style properties when the local draft toggles bold', () => {
		const peers = connectedEditors(
			segs({ text: 'Hello', style: { bold: false, color: '#000000' } }),
		);
		try {
			peers.sessions[0].applyLocalDelta(
				segs({ text: 'Hello', style: { bold: false, italic: true, color: '#ff0000' } }),
			);
			peers.sessions[1].applyLocalDelta(
				segs({ text: 'Hello', style: { bold: true, color: '#000000' } }),
			);
			expect(decodeDelta(peers.a.toDelta())).toStrictEqual([
				{ text: 'Hello', style: { bold: true, italic: true, color: '#ff0000' } },
			]);
			expect(peers.b.toDelta()).toStrictEqual(peers.a.toDelta());
		} finally {
			peers.dispose();
		}
	});

	it('formats a contiguous retained run without a separate Y.Text operation per character', () => {
		const doc = new Y.Doc();
		const body = 'a'.repeat(1000);
		const text = makeYText(doc, 't', [{ insert: body }]);
		const session = editSession(doc, text);
		const format = vi.spyOn(text, 'format');
		try {
			expect(session.applyLocalDelta(segs({ text: body, style: { bold: true } }))).toBeTruthy();
			expect(format).toHaveBeenCalledExactlyOnceWith(0, 1000, {
				s: JSON.stringify({ bold: true }),
			});
			expect(decodeDelta(text.toDelta())).toStrictEqual([{ text: body, style: { bold: true } }]);
		} finally {
			format.mockRestore();
			session.dispose();
			doc.destroy();
		}
	});

	it('does not format unseen peer characters when batching adjacent retained ranges', () => {
		const peers = connectedEditors(segs({ text: 'abcd', style: {} }));
		try {
			peers.sessions[1].applyLocalDelta(
				segs(
					{ text: 'ab', style: {} },
					{ text: 'X', style: { italic: true } },
					{ text: 'cd', style: {} },
				),
			);
			peers.sessions[0].applyLocalDelta(segs({ text: 'abcd', style: { bold: true } }));
			expect(decodeDelta(peers.a.toDelta())).toStrictEqual([
				{ text: 'ab', style: { bold: true } },
				{ text: 'X', style: { italic: true } },
				{ text: 'cd', style: { bold: true } },
			]);
			expect(peers.b.toDelta()).toStrictEqual(peers.a.toDelta());
		} finally {
			peers.dispose();
		}
	});

	it('keeps surrogate pairs intact during a format-only change', () => {
		const peers = connectedEditors(segs({ text: 'a😀b', style: {} }));
		try {
			peers.sessions[0].applyLocalDelta(segs({ text: 'a😀b', style: { bold: true } }));
			expect(peers.a.toString()).toBe('a😀b');
			expect(decodeDelta(peers.a.toDelta())).toStrictEqual([
				{ text: 'a😀b', style: { bold: true } },
			]);
			expect(peers.b.toString()).toBe('a😀b');
		} finally {
			peers.dispose();
		}
	});

	it('retains both connected drafts and subsequent edits against the same observed baseline', () => {
		const peers = connectedEditors();
		try {
			expect(
				peers.sessions[0].applyLocalDelta(segs({ text: 'ALPHA Hello', style: {} })),
			).toBeTruthy();
			expect(peers.b.toString()).toBe('ALPHA Hello');
			expect(
				peers.sessions[1].applyLocalDelta(segs({ text: 'Hello OMEGA', style: {} })),
			).toBeTruthy();
			expect(peers.a.toString()).toBe('ALPHA Hello OMEGA');
			peers.sessions[0].applyLocalDelta(segs({ text: 'ALPHA Hello!', style: {} }));
			peers.sessions[1].applyLocalDelta(segs({ text: 'Hello OMEGA!', style: {} }));
			expect(peers.a.toString()).toBe('ALPHA Hello! OMEGA!');
			expect(peers.b.toString()).toBe(peers.a.toString());
		} finally {
			peers.dispose();
		}
	});

	it('deletes only observed characters, retaining a peer insertion between them', () => {
		const peers = connectedEditors(segs({ text: 'abcd', style: {} }));
		try {
			peers.sessions[1].applyLocalDelta(segs({ text: 'abXcd', style: {} }));
			peers.sessions[0].applyLocalDelta(segs({ text: 'ad', style: {} }));
			expect(peers.a.toString()).toBe('aXd');
			expect(peers.b.toString()).toBe('aXd');
		} finally {
			peers.dispose();
		}
	});

	it('does not delete a remote replacement for an already deleted character', () => {
		const peers = connectedEditors(segs({ text: 'abc', style: {} }));
		try {
			peers.sessions[1].applyLocalDelta(segs({ text: 'aXc', style: {} }));
			peers.sessions[0].applyLocalDelta(segs({ text: 'ac', style: {} }));
			expect(peers.a.toString()).toBe('aXc');
			expect(peers.b.toString()).toBe('aXc');
		} finally {
			peers.dispose();
		}
	});

	it('acknowledges the exact painted snapshot when a newer remote edit has already arrived', () => {
		const peers = connectedEditors();
		try {
			peers.sessions[0].applyLocalDelta(segs({ text: 'ALPHA Hello', style: {} }));
			const painted = peers.sessions[1].readMerged()!;
			peers.sessions[0].applyLocalDelta(segs({ text: 'ALPHA Hello OMEGA', style: {} }));
			expect(peers.sessions[1].adoptMerged(painted)).toBeTruthy();
			peers.sessions[1].applyLocalDelta(segs({ text: 'ALPHA Hello!', style: {} }));
			expect(peers.a.toString()).toBe('ALPHA Hello! OMEGA');
		} finally {
			peers.dispose();
		}
	});

	it('rejects stale or foreign acknowledgements after local input', () => {
		const peers = connectedEditors();
		try {
			const beforeInput = peers.sessions[0].readMerged()!;
			const foreign = peers.sessions[1].readMerged()!;
			peers.sessions[0].applyLocalDelta(segs({ text: 'Hello!', style: {} }));
			expect(peers.sessions[0].adoptMerged(beforeInput)).toBeFalsy();
			expect(peers.sessions[0].adoptMerged(foreign)).toBeFalsy();
		} finally {
			peers.dispose();
		}
	});

	it('preserves untouched remote formatting while inserting explicitly unstyled text', () => {
		const peers = connectedEditors();
		try {
			peers.sessions[0].applyLocalDelta(segs({ text: 'Hello', style: { bold: true } }));
			expect(decodeDelta(peers.b.toDelta())).toStrictEqual([
				{ text: 'Hello', style: { bold: true } },
			]);
			peers.sessions[1].applyLocalDelta(segs({ text: 'Hello!', style: {} }));
			expect(decodeDelta(peers.a.toDelta())).toStrictEqual([
				{ text: 'Hello', style: { bold: true } },
				{ text: '!', style: {} },
			]);
		} finally {
			peers.dispose();
		}
	});

	it('retains encoded empty carriers, literal newlines and repeated paragraph breaks', () => {
		const seed = segs(
			{ text: '', style: { italic: true } },
			{ text: 'A\nB', style: {} },
			{ text: '', isParagraphBreak: true, style: {} },
			{ text: '', isParagraphBreak: true, style: {} },
		);
		const peers = connectedEditors(seed);
		try {
			const desired = [...seed, { insert: 'tail' }];
			peers.sessions[0].applyLocalDelta(desired);
			expect(peers.a.toDelta()).toStrictEqual(desired);
			expect(peers.b.toDelta()).toStrictEqual(desired);
		} finally {
			peers.dispose();
		}
	});

	it('does not split surrogate pairs when a peer edits an adjacent range', () => {
		const peers = connectedEditors(segs({ text: 'a😀b', style: {} }));
		try {
			peers.sessions[1].applyLocalDelta(segs({ text: 'prefix a😀b', style: {} }));
			peers.sessions[0].applyLocalDelta(segs({ text: 'a😁b', style: {} }));
			expect(peers.a.toString()).toBe('prefix a😁b');
			expect(peers.b.toString()).toBe('prefix a😁b');
		} finally {
			peers.dispose();
		}
	});

	it('does not mutate the document on begin, read, acknowledgement or unchanged input', () => {
		const peers = connectedEditors();
		let updates = 0;
		peers.first.on('update', () => {
			updates++;
		});
		try {
			const snapshot = peers.sessions[0].readMerged()!;
			expect(peers.sessions[0].adoptMerged(snapshot)).toBeTruthy();
			expect(peers.sessions[0].applyLocalDelta(snapshot.delta)).toBeTruthy();
			expect(updates).toBe(0);
		} finally {
			peers.dispose();
		}
	});

	it('invalidates replaced text and disposed sessions without destroying the host doc', () => {
		const peers = connectedEditors();
		try {
			const pending = peers.sessions[0].readMerged()!;
			peers.first.getMap('m').set('t', new Y.Text('replacement'));
			expect(peers.sessions[0].applyLocalDelta(segs({ text: 'stale', style: {} }))).toBeFalsy();
			expect(peers.sessions[0].adoptMerged(pending)).toBeFalsy();
			expect(peers.sessions[0].readMerged()).toBeUndefined();
			peers.sessions[1].dispose();
			expect(peers.sessions[1].readMerged()).toBeUndefined();
			expect(peers.first.isDestroyed).toBeFalsy();
			expect(peers.second.isDestroyed).toBeFalsy();
		} finally {
			peers.dispose();
		}
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
