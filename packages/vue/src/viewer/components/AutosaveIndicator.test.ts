import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { AutosaveStatus } from '../composables/useAutosave';
import AutosaveIndicator from './AutosaveIndicator.vue';

function mountPill(status: AutosaveStatus, isDirty: boolean) {
	return mount(AutosaveIndicator, { props: { status, isDirty } });
}

describe('autosaveIndicator', () => {
	it('shows "Saving…" while a save is in flight', () => {
		const wrapper = mountPill('saving', true);
		expect(wrapper.text()).toContain('Saving…');
		expect(wrapper.classes()).toContain('pptx-vue-autosave--saving');
		expect(wrapper.find('.pptx-vue-autosave__spinner').exists()).toBeTruthy();
	});

	it('shows "Saved" after a clean successful save', () => {
		const wrapper = mountPill('saved', false);
		expect(wrapper.text()).toContain('Saved');
		expect(wrapper.classes()).toContain('pptx-vue-autosave--saved');
	});

	it('shows "Unsaved changes" when dirty and idle', () => {
		const wrapper = mountPill('idle', true);
		expect(wrapper.text()).toContain('Unsaved changes');
		expect(wrapper.classes()).toContain('pptx-vue-autosave--dirty');
	});

	it('prefers the dirty state over a previous saved status', () => {
		const wrapper = mountPill('saved', true);
		expect(wrapper.text()).toContain('Unsaved changes');
		expect(wrapper.classes()).toContain('pptx-vue-autosave--dirty');
	});

	it('shows the error label when a save fails', () => {
		const wrapper = mountPill('error', true);
		expect(wrapper.text()).toContain('Save failed');
		expect(wrapper.classes()).toContain('pptx-vue-autosave--error');
	});

	it('exposes a polite live region for assistive tech', () => {
		const wrapper = mountPill('saving', true);
		expect(wrapper.attributes('role')).toBe('status');
		expect(wrapper.attributes('aria-live')).toBe('polite');
	});
});
