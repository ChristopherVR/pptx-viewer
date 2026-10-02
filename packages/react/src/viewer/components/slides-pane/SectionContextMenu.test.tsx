// @vitest-environment happy-dom
/**
 * #397: the section-header menu renders the shared command list (Rename,
 * Delete, Move Up, Move Down, Add Section After) with end-of-list gating.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SlideSectionGroup } from '../../types';
import { SectionContextMenu } from './SectionContextMenu';

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

const groups = [
	{ id: 'a', label: 'Intro', slideIndexes: [0, 1] },
	{ id: 'b', label: 'Body', slideIndexes: [2] },
] as unknown as SlideSectionGroup[];

function mount(sectionIndex: number) {
	const handlers = {
		onStartRename: vi.fn(),
		onDeleteSection: vi.fn(),
		onMoveSectionUp: vi.fn(),
		onMoveSectionDown: vi.fn(),
		onAddSection: vi.fn(),
		onClose: vi.fn(),
	};
	act(() =>
		root.render(
			<SectionContextMenu
				state={{ x: 5, y: 5, sectionId: groups[sectionIndex].id, sectionIndex, totalSections: 2 }}
				sectionGroups={groups}
				totalSlides={3}
				{...handlers}
			/>,
		),
	);
	return handlers;
}

const items = (): HTMLButtonElement[] =>
	Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
const item = (label: string): HTMLButtonElement =>
	items().find((candidate) => candidate.textContent === label)!;

describe('react section context menu', () => {
	it('renders the shared command list as a role="menu"', () => {
		mount(0);
		expect(container.querySelector('[role="menu"]')).not.toBeNull();
		expect(items().map((candidate) => candidate.textContent)).toStrictEqual([
			'pptx.sections.rename',
			'pptx.sections.delete',
			'pptx.sections.moveUp',
			'pptx.sections.moveDown',
			'pptx.sections.addAfter',
		]);
	});

	it('disables Move Up on the first section and Move Down on the last', () => {
		mount(0);
		expect(item('pptx.sections.moveUp').disabled).toBeTruthy();
		expect(item('pptx.sections.moveDown').disabled).toBeFalsy();
		mount(1);
		expect(item('pptx.sections.moveUp').disabled).toBeFalsy();
		expect(item('pptx.sections.moveDown').disabled).toBeTruthy();
	});

	it('routes the commands and adds a section after the section last slide', () => {
		const handlers = mount(0);
		act(() => item('pptx.sections.rename').click());
		expect(handlers.onStartRename).toHaveBeenCalledWith('a', 'Intro');
		act(() => item('pptx.sections.delete').click());
		expect(handlers.onDeleteSection).toHaveBeenCalledWith('a');
		act(() => item('pptx.sections.moveDown').click());
		expect(handlers.onMoveSectionDown).toHaveBeenCalledWith('a');
		act(() => item('pptx.sections.addAfter').click());
		expect(handlers.onAddSection).toHaveBeenCalledWith('pptx.sections.defaultName', 2);
	});
});
