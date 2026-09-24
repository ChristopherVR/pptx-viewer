import { describe, expect, it, vi } from 'vitest';

import {
	buildCanvasMenuEntries,
	runCanvasContextMenuCommand,
} from './canvas-context-menu-dispatch';
import type { CanvasContextMenuDispatchDeps } from './canvas-context-menu-dispatch';
import type { EditorState } from './editor-state.svelte';

function createDeps(
	overrides: Partial<CanvasContextMenuDispatchDeps> = {},
): CanvasContextMenuDispatchDeps & {
	editor: {
		clipboardOps: { pasteClipboard: ReturnType<typeof vi.fn> };
		slidesOps: { resetSlide: ReturnType<typeof vi.fn> };
	};
} {
	const editor = {
		hasClipboard: true,
		clipboardOps: { pasteClipboard: vi.fn() },
		slidesOps: { resetSlide: vi.fn().mockResolvedValue(null) },
	};
	return {
		editor: editor as unknown as EditorState,
		showGrid: false,
		showRulers: false,
		onOpenLayoutGallery: vi.fn(),
		onResetSlide: vi.fn(),
		onOpenFormatBackground: vi.fn(),
		onToggleGrid: vi.fn(),
		onToggleRulers: vi.fn(),
		...overrides,
	} as unknown as CanvasContextMenuDispatchDeps & {
		editor: {
			clipboardOps: { pasteClipboard: ReturnType<typeof vi.fn> };
			slidesOps: { resetSlide: ReturnType<typeof vi.fn> };
		};
	};
}

describe('buildCanvasMenuEntries', () => {
	it('offers the shared six-command set, greying Paste with an empty clipboard', () => {
		const deps = createDeps({ editor: { hasClipboard: false } as unknown as EditorState });
		const ids = buildCanvasMenuEntries(deps).map((e) => e.id);
		expect(ids).toStrictEqual([
			'paste',
			'layout',
			'reset-slide',
			'format-background',
			'grid-and-guides',
			'ruler',
		]);
		expect(buildCanvasMenuEntries(deps).find((e) => e.id === 'paste')?.disabled).toBeTruthy();
	});

	it('marks Grid and Guides / Ruler as checked from current view state', () => {
		const deps = createDeps({ showGrid: true, showRulers: false });
		const entries = buildCanvasMenuEntries(deps);
		expect(entries.find((e) => e.id === 'grid-and-guides')?.checked).toBeTruthy();
		expect(entries.find((e) => e.id === 'ruler')?.checked).toBeFalsy();
	});
});

describe('runCanvasContextMenuCommand', () => {
	it('paste calls editor.clipboardOps.pasteClipboard', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('paste', deps);
		expect(deps.editor.clipboardOps.pasteClipboard).toHaveBeenCalledOnce();
	});

	it('layout calls onOpenLayoutGallery', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('layout', deps);
		expect(deps.onOpenLayoutGallery).toHaveBeenCalledOnce();
	});

	it('reset-slide calls editor.slidesOps.resetSlide', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('reset-slide', deps);
		expect(deps.editor.slidesOps.resetSlide).toHaveBeenCalledOnce();
	});

	it('format-background calls onOpenFormatBackground', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('format-background', deps);
		expect(deps.onOpenFormatBackground).toHaveBeenCalledOnce();
	});

	it('grid-and-guides calls onToggleGrid', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('grid-and-guides', deps);
		expect(deps.onToggleGrid).toHaveBeenCalledOnce();
	});

	it('ruler calls onToggleRulers', () => {
		const deps = createDeps();
		runCanvasContextMenuCommand('ruler', deps);
		expect(deps.onToggleRulers).toHaveBeenCalledOnce();
	});
});
