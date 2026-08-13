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
		expect(mark.sources).toStrictEqual([slides]);
	});
});
