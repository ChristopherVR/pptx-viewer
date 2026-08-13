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

describe('slide master and layout active elements', () => {
	const masterShape = { ...element, id: 'slide-master-slideMaster1-shape-0' };
	const layoutShape = { ...element, id: 'slide-layout-slideLayout1-shape-0' };
	const baseState = {
		...createInitialViewerState(),
		masterViewTab: 'slides' as const,
		slideMasters: [
			{
				path: 'ppt/slideMasters/slideMaster1.xml',
				elements: [masterShape],
				layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [layoutShape] }],
			},
		],
	};

	it('edits the master itself when no layout is selected', () => {
		const state = { ...baseState, masterViewTarget: { masterIndex: 0, layoutIndex: null } };
		expect(getActiveElements(state)).toStrictEqual([masterShape]);
		expect(replaceActiveElements(state, [{ ...masterShape, x: 42 }])).toStrictEqual({
			slideMasters: [{ ...baseState.slideMasters[0], elements: [{ ...masterShape, x: 42 }] }],
		});
	});

	it('paints the master behind a layout and routes each edit to its own part', () => {
		const state = { ...baseState, masterViewTarget: { masterIndex: 0, layoutIndex: 0 } };
		expect(getActiveElements(state)).toStrictEqual([masterShape, layoutShape]);
		expect(replaceActiveElements(state, [masterShape, { ...layoutShape, x: 7 }])).toStrictEqual({
			slideMasters: [
				{
					path: 'ppt/slideMasters/slideMaster1.xml',
					elements: [masterShape],
					layouts: [
						{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [{ ...layoutShape, x: 7 }] },
					],
				},
			],
		});
	});
});
