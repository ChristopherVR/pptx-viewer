import { describe, expect, it } from 'vitest';

import {
	buildSlidePaneContextMenuEntries,
	slidePaneContextMenuLabelKey,
} from './slide-pane-context-menu';

function ids(entries: ReturnType<typeof buildSlidePaneContextMenuEntries>) {
	return entries.map((e) => e.id);
}

describe('buildSlidePaneContextMenuEntries', () => {
	it('offers New Slide, Duplicate, Delete, Layout, Hide, Add Section in order', () => {
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: 1,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		});
		expect(ids(entries)).toStrictEqual([
			'new-slide',
			'duplicate',
			'delete',
			'layout',
			'hide',
			'add-section',
		]);
	});

	it('uses the singular labels for a single-slide selection', () => {
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: 1,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		});
		expect(entries.find((e) => e.id === 'duplicate')?.labelKey).toBe(
			slidePaneContextMenuLabelKey('duplicate'),
		);
		expect(entries.find((e) => e.id === 'delete')?.countLabelKey).toBeUndefined();
	});

	it('switches Duplicate/Delete to their {{count}} labels for a multi-selection', () => {
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: 3,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		});
		expect(entries.find((e) => e.id === 'duplicate')?.labelKey).toBe(
			'pptx.slidesPane.contextMenu.duplicateCount',
		);
		expect(entries.find((e) => e.id === 'delete')?.labelKey).toBe(
			'pptx.slidesPane.contextMenu.deleteCount',
		);
	});

	it('labels the toggle "Show" only when every selected slide is already hidden', () => {
		const allHidden = buildSlidePaneContextMenuEntries({
			selectedCount: 2,
			hasHiddenInSelection: true,
			hasVisibleInSelection: false,
			wouldDeleteAllSlides: false,
		});
		expect(allHidden.find((e) => e.id === 'hide')?.labelKey).toBe(
			'pptx.slidesPane.contextMenu.show',
		);

		const mixed = buildSlidePaneContextMenuEntries({
			selectedCount: 2,
			hasHiddenInSelection: true,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		});
		expect(mixed.find((e) => e.id === 'hide')?.labelKey).toBe('pptx.slidesPane.contextMenu.hide');
	});

	it('disables Delete when it would remove every slide', () => {
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: 1,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: true,
		});
		expect(entries.find((e) => e.id === 'delete')?.disabled).toBeTruthy();
	});

	it('disables Layout and Add Section for a multi-selection (both act on one slide)', () => {
		const entries = buildSlidePaneContextMenuEntries({
			selectedCount: 2,
			hasHiddenInSelection: false,
			hasVisibleInSelection: true,
			wouldDeleteAllSlides: false,
		});
		expect(entries.find((e) => e.id === 'layout')?.disabled).toBeTruthy();
		expect(entries.find((e) => e.id === 'add-section')?.disabled).toBeTruthy();
	});
});
