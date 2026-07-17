import { mount } from '@vue/test-utils';
import type { PptxTagCollection } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import TagsSection from './TagsSection.vue';

/**
 * TagsSection (Vue): collapsible TAGS card mirroring React's
 * `inspector/TagsSection.tsx` (collapsed by default, flattened editable
 * name/value rows, per-row delete, Add-tag button).
 */
function collections(): PptxTagCollection[] {
	return [
		{
			path: 'ppt/tags/tag1.xml',
			tags: [
				{ name: 'DECK_ID', value: 'deck-123' },
				{ name: 'OWNER', value: 'alice' },
			],
		},
		{ path: 'ppt/tags/tag2.xml', tags: [{ name: 'REVIEWED', value: 'yes' }] },
	];
}

/** The header toggle is the first button (collapsed by default like React). */
async function expand(wrapper: {
	findAll: (selector: 'button') => Array<{ trigger: (event: string) => Promise<void> }>;
}) {
	await wrapper.findAll('button')[0].trigger('click');
}

describe('tagsSection', () => {
	it('renders collapsed with the Tags heading and flattened tag count', () => {
		const wrapper = mount(TagsSection, { props: { tagCollections: collections() } });
		expect(wrapper.text()).toContain('Tags');
		expect(wrapper.text()).toContain('3');
		expect(wrapper.find('input').exists()).toBeFalsy();
	});

	it('expands to editable name/value rows across every collection', async () => {
		const wrapper = mount(TagsSection, { props: { tagCollections: collections() } });
		await expand(wrapper);
		const inputs = wrapper.findAll('input');
		expect(inputs).toHaveLength(6);
		expect((inputs[0].element as HTMLInputElement).value).toBe('DECK_ID');
		expect((inputs[5].element as HTMLInputElement).value).toBe('yes');
	});

	it('shows the no-tags placeholder when every collection is empty', async () => {
		const wrapper = mount(TagsSection, { props: { tagCollections: [] } });
		await expand(wrapper);
		expect(wrapper.text()).toContain('No tags');
	});

	it('emits an update with the edited value, only touching the owning collection', async () => {
		const wrapper = mount(TagsSection, { props: { tagCollections: collections() } });
		await expand(wrapper);
		// Row 3 (collection 2) value input.
		await wrapper.findAll('input')[5].setValue('no');
		const next = wrapper.emitted('update')?.[0]?.[0] as PptxTagCollection[];
		expect(next[1].tags[0]).toStrictEqual({ name: 'REVIEWED', value: 'no' });
		expect(next[0]).toStrictEqual(collections()[0]);
	});

	it('deletes a row via its trash button', async () => {
		const wrapper = mount(TagsSection, { props: { tagCollections: collections() } });
		await expand(wrapper);
		await wrapper.get('button[title="Delete tag"]').trigger('click');
		const next = wrapper.emitted('update')?.[0]?.[0] as PptxTagCollection[];
		expect(next[0].tags).toStrictEqual([{ name: 'OWNER', value: 'alice' }]);
	});

	it('adds an empty row to the first collection (creating one when none exist)', async () => {
		const withTags = mount(TagsSection, { props: { tagCollections: collections() } });
		await expand(withTags);
		const addButton = withTags.findAll('button').find((b) => b.text() === 'Add tag');
		await addButton!.trigger('click');
		const appended = withTags.emitted('update')?.[0]?.[0] as PptxTagCollection[];
		expect(appended[0].tags).toHaveLength(3);
		expect(appended[0].tags[2]).toStrictEqual({ name: '', value: '' });

		const empty = mount(TagsSection, { props: { tagCollections: [] } });
		await expand(empty);
		const emptyAdd = empty.findAll('button').find((b) => b.text() === 'Add tag');
		await emptyAdd!.trigger('click');
		expect(empty.emitted('update')?.[0]?.[0]).toStrictEqual([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: '', value: '' }] },
		]);
	});

	it('is read-only without edit rights: disabled inputs, no delete or add buttons', async () => {
		const wrapper = mount(TagsSection, {
			props: { tagCollections: collections(), canEdit: false },
		});
		await expand(wrapper);
		expect(
			wrapper.findAll('input').every((i) => i.attributes('disabled') !== undefined),
		).toBeTruthy();
		expect(wrapper.find('button[title="Delete tag"]').exists()).toBeFalsy();
		expect(wrapper.findAll('button').some((b) => b.text() === 'Add tag')).toBeFalsy();
	});
});
