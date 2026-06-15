import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { RemotePresence } from '../composables/useCollaboration';
import FollowModeBar from './FollowModeBar.vue';

function presence(over: Partial<RemotePresence>): RemotePresence {
	return {
		clientId: 1,
		userName: 'Ada',
		color: '#ff0000',
		selectionIds: [],
		activeSlide: 0,
		...over,
	};
}

function mountBar(presences: RemotePresence[], followedClientId: number | null = null) {
	return mount(FollowModeBar, { props: { presences, followedClientId } });
}

describe('followModeBar', () => {
	it('renders nothing when there are no peers', () => {
		const wrapper = mountBar([]);
		expect(wrapper.find('.pptx-vue-follow-bar').exists()).toBeFalsy();
	});

	it('lists one chip per active peer', () => {
		const wrapper = mountBar([
			presence({ clientId: 2, userName: 'Bob' }),
			presence({ clientId: 3, userName: 'Carol' }),
		]);
		expect(wrapper.findAll('.pptx-vue-follow-peer')).toHaveLength(2);
	});

	it('emits follow with the clientId when a peer is selected', async () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob' })]);
		await wrapper.get('[data-client-id="2"]').trigger('click');
		expect(wrapper.emitted('follow')).toStrictEqual([[2]]);
	});

	it('emits follow with null when clicking the followed peer (toggle off)', async () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob' })], 2);
		await wrapper.get('[data-client-id="2"]').trigger('click');
		expect(wrapper.emitted('follow')).toStrictEqual([[null]]);
	});

	it('shows who is being followed and marks the chip pressed', () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob' })], 2);
		expect(wrapper.get('.pptx-vue-follow-status').text()).toContain('Bob');
		expect(wrapper.get('[data-client-id="2"]').attributes('aria-pressed')).toBe('true');
		expect(wrapper.get('[data-client-id="2"]').classes()).toContain('is-following');
	});

	it('emits follow null from the Stop button', async () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob' })], 2);
		await wrapper.get('.pptx-vue-follow-stop').trigger('click');
		expect(wrapper.emitted('follow')).toStrictEqual([[null]]);
	});

	it('shows a prompt when not following anyone', () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob' })]);
		expect(wrapper.get('.pptx-vue-follow-status').text()).toContain('Follow a collaborator');
		expect(wrapper.find('.pptx-vue-follow-stop').exists()).toBeFalsy();
	});

	it('renders initials avatars in the peer color', () => {
		const wrapper = mountBar([presence({ clientId: 2, userName: 'Bob Jones', color: '#00ff00' })]);
		const avatar = wrapper.get('.pptx-vue-follow-avatar');
		expect(avatar.text()).toBe('BJ');
		expect(avatar.attributes('style')).toContain('background-color: #00ff00');
	});
});
