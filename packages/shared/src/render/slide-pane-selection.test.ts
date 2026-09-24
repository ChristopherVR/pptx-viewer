import { describe, expect, it } from 'vitest';

import { resolveSlidePaneClick } from './slide-pane-selection';

const IDS = ['s1', 's2', 's3', 's4', 's5'];

function click(overrides: Partial<Parameters<typeof resolveSlidePaneClick>[0]> = {}) {
	return resolveSlidePaneClick({
		clickedId: 's1',
		orderedIds: IDS,
		selectedIds: ['s1'],
		anchorId: 's1',
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...overrides,
	});
}

describe('resolveSlidePaneClick', () => {
	it('a plain click collapses to a singleton and re-anchors there', () => {
		const result = click({ clickedId: 's3', selectedIds: ['s1', 's2'], anchorId: 's1' });
		expect(result).toStrictEqual({ selectedIds: ['s3'], anchorId: 's3' });
	});

	it('ctrl-click adds an unselected slide and anchors on it', () => {
		const result = click({ clickedId: 's3', selectedIds: ['s1'], anchorId: 's1', ctrlKey: true });
		expect(result).toStrictEqual({ selectedIds: ['s1', 's3'], anchorId: 's3' });
	});

	it('cmd-click (metaKey) behaves like ctrl-click', () => {
		const result = click({ clickedId: 's3', selectedIds: ['s1'], anchorId: 's1', metaKey: true });
		expect(result).toStrictEqual({ selectedIds: ['s1', 's3'], anchorId: 's3' });
	});

	it('ctrl-clicking an already-selected slide removes it', () => {
		const result = click({
			clickedId: 's2',
			selectedIds: ['s1', 's2', 's3'],
			anchorId: 's3',
			ctrlKey: true,
		});
		expect(result).toStrictEqual({ selectedIds: ['s1', 's3'], anchorId: 's2' });
	});

	it('shift-click selects the contiguous range from the anchor forward', () => {
		const result = click({ clickedId: 's4', selectedIds: ['s2'], anchorId: 's2', shiftKey: true });
		expect(result).toStrictEqual({ selectedIds: ['s2', 's3', 's4'], anchorId: 's2' });
	});

	it('shift-click selects the contiguous range from the anchor backward', () => {
		const result = click({ clickedId: 's1', selectedIds: ['s4'], anchorId: 's4', shiftKey: true });
		expect(result).toStrictEqual({ selectedIds: ['s1', 's2', 's3', 's4'], anchorId: 's4' });
	});

	it('shift-click replaces the selection with the range, not a union', () => {
		const result = click({
			clickedId: 's4',
			selectedIds: ['s1', 's2'],
			anchorId: 's2',
			shiftKey: true,
		});
		expect(result.selectedIds).toStrictEqual(['s2', 's3', 's4']);
	});

	it('shift-click with no anchor falls back to a plain singleton', () => {
		const result = click({ clickedId: 's4', selectedIds: ['s1'], anchorId: null, shiftKey: true });
		expect(result).toStrictEqual({ selectedIds: ['s4'], anchorId: 's4' });
	});
});
