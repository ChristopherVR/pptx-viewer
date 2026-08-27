import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../../i18n';
import EffectSoundRow from './EffectSoundRow.vue';

function mountRow(props: Record<string, unknown> = {}) {
	return mount(EffectSoundRow, { props: { soundState: { hasSound: false }, ...props } });
}

describe('effectSoundRow', () => {
	it('labels the row and defaults to "No Sound"', () => {
		const wrapper = mountRow();
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.sound']);
		expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('none');
	});

	it('shows the picked file name once a sound is set', () => {
		const wrapper = mountRow({ soundState: { hasSound: true, fileName: 'chime.mp3' } });
		const select = wrapper.get('select').element as HTMLSelectElement;
		expect(select.value).toBe('custom');
		expect(select.options[1].textContent).toBe('chime.mp3');
	});

	it('falls back to the generic "Choose sound file..." label with no file name', () => {
		const wrapper = mountRow({ soundState: { hasSound: true } });
		const select = wrapper.get('select').element as HTMLSelectElement;
		expect(select.options[1].textContent).toBe(translationsEn['pptx.animation.sound.custom']);
	});

	it('emits pick(undefined) when "No Sound" is chosen', async () => {
		const wrapper = mountRow({ soundState: { hasSound: true, fileName: 'x.mp3' } });
		await wrapper.get('select').setValue('none');
		expect(wrapper.emitted('pick')).toStrictEqual([[undefined]]);
	});

	it('accepts only audio files', () => {
		const wrapper = mountRow();
		expect(wrapper.get('input[type="file"]').attributes('accept')).toBe('audio/*');
	});

	it('stages a picked file as a data: URL', async () => {
		const wrapper = mountRow();
		const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
		const file = new File(['abc'], 'chime.mp3', { type: 'audio/mpeg' });
		Object.defineProperty(input, 'files', { value: [file] });
		await wrapper.get('input[type="file"]').trigger('change');

		for (let attempt = 0; attempt < 50 && !wrapper.emitted('pick'); attempt++) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}

		const emitted = wrapper.emitted('pick');
		expect(emitted).toHaveLength(1);
		const [pick] = emitted![0] as [{ dataUrl: string; fileName?: string } | undefined];
		expect(pick?.fileName).toBe('chime.mp3');
		expect(pick?.dataUrl).toMatch(/^data:/u);
	});
});
