import { describe, expect, it } from 'vitest';

import type { CanvasContextMenuCommandId } from './canvas-context-menu-commands';
import {
	buildCanvasContextMenuEntries,
	canvasContextMenuLabelKey,
} from './canvas-context-menu-commands';

function ids(
	...args: Parameters<typeof buildCanvasContextMenuEntries>
): CanvasContextMenuCommandId[] {
	return buildCanvasContextMenuEntries(...args).map((item) => item.id);
}

describe('buildCanvasContextMenuEntries', () => {
	it('offers Paste, Layout, Reset Slide, Format Background, Grid and Guides, Ruler in order', () => {
		expect(ids()).toStrictEqual([
			'paste',
			'layout',
			'reset-slide',
			'format-background',
			'grid-and-guides',
			'ruler',
		]);
	});

	it('greys out Paste only when the binding says the clipboard is empty', () => {
		const paste = (hasClipboard?: boolean) =>
			buildCanvasContextMenuEntries({ hasClipboard }).find((item) => item.id === 'paste');
		expect(paste(false)?.disabled).toBeTruthy();
		expect(paste(true)?.disabled).toBeUndefined();
		expect(paste()?.disabled).toBeUndefined();
	});

	it('reflects grid/ruler visibility as checkbox state', () => {
		const entries = buildCanvasContextMenuEntries({ showGrid: true, showRulers: false });
		expect(entries.find((item) => item.id === 'grid-and-guides')?.checked).toBeTruthy();
		expect(entries.find((item) => item.id === 'ruler')?.checked).toBeFalsy();
	});

	it('defaults checkbox state to false when the binding does not track it', () => {
		const entries = buildCanvasContextMenuEntries();
		expect(entries.find((item) => item.id === 'grid-and-guides')?.checked).toBeFalsy();
		expect(entries.find((item) => item.id === 'ruler')?.checked).toBeFalsy();
	});

	it('separates each group of commands', () => {
		const entries = buildCanvasContextMenuEntries();
		// Paste | layout+reset | format-background | grid+ruler.
		expect(entries.filter((item) => item.separatorBefore)).toHaveLength(3);
		expect(entries[0].separatorBefore).toBeUndefined();
	});

	it('labels every command from the shared dictionary', () => {
		for (const item of buildCanvasContextMenuEntries()) {
			expect(item.labelKey).toBe(canvasContextMenuLabelKey(item.id));
			expect(item.labelKey.startsWith('pptx.')).toBeTruthy();
		}
	});
});
