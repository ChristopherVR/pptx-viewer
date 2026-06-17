import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import StatusBar from './StatusBar.vue';

/**
 * StatusBar (Vue port of React's `StatusBar.tsx`) — slide counter, autosave
 * status, view-mode + zoom controls.
 */
describe('statusBar', () => {
	const base = { slideCount: 7, activeSlideIndex: 0, isDirty: false, scale: 1 };

	it('renders the slide counter', () => {
		const wrapper = mount(StatusBar, { props: base });
		expect(wrapper.text()).toContain('Slide 1 of 7');
	});

	it('shows "No slides" when empty', () => {
		const wrapper = mount(StatusBar, { props: { ...base, slideCount: 0 } });
		expect(wrapper.text()).toContain('No slides');
	});

	it('reflects autosave + dirty state', () => {
		expect(mount(StatusBar, { props: base }).text()).toContain('All saved');
		expect(mount(StatusBar, { props: { ...base, isDirty: true } }).text()).toContain(
			'Unsaved changes',
		);
		expect(mount(StatusBar, { props: { ...base, autosaveStatus: 'saving' } }).text()).toContain(
			'Saving',
		);
	});

	it('renders the zoom percentage and emits zoom events', async () => {
		const wrapper = mount(StatusBar, { props: { ...base, scale: 1.25 } });
		expect(wrapper.text()).toContain('125%');
		await wrapper.get('[aria-label="Zoom in"]').trigger('click');
		await wrapper.get('[aria-label="Zoom out"]').trigger('click');
		expect(wrapper.emitted('zoom-in')).toHaveLength(1);
		expect(wrapper.emitted('zoom-out')).toHaveLength(1);
	});

	it('emits set-mode for the view buttons', async () => {
		const wrapper = mount(StatusBar, { props: base });
		await wrapper.get('[aria-label="Slide show"]').trigger('click');
		expect(wrapper.emitted('set-mode')?.[0]).toStrictEqual(['present']);
	});

	it('only shows the Notes toggle when enabled', () => {
		expect(
			mount(StatusBar, { props: base }).find('[aria-label="Toggle notes"]').exists(),
		).toBeFalsy();
		expect(
			mount(StatusBar, { props: { ...base, showNotes: true } })
				.find('[aria-label="Toggle notes"]')
				.exists(),
		).toBeTruthy();
	});
});
