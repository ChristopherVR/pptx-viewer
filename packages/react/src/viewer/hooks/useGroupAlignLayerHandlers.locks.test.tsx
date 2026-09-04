import type { PptxElement, PptxSlide, GroupPptxElement } from 'pptx-viewer-core';
// @vitest-environment happy-dom
/**
 * G10 (OpenXML parity audit, D3): `a:spLocks`/`a:grpSpLocks`/@noGrouping was
 * parsed and folded into `element-locks.ts`'s `groupable` descriptor, but
 * `handleGroupElements`/`handleUngroupElement` never consulted it - a locked
 * shape could still be grouped, and a locked group could still be ungrouped,
 * from the toolbar/context-menu/shortcut path that calls this hook.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GroupAlignLayerHandlers } from './element-manipulation-types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import { useGroupAlignLayerHandlers } from './useGroupAlignLayerHandlers';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		...overrides,
	} as unknown as PptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

/** Mounts the hook and hands the caller its returned handlers via a ref-like out param. */
function mount(input: {
	activeElements: PptxElement[];
	selectedElement: PptxElement | null;
	effectiveSelectedIds: string[];
	selectedElements: PptxElement[];
}): {
	handlers: GroupAlignLayerHandlers;
	activeElements: () => PptxElement[];
	dirty: () => number;
} {
	let activeElements = input.activeElements;
	let dirtyCount = 0;
	const ops = {
		activeElements,
		updateActiveElements: (updater: (els: PptxElement[]) => PptxElement[]) => {
			activeElements = updater(activeElements);
		},
		applySelection: () => {},
	} as unknown as ElementOperations;
	const history = { markDirty: () => dirtyCount++ } as unknown as EditorHistoryResult;

	let handlers!: GroupAlignLayerHandlers;
	function Harness() {
		handlers = useGroupAlignLayerHandlers({
			activeSlide: { id: 'slide1', elements: activeElements } as unknown as PptxSlide,
			activeSlideIndex: 0,
			selectedElement: input.selectedElement,
			effectiveSelectedIds: input.effectiveSelectedIds,
			selectedElements: input.selectedElements,
			elementLookup: new Map(activeElements.map((el) => [el.id, el])),
			setSelectedElementIds: () => {},
			ops,
			history,
		});
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
	return { handlers, activeElements: () => activeElements, dirty: () => dirtyCount };
}

describe('handleGroupElements with a:spLocks/@noGrouping', () => {
	it('rejects the whole grouping attempt when any selected shape is locked', () => {
		const locked = shape('a', { locks: { noGrouping: true } });
		const free = shape('b', { x: 200 });
		const { handlers, activeElements, dirty } = mount({
			activeElements: [locked, free],
			selectedElement: null,
			effectiveSelectedIds: ['a', 'b'],
			selectedElements: [locked, free],
		});
		act(() => {
			handlers.handleGroupElements();
		});
		expect(activeElements().map((el) => el.type)).toStrictEqual(['shape', 'shape']);
		expect(dirty()).toBe(0);
	});

	it('groups an unlocked selection normally', () => {
		const a = shape('a');
		const b = shape('b', { x: 200 });
		const { handlers, activeElements, dirty } = mount({
			activeElements: [a, b],
			selectedElement: null,
			effectiveSelectedIds: ['a', 'b'],
			selectedElements: [a, b],
		});
		act(() => {
			handlers.handleGroupElements();
		});
		expect(activeElements().some((el) => el.type === 'group')).toBeTruthy();
		expect(dirty()).toBe(1);
	});
});

describe('handleUngroupElement with a:grpSpLocks/@noGrouping', () => {
	it('refuses to ungroup a group whose own noGrouping lock is set', () => {
		const group = shape('g', {
			type: 'group',
			children: [shape('c1'), shape('c2', { x: 200 })],
			locks: { noGrouping: true },
		}) as GroupPptxElement;
		const { handlers, activeElements, dirty } = mount({
			activeElements: [group],
			selectedElement: group,
			effectiveSelectedIds: ['g'],
			selectedElements: [group],
		});
		act(() => {
			handlers.handleUngroupElement();
		});
		expect(activeElements()).toStrictEqual([group]);
		expect(dirty()).toBe(0);
	});

	it('ungroups an unlocked group normally', () => {
		const group = shape('g', {
			type: 'group',
			children: [shape('c1'), shape('c2', { x: 200 })],
		}) as GroupPptxElement;
		const { handlers, activeElements, dirty } = mount({
			activeElements: [group],
			selectedElement: group,
			effectiveSelectedIds: ['g'],
			selectedElements: [group],
		});
		act(() => {
			handlers.handleUngroupElement();
		});
		expect(activeElements().some((el) => el.type === 'group')).toBeFalsy();
		expect(dirty()).toBe(1);
	});
});
