import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import RehearseTimingsHud from './RehearseTimingsHud.vue';

function mountHud(props: Partial<Record<string, unknown>> = {}) {
	return mount(RehearseTimingsHud, {
		props: {
			slideElapsedMs: 65000,
			totalElapsedMs: 605000,
			paused: false,
			...props,
		},
	});
}

describe('rehearseTimingsHud', () => {
	it('formats slide and total elapsed times', () => {
		const wrapper = mountHud();
		expect(wrapper.find('[data-testid="rehearse-slide-time"]').text()).toBe('1:05');
		expect(wrapper.find('[data-testid="rehearse-total-time"]').text()).toBe('10:05');
	});

	it('shows the pause glyph when running and play when paused', () => {
		const running = mountHud({ paused: false });
		expect(running.find('.pptx-vue-rehearse-pause').attributes('aria-label')).toBe('Pause');

		const paused = mountHud({ paused: true });
		expect(paused.find('.pptx-vue-rehearse-pause').attributes('aria-label')).toBe('Resume');
	});

	it('emits toggle-pause when the button is clicked', async () => {
		const wrapper = mountHud();
		await wrapper.find('.pptx-vue-rehearse-pause').trigger('click');
		expect(wrapper.emitted('toggle-pause')).toHaveLength(1);
	});
});
