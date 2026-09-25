// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';

import { useContextMenu } from './useContextMenu';
import type { UseContextMenuResult } from './useContextMenu';
import type { EditorOperations } from './useEditorOperations';
import { createOutlineAuthoringStore } from './useOutlineAuthoring';

const SHAPE = {
	id: 'shape-1',
	type: 'shape',
	x: 0,
	y: 0,
	width: 100,
	height: 50,
	shapeType: 'rect',
} as PptxElement;

function setup(
	element: PptxElement,
	onEditPoints?: (el: PptxElement) => void,
): UseContextMenuResult {
	let menu: UseContextMenuResult | null = null;
	mount(
		defineComponent({
			setup() {
				menu = useContextMenu({
					canEdit: () => true,
					findActiveElement: (id) => (id === element.id ? element : undefined),
					tableSelection: ref(null),
					hasClipboard: computed(() => true),
					canGroup: computed(() => false),
					selectionGroupable: computed(() => true),
					editTemplateMode: ref(false),
					selectedElementIds: ref<string[]>([element.id]),
					inlineEditingElementId: ref<string | null>(null),
					inspectorOpen: ref(false),
					enterInlineEdit: () => {},
					ops: {} as EditorOperations,
					cutElement: () => {},
					copyElement: () => {},
					pasteElement: () => {},
					onGroup: () => {},
					onUngroup: () => {},
					openHyperlinkDialog: () => {},
					onEditPoints,
				});
				return () => h('div');
			},
		}),
	);
	const result = menu as unknown as UseContextMenuResult;
	result.contextMenu.value = { open: true, x: 0, y: 0, elementId: element.id };
	return result;
}

describe('useContextMenu Edit Points', () => {
	it('offers Edit Points under Edit Text for a shape and starts the mode', () => {
		const store = createOutlineAuthoringStore({ updateElement: vi.fn(), addElement: vi.fn() });
		const menu = setup(SHAPE, store.startEditPoints);
		const ids = menu.contextItems.value.filter((i) => !i.separator).map((i) => i.id);
		expect(ids.indexOf('edit-points')).toBe(ids.indexOf('edit-text') + 1);
		expect(menu.contextItems.value.find((i) => i.id === 'edit-points')?.disabled).toBeFalsy();
		menu.onContextSelect('edit-points');
		expect(store.editPointsElementId.value).toBe(SHAPE.id);
	});

	it('greys Edit Points out for a noEditPoints lock', () => {
		const locked = { ...SHAPE, locks: { noEditPoints: true } } as PptxElement;
		const menu = setup(locked, vi.fn());
		expect(menu.contextItems.value.find((i) => i.id === 'edit-points')?.disabled).toBeTruthy();
	});

	it('does not offer Edit Points when the viewer did not wire it', () => {
		const menu = setup(SHAPE);
		expect(menu.contextItems.value.some((i) => i.id === 'edit-points')).toBeFalsy();
	});

	it('arming a drawing tool ends Edit Points and vice versa', () => {
		const store = createOutlineAuthoringStore({ updateElement: vi.fn(), addElement: vi.fn() });
		store.startEditPoints(SHAPE);
		store.armFreeformTool('curve');
		expect(store.editPointsElementId.value).toBeNull();
		store.startEditPoints(SHAPE);
		expect(store.activeFreeformTool.value).toBeNull();
		expect(store.editPointsElementId.value).toBe(SHAPE.id);
	});
});
