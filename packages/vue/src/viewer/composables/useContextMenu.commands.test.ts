// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';

import { useContextMenu } from './useContextMenu';
import type { UseContextMenuInput, UseContextMenuResult } from './useContextMenu';
import type { EditorOperations } from './useEditorOperations';

/**
 * The Vue context menu's command set, and the right-click that used to open
 * nothing.
 *
 * Vue hand-wrote its item list and had quietly lost Bring to Front, Send to
 * Back and Add Comment, while permanently showing a greyed Group / Ungroup that
 * React does not show at all. The list now comes from `buildContextMenuEntries`
 * in `pptx-viewer-shared`; these tests pin what Vue renders from it and that
 * each id still reaches a Vue operation.
 *
 * `useContextMenu` calls `useI18n()`, so it must run inside a component setup.
 */

const SHAPE = {
	id: 'shape-1',
	type: 'shape',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
} as unknown as PptxElement;

function setup(overrides: Partial<UseContextMenuInput> = {}): UseContextMenuResult {
	let menu: UseContextMenuResult | null = null;
	mount(
		defineComponent({
			setup() {
				menu = useContextMenu({
					canEdit: () => true,
					findActiveElement: (id) => (id === SHAPE.id ? SHAPE : undefined),
					tableSelection: ref(null),
					hasClipboard: computed(() => true),
					canGroup: computed(() => false),
					editTemplateMode: ref(false),
					selectedElementIds: ref<string[]>([SHAPE.id]),
					inlineEditingElementId: ref<string | null>(null),
					ops: {} as EditorOperations,
					cutElement: () => {},
					copyElement: () => {},
					pasteElement: () => {},
					onGroup: () => {},
					onUngroup: () => {},
					openHyperlinkDialog: () => {},
					...overrides,
				});
				return () => h('div');
			},
		}),
	);
	const result = menu as unknown as UseContextMenuResult;
	result.contextMenu.value = { open: true, x: 0, y: 0, elementId: SHAPE.id };
	return result;
}

/** Command ids only: separators are presentation, not part of the command set. */
function commandIds(menu: UseContextMenuResult): string[] {
	return menu.contextItems.value.filter((item) => !item.separator).map((item) => item.id);
}

describe('useContextMenu command set', () => {
	it('offers clipboard, z-order, comment and hyperlink on a plain shape', () => {
		expect(commandIds(setup())).toStrictEqual([
			'copy',
			'cut',
			'paste',
			'duplicate',
			'bring-forward',
			'send-backward',
			'bring-front',
			'send-back',
			'comment',
			'hyperlink',
			'delete',
		]);
	});

	it('shows Group only on a multi-selection, never greyed out', () => {
		expect(commandIds(setup())).not.toContain('group');
		const multi = setup({ canGroup: computed(() => true) });
		expect(commandIds(multi)).toContain('group');
		expect(multi.contextItems.value.find((item) => item.id === 'group')?.disabled).toBeFalsy();
	});

	it('greys Paste out when the clipboard is empty', () => {
		const menu = setup({ hasClipboard: computed(() => false) });
		expect(menu.contextItems.value.find((item) => item.id === 'paste')?.disabled).toBeTruthy();
	});

	it('routes the z-order commands Vue was missing to the editor operations', () => {
		const ops = {
			bringToFront: vi.fn(),
			sendToBack: vi.fn(),
		} as unknown as EditorOperations;
		const menu = setup({ ops });
		menu.onContextSelect('bring-front');
		menu.onContextSelect('send-back');
		expect(ops.bringToFront).toHaveBeenCalledWith(SHAPE.id);
		expect(ops.sendToBack).toHaveBeenCalledWith(SHAPE.id);
	});

	it('routes Add Comment to the host, which opens the comments panel', () => {
		const onAddComment = vi.fn();
		setup({ onAddComment }).onContextSelect('comment');
		expect(onAddComment).toHaveBeenCalledOnce();
	});
});

describe('useContextMenu right-click target', () => {
	/**
	 * The defect: a single click on a text box mounts the inline editor, which
	 * Vue renders as a sibling overlay of the elements. The `[data-element-id]`
	 * hit-test therefore found nothing and the right-click opened no menu at all
	 * on the element the user had just clicked.
	 */
	it('opens on the element being inline-edited when the click lands in its editor', () => {
		const menu = setup({ inlineEditingElementId: ref<string | null>(SHAPE.id) });
		menu.contextMenu.value = { open: false, x: 0, y: 0, elementId: null };
		const editor = document.createElement('div');
		editor.setAttribute('data-inline-editor', '');
		const caret = document.createElement('span');
		editor.appendChild(caret);
		document.body.appendChild(editor);

		// Dispatched rather than constructed: the handler reads `event.target`,
		// which only exists once the event has actually travelled the tree.
		caret.addEventListener('contextmenu', menu.onCanvasContextMenu);
		caret.dispatchEvent(new MouseEvent('contextmenu', { clientX: 12, clientY: 34 }));

		expect(menu.contextMenu.value.open).toBeTruthy();
		expect(menu.contextMenu.value.elementId).toBe(SHAPE.id);
		editor.remove();
	});

	it('opens nothing for a right-click on bare canvas', () => {
		const menu = setup();
		menu.contextMenu.value = { open: false, x: 0, y: 0, elementId: null };
		const bare = document.createElement('div');
		document.body.appendChild(bare);
		bare.addEventListener('contextmenu', menu.onCanvasContextMenu);
		bare.dispatchEvent(new MouseEvent('contextmenu'));

		expect(menu.contextMenu.value.open).toBeFalsy();
		bare.remove();
	});
});
