import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createSectionActions } from './editor-section-actions';

const slides = Array.from({ length: 3 }, (_, index) => ({
	id: `slide-${index + 1}`,
	rId: `rId-${index + 1}`,
	slideNumber: index + 1,
	elements: [],
})) as PptxSlide[];

describe('section actions', () => {
	it('adds, renames, reorders, collapses, and deletes sections', () => {
		const store = createStore({ ...createInitialViewerState(), slides, editable: true });
		const pushHistory = vi.fn();
		const commitChange = vi.fn();
		const actions = createSectionActions(store, { pushHistory, commitChange });

		const firstId = actions.addSection('Opening', 0);
		const secondId = actions.addSection('Details', 1);
		expect(firstId).toBeTruthy();
		expect(secondId).toBeTruthy();
		expect(store.get().sections.map((section) => section.name)).toStrictEqual([
			'Opening',
			'Details',
		]);

		actions.renameSection(secondId!, 'Body');
		actions.moveSection(secondId!, 'up');
		actions.toggleSection(secondId!);
		expect(store.get().sections[0]).toMatchObject({ id: secondId, name: 'Body', collapsed: true });

		actions.moveSection(secondId!, 'down');
		actions.deleteSection(secondId!);
		expect(store.get().sections).toHaveLength(1);
		expect(store.get().slides.every((slide) => slide.sectionId === firstId)).toBeTruthy();
		expect(pushHistory).toHaveBeenCalledTimes(6);
		expect(commitChange).toHaveBeenCalledTimes(6);
	});

	it('does not mutate sections when editing is disabled', () => {
		const store = createStore({ ...createInitialViewerState(), slides });
		const actions = createSectionActions(store, {
			pushHistory: vi.fn(),
			commitChange: vi.fn(),
		});
		expect(actions.addSection('Blocked', 0)).toBeNull();
		expect(store.get().sections).toStrictEqual([]);
	});

	it('restores sections and slide membership through editor history', () => {
		const store = createStore({ ...createInitialViewerState(), slides, editable: true });
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSectionActions(store, ops);

		actions.addSection('Opening', 0);
		expect(store.get().sections).toHaveLength(1);
		ops.undo();
		expect(store.get().sections).toStrictEqual([]);
		expect(store.get().slides.every((slide) => slide.sectionId === undefined)).toBeTruthy();
	});
});
