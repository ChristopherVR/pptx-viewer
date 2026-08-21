import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import GroupInfoSection from './GroupInfoSection.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function group(children: PptxElement[] | undefined): PptxElement {
	return { type: 'group', id: 'g1', x: 0, y: 0, width: 100, height: 50, children } as PptxElement;
}

function mountSection(el: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(GroupInfoSection, { target, props: { el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('groupInfoSection', () => {
	it('shows the child count for a group with children', () => {
		const target = mountSection(group([{ id: 'a' } as PptxElement, { id: 'b' } as PptxElement]));
		expect(target.textContent).toContain('2');
		expect(target.textContent).toContain('children');
	});

	it('falls back to a generic label when children is not an array', () => {
		const target = mountSection(group(undefined));
		expect(target.textContent).toContain('Grouped element');
	});
});
