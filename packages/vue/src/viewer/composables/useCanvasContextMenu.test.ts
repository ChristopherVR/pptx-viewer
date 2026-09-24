// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import { useCanvasContextMenu } from './useCanvasContextMenu';
import type { UseCanvasContextMenuInput, UseCanvasContextMenuResult } from './useCanvasContextMenu';

/** `useCanvasContextMenu` calls `useI18n()`, so it must run inside a component setup. */
function setup(
	overrides: Partial<UseCanvasContextMenuInput> = {},
): UseCanvasContextMenuResult & { input: UseCanvasContextMenuInput } {
	let menu: UseCanvasContextMenuResult | null = null;
	const input: UseCanvasContextMenuInput = {
		hasClipboard: ref(true),
		showGrid: ref(false),
		showRulers: ref(false),
		onPaste: vi.fn(),
		onOpenLayoutGallery: vi.fn(),
		onResetSlide: vi.fn(),
		onOpenFormatBackground: vi.fn(),
		...overrides,
	};
	mount(
		defineComponent({
			setup() {
				menu = useCanvasContextMenu(input);
				return () => h('div');
			},
		}),
	);
	return { ...(menu as unknown as UseCanvasContextMenuResult), input };
}

describe('useCanvasContextMenu', () => {
	it('starts closed', () => {
		const menu = setup();
		expect(menu.canvasContextMenu.value.open).toBeFalsy();
	});

	it('opens at the given position', () => {
		const menu = setup();
		menu.openCanvasContextMenu(40, 60);
		expect(menu.canvasContextMenu.value).toStrictEqual({ open: true, x: 40, y: 60 });
	});

	it('offers the shared six-command set, greying Paste with an empty clipboard', () => {
		const menu = setup({ hasClipboard: ref(false) });
		const ids = menu.canvasContextItems.value.filter((i) => !i.separator).map((i) => i.id);
		expect(ids).toStrictEqual([
			'paste',
			'layout',
			'reset-slide',
			'format-background',
			'grid-and-guides',
			'ruler',
		]);
		const paste = menu.canvasContextItems.value.find((i) => i.id === 'paste');
		expect(paste?.disabled).toBeTruthy();
	});

	it('marks Grid and Guides / Ruler as checked from current view state', () => {
		const menu = setup({ showGrid: ref(true), showRulers: ref(false) });
		const grid = menu.canvasContextItems.value.find((i) => i.id === 'grid-and-guides');
		const ruler = menu.canvasContextItems.value.find((i) => i.id === 'ruler');
		expect(grid?.checked).toBeTruthy();
		expect(ruler?.checked).toBeFalsy();
	});

	it('routes each command id to its handler', () => {
		const menu = setup();
		menu.openCanvasContextMenu(10, 20);

		menu.onCanvasContextSelect('paste');
		expect(menu.input.onPaste).toHaveBeenCalledOnce();

		menu.onCanvasContextSelect('layout');
		expect(menu.input.onOpenLayoutGallery).toHaveBeenCalledWith(10, 20);

		menu.onCanvasContextSelect('reset-slide');
		expect(menu.input.onResetSlide).toHaveBeenCalledOnce();

		menu.onCanvasContextSelect('format-background');
		expect(menu.input.onOpenFormatBackground).toHaveBeenCalledOnce();
	});

	it('toggles showGrid/showRulers directly', () => {
		const showGrid = ref(false);
		const showRulers = ref(true);
		const menu = setup({ showGrid, showRulers });

		menu.onCanvasContextSelect('grid-and-guides');
		expect(showGrid.value).toBeTruthy();

		menu.onCanvasContextSelect('ruler');
		expect(showRulers.value).toBeFalsy();
	});

	it('closes without changing position', () => {
		const menu = setup();
		menu.openCanvasContextMenu(5, 5);
		menu.closeCanvasContextMenu();
		expect(menu.canvasContextMenu.value).toStrictEqual({ open: false, x: 5, y: 5 });
	});
});
