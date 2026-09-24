/**
 * Regression tests for the empty-canvas context-menu command dispatch.
 *
 * Sibling of `context-menu-dispatch.test.ts`: every wired handler must close
 * the menu itself (the viewer's callbacks do not), or the invisible backdrop
 * is left mounted, eating the next click.
 */
import { buildCanvasContextMenuEntries } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import {
	canvasContextMenuContext,
	canvasContextMenuHandlers,
} from './canvas-context-menu-dispatch';
import type { CanvasContextMenuDispatchProps } from './canvas-context-menu-dispatch';

function makeProps(): CanvasContextMenuDispatchProps & { onClose: ReturnType<typeof vi.fn> } {
	const onClose = vi.fn();
	return {
		hasClipboard: true,
		showGrid: false,
		showRulers: false,
		onPaste: vi.fn(),
		onOpenLayoutGallery: vi.fn(),
		onResetSlide: vi.fn(),
		onOpenFormatBackground: vi.fn(),
		onToggleGrid: vi.fn(),
		onToggleRulers: vi.fn(),
		onClose,
	};
}

describe('canvasContextMenuContext', () => {
	it('carries hasClipboard/showGrid/showRulers through unchanged', () => {
		const props = makeProps();
		expect(canvasContextMenuContext(props)).toStrictEqual({
			hasClipboard: true,
			showGrid: false,
			showRulers: false,
		});
	});
});

describe('canvasContextMenuHandlers', () => {
	it('closes the menu after EVERY command (no backdrop leak)', () => {
		const props = makeProps();
		const handlers = canvasContextMenuHandlers(props);
		const entries = buildCanvasContextMenuEntries(canvasContextMenuContext(props));
		for (const entry of entries) {
			const run = handlers[entry.id];
			expect(run, `missing handler for "${entry.id}"`).toBeTypeOf('function');
			props.onClose.mockClear();
			run?.();
			expect(props.onClose, `"${entry.id}" did not close the menu`).toHaveBeenCalledOnce();
		}
	});

	it('routes paste/layout/reset-slide/format-background/grid/ruler to their handlers', () => {
		const props = makeProps();
		const handlers = canvasContextMenuHandlers(props);

		handlers.paste?.();
		expect(props.onPaste).toHaveBeenCalledOnce();

		handlers.layout?.();
		expect(props.onOpenLayoutGallery).toHaveBeenCalledOnce();

		handlers['reset-slide']?.();
		expect(props.onResetSlide).toHaveBeenCalledOnce();

		handlers['format-background']?.();
		expect(props.onOpenFormatBackground).toHaveBeenCalledOnce();

		handlers['grid-and-guides']?.();
		expect(props.onToggleGrid).toHaveBeenCalledOnce();

		handlers.ruler?.();
		expect(props.onToggleRulers).toHaveBeenCalledOnce();
	});
});
