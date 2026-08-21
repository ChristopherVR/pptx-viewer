import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import OlePropertiesSection from './OlePropertiesSection.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function ole(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'o1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		oleObjectType: 'Excel.Sheet.12',
		isLinked: false,
		...overrides,
	} as PptxElement;
}

function mountSection(el: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(OlePropertiesSection, { target, props: { el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('olePropertiesSection', () => {
	it('shows Embedded status by default', () => {
		const target = mountSection(ole());
		expect(target.textContent).toContain('Embedded');
	});

	it('shows Linked status for a linked object', () => {
		const target = mountSection(ole({ isLinked: true }));
		expect(target.textContent).toContain('Linked');
	});

	it('shows the file name when present', () => {
		const target = mountSection(ole({ fileName: 'budget.xlsx' }));
		expect(target.textContent).toContain('budget.xlsx');
	});

	it('omits the file name row when absent', () => {
		const target = mountSection(ole());
		expect(target.textContent).not.toContain('File Name');
	});
});
