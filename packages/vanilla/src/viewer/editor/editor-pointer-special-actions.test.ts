import { describe, expect, it } from 'vitest';

import { createInitialViewerState } from '../state';
import { snapSiblings, snapToGrid } from './editor-pointer-special-actions';

describe('editor pointer special actions', () => {
	it('snaps geometry to the ten-pixel grid', () => {
		expect(snapToGrid({ x: 14, y: 26, width: 10 }, true)).toMatchObject({ x: 10, y: 30 });
		expect(snapToGrid({ x: 14, y: 26 }, false)).toStrictEqual({ x: 14, y: 26 });
	});

	it('gates shape snap siblings with viewer state', () => {
		const element = { type: 'shape', id: 'a', x: 1, y: 2, width: 3, height: 4 } as const;
		const state = {
			...createInitialViewerState(),
			slides: [{ id: 's', rId: 'rId-s', slideNumber: 1, elements: [element] }],
		};
		expect(snapSiblings({ ...state, snapToShape: false })).toStrictEqual([]);
		expect(snapSiblings({ ...state, snapToShape: true })).toStrictEqual([
			{ id: 'a', x: 1, y: 2, width: 3, height: 4 },
		]);
	});
});
