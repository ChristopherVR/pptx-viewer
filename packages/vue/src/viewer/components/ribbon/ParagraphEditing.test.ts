/**
 * Home > Paragraph and Editing: the Vue adapters reflect state into the shared
 * strips and keep the native text-style edit and the find-panel toggle.
 */
import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import EditingSection from './EditingSection.vue';
import ParagraphGroup from './ParagraphGroup.vue';

registerPptxWebControls();

const textElement = (textStyle: Record<string, unknown>) =>
	({
		type: 'text',
		id: 'para',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text: 'Hello',
		textStyle,
	}) as never;

describe('vue paragraph group', () => {
	it('reflects alignment, applies edits and stays inert when read-only', async () => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mount(ParagraphGroup, {
			props: {
				canEdit: true,
				selectedElement: textElement({ align: 'center', paragraphMarginLeft: 30 }),
				onUpdateTextStyle,
			},
		});
		const button = (id: string) =>
			wrapper.element.querySelector<HTMLButtonElement>(
				`[data-ribbon-control="home.paragraph.${id}"]`,
			)!;
		expect(button('alignCenter').getAttribute('aria-pressed')).toBe('true');
		button('alignRight').click();
		button('decreaseIndent').click();
		expect(onUpdateTextStyle.mock.calls).toStrictEqual([
			[{ align: 'right' }],
			[{ paragraphMarginLeft: 6 }],
		]);
		await wrapper.setProps({ canEdit: false });
		expect(button('alignLeft').disabled).toBeTruthy();
		button('alignLeft').click();
		expect(onUpdateTextStyle).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});
});

describe('vue editing section', () => {
	it('opens the find panel from both Find and Replace', () => {
		const onToggleFindReplace = vi.fn();
		const wrapper = mount(EditingSection, { props: { onToggleFindReplace } });
		for (const id of ['find', 'replace']) {
			wrapper.element
				.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.editing.${id}"]`)!
				.click();
		}
		expect(onToggleFindReplace).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});
});
