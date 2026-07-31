import { mount } from '@vue/test-utils';
import {
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathPresetById,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../../i18n';
import MotionPathRow from './MotionPathRow.vue';

function mountRow(props: Record<string, unknown> = {}) {
	return mount(MotionPathRow, { props });
}

/**
 * MotionPathRow: the animation panel's motion-path picker.
 *
 * The interesting behaviour is the "Custom Path" marker: a hand-dragged path
 * matches no catalogue entry, and the select must report that rather than
 * snapping back to whichever preset the drag started from (which would
 * misreport what is going to play).
 */
describe('motionPathRow', () => {
	it('offers no motion path plus every catalogue preset, grouped by family', () => {
		const wrapper = mountRow();
		const select = wrapper.get('select');

		expect(select.findAll('optgroup').map((group) => group.attributes('label'))).toStrictEqual(
			MOTION_PATH_FAMILIES.map(
				(family) => translationsEn[`pptx.animation.motionPath.family.${family}`],
			),
		);
		const options = select.findAll('option');
		expect(options).toHaveLength(MOTION_PATH_PRESETS.length + 1);
		expect(options[0].text()).toBe(translationsEn['pptx.animation.motionPath.none']);
		expect(options[0].attributes('value')).toBe('none');
	});

	it('labels the row and selects "none" when the element has no path', () => {
		const wrapper = mountRow();
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.motionPath.label']);
		expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('none');
		// The drag hint only makes sense once something is drawn on the canvas.
		expect(wrapper.text()).not.toContain(translationsEn['pptx.animation.motionPath.editHint']);
	});

	it('selects the matching preset and shows the drag hint for a catalogue path', () => {
		const preset = motionPathPresetById('arcUp');
		const wrapper = mountRow({ motionPath: preset?.path });

		expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('arcUp');
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.motionPath.editHint']);
		// "Custom Path" is not on offer while a catalogue path is applied.
		expect(wrapper.findAll('option').map((option) => option.attributes('value'))).not.toContain(
			'custom',
		);
	});

	it('surfaces a hand-dragged path as a selected "Custom Path" option', () => {
		const wrapper = mountRow({ motionPath: 'M 0 0 L 0.37 0.11' });
		const custom = wrapper.findAll('option').find((o) => o.attributes('value') === 'custom');

		expect(custom?.text()).toBe(translationsEn['pptx.animation.motionPath.custom']);
		expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('custom');
	});

	it('emits the chosen preset id, and "none" to clear', async () => {
		const wrapper = mountRow({ motionPath: 'M 0 0 L 0.25 0' });
		const select = wrapper.get('select');

		await select.setValue('circle');
		await select.setValue('none');

		expect(wrapper.emitted('change')).toStrictEqual([['circle'], ['none']]);
	});

	it('disables the picker when editing is not allowed', () => {
		const wrapper = mountRow({ canEdit: false });
		expect(wrapper.get('select').attributes('disabled')).toBeDefined();
	});
});
