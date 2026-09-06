import { mount } from '@vue/test-utils';
import { EFFECT_SOUND_CATALOGUE } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

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

	it('lists all 19 stock sounds plus None and Other Sound', () => {
		const wrapper = mountRow();
		const select = wrapper.get('select').element as HTMLSelectElement;
		// none + 19 stock entries + other = 21
		expect(select.options).toHaveLength(21);
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.sound.chime']);
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.sound.other']);
	});

	it('shows the picked custom file name once a non-stock sound is set', () => {
		const wrapper = mountRow({ soundState: { hasSound: true, fileName: 'chime.mp3' } });
		const select = wrapper.get('select').element as HTMLSelectElement;
		expect(select.value).toBe('current');
		expect(select.options[1].textContent).toBe('chime.mp3');
	});

	it('falls back to the generic "Choose sound file..." label with no file name', () => {
		const wrapper = mountRow({ soundState: { hasSound: true } });
		const select = wrapper.get('select').element as HTMLSelectElement;
		expect(select.options[1].textContent).toBe(translationsEn['pptx.animation.sound.custom']);
	});

	it('shows the matching stock entry selected when catalogueId is set', () => {
		const wrapper = mountRow({
			soundState: { hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime' },
		});
		const select = wrapper.get('select').element as HTMLSelectElement;
		expect(select.value).toBe('chime');
	});

	it('emits pick(undefined) when "No Sound" is chosen', async () => {
		const wrapper = mountRow({ soundState: { hasSound: true, fileName: 'x.mp3' } });
		await wrapper.get('select').setValue('none');
		expect(wrapper.emitted('pick')).toStrictEqual([[undefined]]);
	});

	it('emits pickStock with the catalogue id when a stock entry is chosen', async () => {
		const wrapper = mountRow();
		await wrapper.get('select').setValue('chime');
		expect(wrapper.emitted('pickStock')).toStrictEqual([['chime']]);
	});

	it('opens the hidden file input when "Other Sound..." is chosen', async () => {
		const wrapper = mountRow();
		const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
		const clickSpy = vi.spyOn(input, 'click');
		await wrapper.get('select').setValue('other');
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('accepts only audio files', () => {
		const wrapper = mountRow();
		expect(wrapper.get('input[type="file"]').attributes('accept')).toBe('audio/*');
	});

	it('disables the preview button unless a stock sound is selected', () => {
		const wrapper = mountRow();
		const button = wrapper.get('button').element as HTMLButtonElement;
		expect(button.disabled).toBeTruthy();
	});

	it('enables the preview button for a selected stock sound and does not throw on click', async () => {
		const wrapper = mountRow({
			soundState: { hasSound: true, fileName: 'CHIMES.WAV', catalogueId: 'chime' },
		});
		const button = wrapper.get('button').element as HTMLButtonElement;
		expect(button.disabled).toBeFalsy();
		await expect(wrapper.get('button').trigger('click')).resolves.not.toThrow();
	});

	it('exposes every catalogue id as a select option', () => {
		const wrapper = mountRow();
		const values = Array.from((wrapper.get('select').element as HTMLSelectElement).options).map(
			(o) => o.value,
		);
		for (const entry of EFFECT_SOUND_CATALOGUE) {
			expect(values).toContain(entry.id);
		}
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
