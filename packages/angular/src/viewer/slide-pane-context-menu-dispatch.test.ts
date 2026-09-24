/**
 * Every command the shared thumbnail menu can render must actually do
 * something here. Sibling of `slide-canvas-context-menu-dispatch.test.ts`.
 *
 * All pure: this package has no TestBed (see `vitest.config.ts`).
 */
import { describe, expect, it } from 'vitest';

import type { SlidePaneContextMenuCommandId } from '../internal/shared';
import { buildSlidePaneContextMenuEntries } from '../internal/shared';
import type { SlidePaneContextMenuActions } from './slide-pane-context-menu-dispatch';
import { runSlidePaneContextMenuCommand } from './slide-pane-context-menu-dispatch';

function recorder(): { calls: unknown[][]; actions: SlidePaneContextMenuActions } {
	const calls: unknown[][] = [];
	return {
		calls,
		actions: {
			addSlideAfter: (index) => calls.push(['addSlideAfter', index]),
			duplicateSlides: (indexes) => calls.push(['duplicateSlides', indexes]),
			deleteSlides: (indexes) => calls.push(['deleteSlides', indexes]),
			openLayoutForSlide: (index, x, y) => calls.push(['openLayoutForSlide', index, x, y]),
			toggleHideSlides: (indexes) => calls.push(['toggleHideSlides', indexes]),
			addSectionAt: (index) => calls.push(['addSectionAt', index]),
		},
	};
}

describe('runSlidePaneContextMenuCommand', () => {
	it('routes every id the shared list can produce to exactly one action call', () => {
		const ids = buildSlidePaneContextMenuEntries({
			selectedCount: 1,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		}).map((e) => e.id);
		expect(ids).toStrictEqual([
			'new-slide',
			'duplicate',
			'delete',
			'layout',
			'hide',
			'add-section',
		]);
		for (const id of ids) {
			const { calls, actions } = recorder();
			runSlidePaneContextMenuCommand(id, 2, [2], { x: 5, y: 6 }, actions);
			expect(calls, `"${id}" should call exactly one action`).toHaveLength(1);
		}
	});

	it.each([
		['new-slide', ['addSlideAfter', 2]],
		['duplicate', ['duplicateSlides', [2]]],
		['delete', ['deleteSlides', [2]]],
		['layout', ['openLayoutForSlide', 2, 5, 6]],
		['hide', ['toggleHideSlides', [2]]],
		['add-section', ['addSectionAt', 2]],
	] satisfies Array<[SlidePaneContextMenuCommandId, unknown[]]>)('%s -> %j', (id, expected) => {
		const { calls, actions } = recorder();
		runSlidePaneContextMenuCommand(id, 2, [2], { x: 5, y: 6 }, actions);
		expect(calls[0]).toStrictEqual(expected);
	});
});
