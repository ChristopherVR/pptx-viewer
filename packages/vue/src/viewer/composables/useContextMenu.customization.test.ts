// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { resolveCustomization } from 'pptx-viewer-shared';
import type { ViewerCustomization } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';

import { useCanvasContextMenu } from './useCanvasContextMenu';
import type { UseCanvasContextMenuResult } from './useCanvasContextMenu';
import { useContextMenu } from './useContextMenu';
import type { UseContextMenuResult } from './useContextMenu';
import type { EditorOperations } from './useEditorOperations';

/**
 * The host's context-menu customisation reaches both right-click menus: hidden
 * commands are absent, and a disabled (or emptied) menu never opens.
 */
function mountMenus(customization: ViewerCustomization) {
	const resolved = resolveCustomization(customization);
	const el = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 };
	let element: UseContextMenuResult | null = null;
	let canvas: UseCanvasContextMenuResult | null = null;
	mount(
		defineComponent({
			setup() {
				element = useContextMenu({
					canEdit: () => true,
					findActiveElement: (id) => (id === 'shape-1' ? (el as PptxElement) : undefined),
					tableSelection: ref(null),
					hasClipboard: computed(() => false),
					canGroup: computed(() => false),
					selectionGroupable: computed(() => true),
					editTemplateMode: ref(false),
					selectedElementIds: ref<string[]>(['shape-1']),
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
					customization: () => resolved,
				});
				canvas = useCanvasContextMenu({
					hasClipboard: computed(() => false),
					showGrid: ref(false),
					showRulers: ref(false),
					onPaste: () => {},
					onOpenLayoutGallery: () => {},
					onResetSlide: () => {},
					onOpenFormatBackground: () => {},
					customization: () => resolved,
				});
				return () => h('div');
			},
		}),
	);
	const elementMenu = element as unknown as UseContextMenuResult;
	elementMenu.contextMenu.value = { open: true, x: 0, y: 0, elementId: 'shape-1' };
	return { elementMenu, canvasMenu: canvas as unknown as UseCanvasContextMenuResult };
}

describe('context menus under UI customization', () => {
	it('omits hidden element commands and keeps the rest', () => {
		const { elementMenu } = mountMenus({
			contextMenu: { hiddenElementCommands: ['delete', 'duplicate'] },
		});
		const ids = elementMenu.contextItems.value.map((item) => item.id);
		expect(ids).toContain('copy');
		expect(ids).not.toContain('delete');
		expect(ids).not.toContain('duplicate');
	});

	it('renders no element entries when the element menu is disabled', () => {
		const { elementMenu } = mountMenus({ contextMenu: { disableElementMenu: true } });
		expect(elementMenu.contextItems.value).toStrictEqual([]);
	});

	it('omits hidden canvas commands', () => {
		const { canvasMenu } = mountMenus({ contextMenu: { hiddenCanvasCommands: ['ruler'] } });
		const ids = canvasMenu.canvasContextItems.value.map((item) => item.id);
		expect(ids).toContain('paste');
		expect(ids).not.toContain('ruler');
	});

	it('never opens a disabled canvas menu', () => {
		const { canvasMenu } = mountMenus({ contextMenu: { disableCanvasMenu: true } });
		canvasMenu.openCanvasContextMenu(10, 20);
		expect(canvasMenu.canvasContextMenu.value.open).toBeFalsy();
	});
});
