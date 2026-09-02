import { describe, expect, it } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { currentRecentColors, recordRecentColor } from './editor-recent-colors';

/**
 * B6: `p:clrMru` round-trips as `presentationProperties.mruColors` (already
 * threaded through `editor-operations.ts`'s `save()`), so a deck loaded with
 * `mruColors: ['#112233']` seeds the row, and picking a colour writes the
 * updated list back into the SAME field, outside the undo stack.
 */

describe('editor-recent-colors', () => {
	it("seeds from a loaded deck's mruColors", () => {
		const store = createStore({
			...createInitialViewerState(),
			presentationProperties: { mruColors: ['#112233'] },
		});
		expect(currentRecentColors(store.get())).toStrictEqual(['#112233']);
	});

	it('puts a newly picked colour first and writes it back into presentationProperties', () => {
		const store = createStore({
			...createInitialViewerState(),
			presentationProperties: { mruColors: ['#112233'] },
		});

		recordRecentColor(store, '#445566');

		expect(store.get().presentationProperties.mruColors).toStrictEqual(['#445566', '#112233']);
	});

	it('is a no-op for a non-hex value (e.g. a gradient or theme token)', () => {
		const store = createStore({
			...createInitialViewerState(),
			presentationProperties: { mruColors: ['#112233'] },
		});

		recordRecentColor(store, 'not-a-colour');

		expect(store.get().presentationProperties.mruColors).toStrictEqual(['#112233']);
	});

	it('moves an already-recent colour to the front instead of duplicating it', () => {
		const store = createStore({
			...createInitialViewerState(),
			presentationProperties: { mruColors: ['#112233', '#445566'] },
		});

		recordRecentColor(store, '#445566');

		expect(store.get().presentationProperties.mruColors).toStrictEqual(['#445566', '#112233']);
	});

	it('does not go through the undo stack', () => {
		const store = createStore({
			...createInitialViewerState(),
			presentationProperties: {},
			dirty: false,
		});

		recordRecentColor(store, '#112233');

		// A picker-only write is not a document edit: it must not flip `dirty`.
		expect(store.get().dirty).toBeFalsy();
	});
});
