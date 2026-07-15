import { describe, expect, it } from 'vitest';

import { createInitialViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';

const element = {
	id: 'shape-1',
	type: 'shape' as const,
	x: 0,
	y: 0,
	width: 100,
	height: 50,
	shapeType: 'rect',
};

describe('notes and handout master active elements', () => {
	it('routes mutations to the selected non-slide master', () => {
		const notesState = {
			...createInitialViewerState(),
			masterViewTarget: { masterIndex: 0, layoutIndex: null },
			masterViewTab: 'notes' as const,
			notesMaster: { path: 'notes', elements: [element] },
		};
		expect(getActiveElements(notesState)).toStrictEqual([element]);
		expect(replaceActiveElements(notesState, [])).toStrictEqual({
			notesMaster: { path: 'notes', elements: [] },
		});

		const handoutState = {
			...notesState,
			masterViewTab: 'handout' as const,
			handoutMaster: { path: 'handout', elements: [element] },
		};
		expect(getActiveElements(handoutState)).toStrictEqual([element]);
		expect(replaceActiveElements(handoutState, [])).toStrictEqual({
			handoutMaster: { path: 'handout', elements: [] },
		});
	});
});
