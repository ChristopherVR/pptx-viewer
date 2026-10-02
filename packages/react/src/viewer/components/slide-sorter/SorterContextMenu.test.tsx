// @vitest-environment happy-dom
/**
 * #397: the sorter tile menu renders the shared command list: Copy, Paste
 * (only with a clipboard), Duplicate, one Hide/Show toggle, Delete.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SorterContextMenu } from './SorterContextMenu';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function mount(overrides: Partial<React.ComponentProps<typeof SorterContextMenu>> = {}) {
	const handlers = {
		onDelete: vi.fn(),
		onDuplicate: vi.fn(),
		onCopy: vi.fn(),
		onPaste: vi.fn(),
		onToggleHide: vi.fn(),
		onClose: vi.fn(),
	};
	act(() =>
		root.render(
			<SorterContextMenu
				x={10}
				y={10}
				selectedCount={1}
				totalSlides={4}
				hasClipboard={false}
				hasHiddenInSelection={false}
				hasVisibleInSelection
				sectionGroups={[]}
				{...handlers}
				{...overrides}
			/>,
		),
	);
	return handlers;
}

const items = (): HTMLButtonElement[] =>
	Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
const labels = (): (string | null)[] => items().map((candidate) => candidate.textContent);

describe('react sorter context menu', () => {
	it('offers Copy, Duplicate, Hide and Delete, and Paste only with a clipboard', () => {
		mount();
		expect(container.querySelector('[role="menu"]')).not.toBeNull();
		expect(labels()).toStrictEqual([
			'pptx.slideSorter.contextMenu.copy',
			'pptx.slideSorter.contextMenu.duplicate',
			'pptx.slideSorter.contextMenu.hideSlides',
			'pptx.slideSorter.contextMenu.delete',
		]);
		mount({ hasClipboard: true });
		expect(labels()).toContain('pptx.slideSorter.contextMenu.paste');
	});

	it('shows one Show entry when every selected slide is hidden', () => {
		mount({ hasHiddenInSelection: true, hasVisibleInSelection: false });
		expect(labels()).toContain('pptx.slideSorter.contextMenu.showSlides');
		expect(labels()).not.toContain('pptx.slideSorter.contextMenu.hideSlides');
	});

	it('appends the count on a multi-selection and refuses to delete every slide', () => {
		mount({ selectedCount: 2 });
		expect(labels()[0]).toBe('pptx.slideSorter.contextMenu.copy (2)');
		mount({ selectedCount: 4, totalSlides: 4 });
		const remove = items().find((candidate) => candidate.textContent?.includes('delete'));
		expect(remove?.disabled).toBeTruthy();
	});

	it('routes each command to its handler', () => {
		const handlers = mount({ hasClipboard: true });
		for (const candidate of items()) {
			act(() => candidate.click());
		}
		expect(handlers.onCopy).toHaveBeenCalledOnce();
		expect(handlers.onPaste).toHaveBeenCalledOnce();
		expect(handlers.onDuplicate).toHaveBeenCalledOnce();
		expect(handlers.onToggleHide).toHaveBeenCalledOnce();
		expect(handlers.onDelete).toHaveBeenCalledOnce();
	});
});
