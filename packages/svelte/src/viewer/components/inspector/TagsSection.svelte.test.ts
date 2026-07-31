import type { PptxTagCollection } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TagsSection from './TagsSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountSection(
	tagCollections: PptxTagCollection[],
	canEdit = true,
): { target: HTMLElement; onupdate: ReturnType<typeof vi.fn> } {
	const onupdate = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TagsSection, { target, props: { tagCollections, canEdit, onupdate } });
	flushSync();
	// Disclosure is collapsed by default (React parity); open it for assertions.
	const details = target.querySelector('details');
	if (details) {
		details.open = true;
		flushSync();
	}
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onupdate };
}

const twoTags: PptxTagCollection[] = [
	{
		path: 'ppt/tags/tag1.xml',
		tags: [
			{ name: 'OWNER', value: 'finance' },
			{ name: 'STAGE', value: 'draft' },
		],
	},
];

describe('tagsSection', () => {
	it('shows the tag count in the summary and a row per tag', () => {
		const { target } = mountSection(twoTags);

		expect(target.querySelector('summary b')?.textContent).toBe('2');
		expect(target.querySelectorAll('.pptx-svelte-tags-row')).toHaveLength(2);
	});

	it('shows the empty note for a deck with no tag parts', () => {
		const { target } = mountSection([]);

		expect(target.querySelector('.pptx-svelte-tags-empty')?.textContent).toBe('No tags');
		expect(target.querySelectorAll('.pptx-svelte-tags-row')).toHaveLength(0);
	});

	it('emits an updated collection when a tag value is edited', () => {
		const { target, onupdate } = mountSection(twoTags);

		const value = target.querySelectorAll<HTMLInputElement>('.pptx-svelte-tags-row input')[1];
		value.value = 'legal';
		value.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(onupdate).toHaveBeenCalledWith([
			{
				path: 'ppt/tags/tag1.xml',
				tags: [
					{ name: 'OWNER', value: 'legal' },
					{ name: 'STAGE', value: 'draft' },
				],
			},
		]);
	});

	it('deletes the addressed tag', () => {
		const { target, onupdate } = mountSection(twoTags);

		target.querySelector<HTMLButtonElement>('.pptx-svelte-tags-delete')?.click();
		flushSync();

		expect(onupdate).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'STAGE', value: 'draft' }] },
		]);
	});

	it('creates the default tag part when adding to a deck with none', () => {
		const { target, onupdate } = mountSection([]);

		target.querySelector<HTMLButtonElement>('.pptx-svelte-tags-add')?.click();
		flushSync();

		expect(onupdate).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: '', value: '' }] },
		]);
	});

	it('hides the add/delete affordances in a read-only viewer', () => {
		const { target } = mountSection(twoTags, false);

		expect(target.querySelector('.pptx-svelte-tags-add')).toBeNull();
		expect(target.querySelector('.pptx-svelte-tags-delete')).toBeNull();
	});
});
