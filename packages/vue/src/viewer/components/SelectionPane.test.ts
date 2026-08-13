import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import SelectionPane from './SelectionPane.vue';

/**
 * Selection Pane rename: double-click a row's name label to edit it inline.
 * Enter / blur commit the trimmed value (empty clears the name), Escape
 * cancels, and an unedited commit must not persist the fallback label.
 */

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp_1',
		x: 10,
		y: 20,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		...overrides,
	} as PptxElement;
}

function mountPane(elements: PptxElement[]) {
	return mount(SelectionPane, {
		props: { elements, selectedIds: [], canEdit: true },
	});
}

describe('selectionPane rename', () => {
	it('stamps the e2e hooks and prefers the element name over the fallback', () => {
		const wrapper = mountPane([shape({ name: 'Hero banner' })]);
		expect(wrapper.find('[data-pptx-selection-pane]').exists()).toBeTruthy();
		const label = wrapper.find('[data-pptx-selection-name]');
		expect(label.text()).toBe('Hero banner');
	});

	it('shows the type fallback when the element has no name', () => {
		const wrapper = mountPane([shape()]);
		expect(wrapper.find('[data-pptx-selection-name]').text()).toBe('Shape 1');
	});

	it('opens an inline input on double-click and commits with Enter', async () => {
		const wrapper = mountPane([shape({ name: 'Old name' })]);
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');

		const input = wrapper.find('input[type="text"]');
		expect(input.exists()).toBeTruthy();
		expect(input.attributes('aria-label')).toBe('Rename element');
		expect((input.element as HTMLInputElement).value).toBe('Old name');

		await input.setValue('  New name  ');
		await input.trigger('keydown.enter');

		expect(wrapper.emitted('rename')).toHaveLength(1);
		expect(wrapper.emitted('rename')?.[0]).toStrictEqual([{ id: 'sp_1', name: 'New name' }]);
		expect(wrapper.find('input[type="text"]').exists()).toBeFalsy();
	});

	it('cancels with Escape without emitting', async () => {
		const wrapper = mountPane([shape({ name: 'Keep me' })]);
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');

		const input = wrapper.find('input[type="text"]');
		await input.setValue('discarded');
		await input.trigger('keydown.escape');

		expect(wrapper.emitted('rename')).toBeUndefined();
		expect(wrapper.find('input[type="text"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-pptx-selection-name]').text()).toBe('Keep me');
	});

	it('commits on blur and clears the name when emptied', async () => {
		const wrapper = mountPane([shape({ name: 'Named' })]);
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');

		const input = wrapper.find('input[type="text"]');
		await input.setValue('   ');
		await input.trigger('blur');

		// An explicit `''`, NOT `undefined`. The save writer reads `undefined` as
		// "the model has no opinion" and leaves `cNvPr/@name` alone, so
		// committing it made clearing a name a no-op that the file never saw.
		expect(wrapper.emitted('rename')?.[0]).toStrictEqual([{ id: 'sp_1', name: '' }]);
	});

	it('does not persist the fallback label on an unedited commit', async () => {
		const wrapper = mountPane([shape()]);
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');

		// Seeded with the "Shape 1" fallback; committing untouched must be a no-op.
		await wrapper.find('input[type="text"]').trigger('blur');
		expect(wrapper.emitted('rename')).toBeUndefined();
	});
});

/**
 * Ending a rename must hand the keyboard back to the viewer root. The viewer
 * listens for `keydown` on that root, so a commit that leaves focus on
 * `document.body` (which is where it lands when the input unmounts) makes the
 * very next Ctrl+Z a no-op: the rename was undoable, but unreachable.
 */
describe('selectionPane rename focus', () => {
	afterEach(() => document.body.replaceChildren());

	/** Mount the pane inside a focusable viewer root, as the real shell renders it. */
	function mountInViewer(): { root: HTMLDivElement; wrapper: ReturnType<typeof mountPane> } {
		const root = document.createElement('div');
		root.setAttribute('tabindex', '0');
		const host = document.createElement('div');
		root.append(host);
		document.body.append(root);
		return {
			root,
			wrapper: mount(SelectionPane, {
				props: { elements: [shape({ name: 'Old name' })], selectedIds: [], canEdit: true },
				attachTo: host,
			}),
		};
	}

	it('returns focus to the viewer root when Enter commits', async () => {
		const { root, wrapper } = mountInViewer();
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');
		expect(document.activeElement).toBe(wrapper.find('input[type="text"]').element);

		await wrapper.find('input[type="text"]').setValue('New name');
		await wrapper.find('input[type="text"]').trigger('keydown.enter');

		expect(document.activeElement).toBe(root);
		expect(wrapper.emitted('rename')).toHaveLength(1);
	});

	it('returns focus to the viewer root when Escape cancels', async () => {
		const { root, wrapper } = mountInViewer();
		await wrapper.find('[data-pptx-selection-name]').trigger('dblclick');
		await wrapper.find('input[type="text"]').trigger('keydown.escape');

		expect(document.activeElement).toBe(root);
		expect(wrapper.emitted('rename')).toBeUndefined();
	});
});
