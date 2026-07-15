import { mount } from '@vue/test-utils';
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ShareDialog from './ShareDialog.vue';

const mountOptions = { global: { stubs: { teleport: true } } } as const;

describe('shareDialog', () => {
	it('prefills the fields from the defaults prop', () => {
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			props: {
				open: true,
				defaults: { roomId: 'team-room', userName: 'Ada', serverUrl: 'wss://collab.example.com' },
			},
		});

		const room = wrapper.get('#pptx-vue-share-room').element as HTMLInputElement;
		const name = wrapper.get('#pptx-vue-share-name').element as HTMLInputElement;
		const server = wrapper.get('#pptx-vue-share-server').element as HTMLInputElement;
		expect(room.value).toBe('team-room');
		expect(name.value).toBe('Ada');
		expect(server.value).toBe('wss://collab.example.com');
	});

	it('emits start with a CollaborationConfig incl. the websocket transport', async () => {
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			props: { open: true, defaults: { serverUrl: 'wss://collab.example.com' } },
		});

		await wrapper.get('#pptx-vue-share-room').setValue('  edited-room  ');
		await wrapper.get('#pptx-vue-share-name').setValue('Grace');
		await wrapper.get('.pptx-vue-share-btn-primary').trigger('click');

		const events = wrapper.emitted('start');
		expect(events).toHaveLength(1);
		const config = events![0][0] as CollaborationConfig;
		// A non-empty server URL selects the y-websocket transport.
		expect(config).toStrictEqual({
			roomId: 'edited-room',
			userName: 'Grace',
			serverUrl: 'wss://collab.example.com',
			transport: 'websocket',
			role: 'collaborator',
			sessionIntent: 'create',
		});
	});

	it('emits the webrtc transport when the server url is blank (P2P)', async () => {
		const wrapper = mount(ShareDialog, { ...mountOptions, props: { open: true } });

		await wrapper.get('#pptx-vue-share-room').setValue('p2p-room');
		await wrapper.get('#pptx-vue-share-name').setValue('Grace');
		// The server field is left blank, which selects serverless peer-to-peer.
		expect(wrapper.find('.pptx-vue-share-p2p-hint').exists()).toBeTruthy();
		await wrapper.get('.pptx-vue-share-btn-primary').trigger('click');

		expect(wrapper.emitted('start')?.[0][0]).toStrictEqual({
			roomId: 'p2p-room',
			userName: 'Grace',
			serverUrl: '',
			transport: 'webrtc',
			role: 'collaborator',
			sessionIntent: 'create',
		});
	});

	it('does not emit start when the room or name is blank', async () => {
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			// Room supplied but no display name: start stays disabled.
			props: { open: true, defaults: { roomId: 'room' } },
		});

		await wrapper.get('.pptx-vue-share-btn-primary').trigger('click');
		expect(wrapper.emitted('start')).toBeUndefined();
	});

	it('joins an invitation emitted by another framework', async () => {
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			props: { open: true, defaults: { userName: 'Grace' } },
		});
		const joinTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes('Join'));
		await joinTab?.trigger('click');
		await wrapper
			.get('#pptx-vue-share-invitation')
			.setValue('https://react.example/viewer?room=cross-ui&server=wss%3A%2F%2Frelay.example');
		await wrapper.get('.pptx-vue-share-btn-primary').trigger('click');

		expect(wrapper.emitted('start')?.[0][0]).toMatchObject({
			roomId: 'cross-ui',
			serverUrl: 'wss://relay.example',
			transport: 'websocket',
			sessionIntent: 'join',
		});
	});

	it('shows a stop button (and the P2P server value) and emits stop when active', async () => {
		const wrapper = mount(ShareDialog, { ...mountOptions, props: { open: true, active: true } });

		// No server configured -> the active view labels the session as P2P.
		expect(wrapper.find('.pptx-vue-share-server-value').exists()).toBeTruthy();
		const stopButton = wrapper.get('.pptx-vue-share-stop');
		expect(wrapper.find('.pptx-vue-share-btn-primary').exists()).toBeFalsy();

		await stopButton.trigger('click');
		expect(wrapper.emitted('stop')).toHaveLength(1);
	});

	it('emits close from the cancel button', async () => {
		const wrapper = mount(ShareDialog, { ...mountOptions, props: { open: true } });

		const cancel = wrapper
			.findAll('.pptx-vue-share-btn')
			.find((b) => !b.classes().includes('pptx-vue-share-btn-primary'));
		await cancel?.trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
