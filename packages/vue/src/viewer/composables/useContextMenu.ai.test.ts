// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h, ref } from 'vue';

import { useContextMenu } from './useContextMenu';
import type { UseContextMenuResult } from './useContextMenu';
import type { EditorOperations } from './useEditorOperations';

/**
 * useContextMenu (AI) tests: with the assistant enabled, the element context
 * menu gains "Ask AI about this" / "Fix with AI" entries, and selecting them
 * routes to the click-to-ask callbacks. Disabled, the entries are absent.
 *
 * `useContextMenu` calls `useI18n()`, so it must run inside a component setup;
 * we mount a throwaway component and capture its result.
 */
function setup(aiEnabled: boolean, handlers: { onAskAi: () => void; onFixAi: () => void }) {
	const el: PptxElement = {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
	} as unknown as PptxElement;
	let menu: UseContextMenuResult | null = null;
	mount(
		defineComponent({
			setup() {
				menu = useContextMenu({
					canEdit: () => true,
					findActiveElement: (id) => (id === 'shape-1' ? el : undefined),
					tableSelection: ref(null),
					hasClipboard: computed(() => false),
					canGroup: computed(() => false),
					selectionGroupable: computed(() => true),
					editTemplateMode: ref(false),
					selectedElementIds: ref<string[]>(['shape-1']),
					inlineEditingElementId: ref<string | null>(null),
					ops: {} as EditorOperations,
					cutElement: () => {},
					copyElement: () => {},
					pasteElement: () => {},
					onGroup: () => {},
					onUngroup: () => {},
					openHyperlinkDialog: () => {},
					aiEnabled: () => aiEnabled,
					onAskAi: handlers.onAskAi,
					onFixAi: handlers.onFixAi,
				});
				return () => h('div');
			},
		}),
	);
	const result = menu as unknown as UseContextMenuResult;
	// Open the menu on the element so a target is set for dispatch.
	result.contextMenu.value = { open: true, x: 0, y: 0, elementId: 'shape-1' };
	return result;
}

describe('useContextMenu (AI click-to-ask)', () => {
	it('adds Ask AI / Fix with AI entries when the assistant is enabled', () => {
		const menu = setup(true, { onAskAi: () => {}, onFixAi: () => {} });
		const ids = menu.contextItems.value.map((i) => i.id);
		expect(ids).toContain('ai-ask');
		expect(ids).toContain('ai-fix');
	});

	it('omits the AI entries when the assistant is disabled', () => {
		const menu = setup(false, { onAskAi: () => {}, onFixAi: () => {} });
		const ids = menu.contextItems.value.map((i) => i.id);
		expect(ids).not.toContain('ai-ask');
		expect(ids).not.toContain('ai-fix');
	});

	it('routes the Ask / Fix entries to their callbacks', () => {
		const onAskAi = vi.fn();
		const onFixAi = vi.fn();
		const menu = setup(true, { onAskAi, onFixAi });
		menu.onContextSelect('ai-ask');
		expect(onAskAi).toHaveBeenCalledOnce();
		menu.onContextSelect('ai-fix');
		expect(onFixAi).toHaveBeenCalledOnce();
	});
});
