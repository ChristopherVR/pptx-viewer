import { describe, it, expect } from 'vitest';

import { autosaveSnapshotMark, shouldWriteAutosaveSnapshot } from './autosave-tick';

/**
 * The two directions are not equally bad. A wasted write costs milliseconds; a
 * suppressed one costs the user their crash recovery. Every "is it unsure?"
 * case below therefore asserts that it WRITES.
 */
describe('shouldWriteAutosaveSnapshot', () => {
	const slides = [{ id: 'slide1' }];
	const base = {
		filePath: 'deck.pptx',
		isDirty: true,
		saving: false,
		sources: [slides] as readonly unknown[],
		lastSnapshot: undefined,
	};

	it('does nothing without a file path, a dirty flag, or a free slot', () => {
		expect(shouldWriteAutosaveSnapshot({ ...base, filePath: undefined })).toBeFalsy();
		expect(shouldWriteAutosaveSnapshot({ ...base, isDirty: false })).toBeFalsy();
		expect(shouldWriteAutosaveSnapshot({ ...base, saving: true })).toBeFalsy();
	});

	it('writes the first snapshot', () => {
		expect(shouldWriteAutosaveSnapshot(base)).toBeTruthy();
	});

	it('skips a tick when nothing has been reassigned since the last snapshot', () => {
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', [slides]);
		expect(shouldWriteAutosaveSnapshot({ ...base, lastSnapshot })).toBeFalsy();
	});

	it('writes when the slides array is reassigned, which is what an edit does', () => {
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', [slides]);
		// Same CONTENT, new array: exactly what an immutable edit produces.
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [[...slides]], lastSnapshot }),
		).toBeTruthy();
	});

	it('writes when any later source changes, not just the first', () => {
		const templates = new Map();
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', [slides, templates, 'a']);
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [slides, templates, 'b'], lastSnapshot }),
		).toBeTruthy();
	});

	it('writes when the file being edited changed under the same engine', () => {
		const lastSnapshot = autosaveSnapshotMark('other.pptx', [slides]);
		expect(shouldWriteAutosaveSnapshot({ ...base, lastSnapshot })).toBeTruthy();
	});

	it('writes when the caller supplies nothing to compare', () => {
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', []);
		expect(shouldWriteAutosaveSnapshot({ ...base, sources: [], lastSnapshot })).toBeTruthy();
	});

	it('writes when the source list changes shape', () => {
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', [slides]);
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [slides, 'extra'], lastSnapshot }),
		).toBeTruthy();
	});

	it('treats NaN as unchanged rather than churning forever', () => {
		// Object.is, not ===: a NaN source would otherwise write on every tick.
		const lastSnapshot = autosaveSnapshotMark('deck.pptx', [Number.NaN]);
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [Number.NaN], lastSnapshot }),
		).toBeFalsy();
	});

	it('copies the sources it marks, so a later mutation cannot fake a match', () => {
		const live: unknown[] = [slides];
		const mark = autosaveSnapshotMark('deck.pptx', live);
		live.push('appended');
		expect(mark.sources).toHaveLength(1);
		expect(shouldWriteAutosaveSnapshot({ ...base, lastSnapshot: mark })).toBeFalsy();
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: live, lastSnapshot: mark }),
		).toBeTruthy();
	});

	it('stores opaque identities instead of retaining source objects and functions', () => {
		const templates = new Map();
		const serializer = () => slides;
		const sources = [slides, templates, serializer];
		const mark = autosaveSnapshotMark('deck.pptx', sources);
		for (const source of sources) {
			expect(mark.sources).not.toContain(source);
		}
		expect(mark.sources).toStrictEqual([{}, {}, {}]);
		expect(shouldWriteAutosaveSnapshot({ ...base, sources, lastSnapshot: mark })).toBeFalsy();
	});

	it('keeps stable identities across marks without merging different objects', () => {
		const otherSlides = [...slides];
		const first = autosaveSnapshotMark('deck.pptx', [slides, otherSlides]);
		const second = autosaveSnapshotMark('deck.pptx', [slides, otherSlides]);
		expect(first.sources[0]).toBe(second.sources[0]);
		expect(first.sources[1]).toBe(second.sources[1]);
		expect(first.sources[0]).not.toBe(first.sources[1]);
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [otherSlides, slides], lastSnapshot: first }),
		).toBeTruthy();
	});

	it('preserves primitive identity including null, undefined, symbols and bigints', () => {
		const symbol = Symbol('source');
		const sources = [null, undefined, false, '', 1n, symbol, Number.NaN];
		const mark = autosaveSnapshotMark('deck.pptx', sources);
		expect(mark.sources).toStrictEqual(sources);
		expect(shouldWriteAutosaveSnapshot({ ...base, sources, lastSnapshot: mark })).toBeFalsy();
		expect(
			shouldWriteAutosaveSnapshot({
				...base,
				sources: [null, undefined, false, '', 1n, Symbol('source'), Number.NaN],
				lastSnapshot: mark,
			}),
		).toBeTruthy();
	});

	it('continues distinguishing positive and negative zero', () => {
		const mark = autosaveSnapshotMark('deck.pptx', [0]);
		expect(shouldWriteAutosaveSnapshot({ ...base, sources: [0], lastSnapshot: mark })).toBeFalsy();
		expect(
			shouldWriteAutosaveSnapshot({ ...base, sources: [-0], lastSnapshot: mark }),
		).toBeTruthy();
	});

	it('does not inspect source properties or invoke source functions', () => {
		const source = Proxy.revocable({}, {});
		const serializer = () => {
			throw new Error('must not be called');
		};
		const sources = [source.proxy, serializer];
		const mark = autosaveSnapshotMark('deck.pptx', sources);
		source.revoke();
		expect(shouldWriteAutosaveSnapshot({ ...base, sources, lastSnapshot: mark })).toBeFalsy();
	});
});
