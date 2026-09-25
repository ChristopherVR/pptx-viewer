import type { CanvasContextMenuCommandId, CanvasContextMenuContext } from 'pptx-viewer-shared';

/**
 * What each empty-canvas context-menu command does in React, and what the
 * menu should offer.
 *
 * Sibling of `context-menu-dispatch.ts` (the per-element menu): entries come
 * from `pptx-viewer-shared`'s `canvas-context-menu-commands`, this module is
 * only the React-side wiring from a command id to the handler the viewer
 * passed in.
 */

export interface CanvasContextMenuDispatchProps {
	hasClipboard: boolean;
	showGrid: boolean;
	showRulers: boolean;
	onPaste: () => void;
	/** Opens the existing Layout gallery (imperative open, not the ribbon's own click). */
	onOpenLayoutGallery: () => void;
	onResetSlide: () => void;
	/** Opens the inspector on slide/background properties (no element selected). */
	onOpenFormatBackground: () => void;
	onToggleGrid: () => void;
	onToggleRulers: () => void;
	onClose: () => void;
}

/** A command with no handler is offered but greyed, never silently missing. */
export type CanvasContextMenuHandlers = Partial<Record<CanvasContextMenuCommandId, () => void>>;

/** The state the shared builder needs to decide what this menu contains. */
export function canvasContextMenuContext(
	props: CanvasContextMenuDispatchProps,
): CanvasContextMenuContext {
	return {
		hasClipboard: props.hasClipboard,
		showGrid: props.showGrid,
		showRulers: props.showRulers,
	};
}

/**
 * Command id to handler. EVERY entry closes the menu after running, matching
 * the per-element menu's contract (`context-menu-dispatch.ts`).
 */
export function canvasContextMenuHandlers(
	props: CanvasContextMenuDispatchProps,
): CanvasContextMenuHandlers {
	const { onClose } = props;
	const andClose =
		(run: () => void): (() => void) =>
		() => {
			run();
			onClose();
		};
	return {
		paste: andClose(props.onPaste),
		layout: andClose(props.onOpenLayoutGallery),
		'reset-slide': andClose(props.onResetSlide),
		'format-background': andClose(props.onOpenFormatBackground),
		'grid-and-guides': andClose(props.onToggleGrid),
		ruler: andClose(props.onToggleRulers),
	};
}
