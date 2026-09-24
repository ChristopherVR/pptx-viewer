import { buildCanvasContextMenuEntries } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ContextMenuItem } from '../components/ContextMenu.vue';

/**
 * useCanvasContextMenu: the right-click menu for the empty slide canvas (no
 * element under the cursor), as distinct from `useContextMenu`'s per-element
 * menu. Kept in its own composable (rather than folded into `useContextMenu`,
 * already at this repo's 300-line file-size guideline) since it owns separate
 * state and the shared `canvas-context-menu-commands` command set.
 */

/** Reactive open/position state for the empty-canvas context menu. */
export interface CanvasContextMenuState {
	open: boolean;
	x: number;
	y: number;
}

export interface UseCanvasContextMenuInput {
	hasClipboard: ComputedRef<boolean> | Ref<boolean>;
	showGrid: Ref<boolean>;
	showRulers: Ref<boolean>;
	onPaste: () => void;
	/** Opens the existing Layout gallery (imperative open, not the ribbon's own click), at (x, y). */
	onOpenLayoutGallery: (x: number, y: number) => void;
	onResetSlide: () => void;
	/** Opens the inspector on slide/background properties (no element selected). */
	onOpenFormatBackground: () => void;
}

export interface UseCanvasContextMenuResult {
	canvasContextMenu: Ref<CanvasContextMenuState>;
	canvasContextItems: ComputedRef<ContextMenuItem[]>;
	/** Called from `useContextMenu`'s stage handler once it decides no element was hit. */
	openCanvasContextMenu: (x: number, y: number) => void;
	onCanvasContextSelect: (actionId: string) => void;
	closeCanvasContextMenu: () => void;
}

export function useCanvasContextMenu(input: UseCanvasContextMenuInput): UseCanvasContextMenuResult {
	const { t } = useI18n();
	const canvasContextMenu = ref<CanvasContextMenuState>({ open: false, x: 0, y: 0 });

	const canvasContextItems = computed<ContextMenuItem[]>(() => {
		const entries = buildCanvasContextMenuEntries({
			hasClipboard: input.hasClipboard.value,
			showGrid: input.showGrid.value,
			showRulers: input.showRulers.value,
		});
		return entries.flatMap((entry, index) => {
			const item: ContextMenuItem = {
				id: entry.id,
				label: t(entry.labelKey),
				disabled: entry.disabled,
				checked: entry.checked,
			};
			return entry.separatorBefore
				? [{ id: `sep-${index}`, label: '', separator: true }, item]
				: [item];
		});
	});

	function openCanvasContextMenu(x: number, y: number): void {
		canvasContextMenu.value = { open: true, x, y };
	}

	function closeCanvasContextMenu(): void {
		canvasContextMenu.value = { ...canvasContextMenu.value, open: false };
	}

	function onCanvasContextSelect(actionId: string): void {
		const { x, y } = canvasContextMenu.value;
		switch (actionId) {
			case 'paste':
				input.onPaste();
				break;
			case 'layout':
				input.onOpenLayoutGallery(x, y);
				break;
			case 'reset-slide':
				input.onResetSlide();
				break;
			case 'format-background':
				input.onOpenFormatBackground();
				break;
			case 'grid-and-guides':
				input.showGrid.value = !input.showGrid.value;
				break;
			case 'ruler':
				input.showRulers.value = !input.showRulers.value;
				break;
			default:
				break;
		}
	}

	return {
		canvasContextMenu,
		canvasContextItems,
		openCanvasContextMenu,
		onCanvasContextSelect,
		closeCanvasContextMenu,
	};
}
