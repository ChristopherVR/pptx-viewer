import { mount } from '@vue/test-utils';
import type { ConnectionStatus } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import CollaborationStatusIndicator from './CollaborationStatusIndicator.vue';

function mountIndicator(status: ConnectionStatus, connectedCount = 1) {
	return mount(CollaborationStatusIndicator, { props: { status, connectedCount } });
}

describe('collaborationStatusIndicator', () => {
	it('shows a participant count when connected', () => {
		const wrapper = mountIndicator('connected', 3);
		expect(wrapper.text()).toContain('3 people here');
	});

	it('uses singular wording for one participant', () => {
		const wrapper = mountIndicator('connected', 1);
		expect(wrapper.text()).toContain('1 person here');
	});

	it('shows a status label when not connected', () => {
		expect(mountIndicator('connecting').text()).toContain('Connecting');
		expect(mountIndicator('disconnected').text()).toContain('Disconnected');
		expect(mountIndicator('error').text()).toContain('Connection error');
	});

	it('only offers a retry control in the error state', async () => {
		const ok = mountIndicator('connected', 2);
		expect(ok.find('button').exists()).toBeFalsy();

		const errored = mountIndicator('error');
		const retry = errored.find('button');
		expect(retry.exists()).toBeTruthy();
		await retry.trigger('click');
		expect(errored.emitted('retry')).toHaveLength(1);
	});
});
