import { describe, it, expect } from 'vitest';

import { resolveSelectionPaneRename } from './selection-pane-rename';

/**
 * The empty case is the regression. All five bindings committed
 * `name: undefined` for a cleared rename box, and the save writer
 * (`applyNameToCnvPr`) reads `undefined` as "the model has no opinion, leave
 * the markup alone" - deliberately, because charts / SmartArt / other graphic
 * frames parse without a `name` while their markup carries a real one. So
 * clearing a name in the Selection Pane did nothing: it never reached the file,
 * and the old name came back on reload.
 */
describe('resolveSelectionPaneRename', () => {
	it('commits a trimmed new name', () => {
		expect(resolveSelectionPaneRename('Old', '  New Name  ')).toStrictEqual({ name: 'New Name' });
	});

	it('commits an explicit empty string when the box is cleared', () => {
		expect(resolveSelectionPaneRename('Old', '')).toStrictEqual({ name: '' });
		expect(resolveSelectionPaneRename('Old', '   ')).toStrictEqual({ name: '' });
	});

	it('never returns undefined as the name, which the writer would ignore', () => {
		for (const value of ['', '   ', 'Renamed', '  Renamed  ']) {
			const commit = resolveSelectionPaneRename('Old', value);
			expect(commit).not.toBeNull();
			expect(commit?.name).toBeTypeOf('string');
		}
	});

	it('treats an unedited commit as a no-op, so a fallback seed is never persisted', () => {
		// Double-clicking a row and clicking away must not write the display
		// label ("Shape 3", or the element id) into the element as a real name.
		expect(resolveSelectionPaneRename('shape-1', 'shape-1')).toBeNull();
		expect(resolveSelectionPaneRename('shape-1', '  shape-1  ')).toBeNull();
	});

	it('treats an unedited commit on an EMPTY seed as a no-op too', () => {
		// The Svelte pane seeds from `element.name ?? ''`. Without this branch,
		// committing `''` on a nameless element would write `name=""` into a file
		// the user never renamed.
		expect(resolveSelectionPaneRename('', '')).toBeNull();
		expect(resolveSelectionPaneRename('', '   ')).toBeNull();
	});

	it('compares against the trimmed seed', () => {
		expect(resolveSelectionPaneRename('  Title  ', 'Title')).toBeNull();
	});
});
