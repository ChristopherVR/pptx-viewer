/**
 * Every command the shared empty-canvas menu can render must actually do
 * something here. Sibling of `editor-context-menu-dispatch.test.ts`.
 *
 * All pure: this package has no TestBed (see `vitest.config.ts`).
 *
 * @module angular-viewer/slide-canvas-context-menu-dispatch.test
 */

import { describe, expect, it } from 'vitest';

import type { CanvasContextMenuCommandId } from '../internal/shared';
import { buildCanvasContextMenuEntries } from '../internal/shared';
import type { CanvasContextMenuActions } from './slide-canvas-context-menu-dispatch';
import { runCanvasContextMenuCommand } from './slide-canvas-context-menu-dispatch';

/** An actions object that records which method the dispatch called. */
function recorder(): { calls: string[]; actions: CanvasContextMenuActions } {
	const calls: string[] = [];
	const note = (name: string) => (): void => {
		calls.push(name);
	};
	return {
		calls,
		actions: {
			paste: note('paste'),
			openLayoutGallery: note('openLayoutGallery'),
			resetSlide: note('resetSlide'),
			openFormatBackground: note('openFormatBackground'),
			toggleGrid: note('toggleGrid'),
			toggleRulers: note('toggleRulers'),
		},
	};
}

describe('runCanvasContextMenuCommand', () => {
	it('routes every id the shared list can produce to exactly one action call', () => {
		const ids = buildCanvasContextMenuEntries().map((e) => e.id);
		expect(ids).toStrictEqual([
			'paste',
			'layout',
			'reset-slide',
			'format-background',
			'grid-and-guides',
			'ruler',
		]);
		for (const id of ids) {
			const { calls, actions } = recorder();
			runCanvasContextMenuCommand(id, actions);
			expect(calls, `"${id}" should call exactly one action`).toHaveLength(1);
		}
	});

	it.each([
		['paste', 'paste'],
		['layout', 'openLayoutGallery'],
		['reset-slide', 'resetSlide'],
		['format-background', 'openFormatBackground'],
		['grid-and-guides', 'toggleGrid'],
		['ruler', 'toggleRulers'],
	] satisfies Array<[CanvasContextMenuCommandId, string]>)('%s -> %s', (id, expected) => {
		const { calls, actions } = recorder();
		runCanvasContextMenuCommand(id, actions);
		expect(calls).toStrictEqual([expected]);
	});
});
