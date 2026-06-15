import { mount } from '@vue/test-utils';
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ShareDialog from './ShareDialog.vue';

describe('shareDialog', () => {
	it('prefills the fields from the defaults prop', () => {
		const wrapper = mount(ShareDialog, {
			global: { stubs: { teleport: true } },
			props: {
				open: true,
				defaults: {
					roomId: 'team-room',
					userName: 'Ada',
					serverUrl: 'wss://collab.example.com',
				},
			},
		});

		const room = wrapper.get('#pptx-vue-share-room').element as HTMLInputElement;
		const name = wrapper.get('#pptx-vue-share-name').element as HTMLInputElement;
		const server = wrapper.get('#pptx-vue-share-server').element as HTMLInputElement;
		expect(room.value).toBe('team-room');
		expect(name.value).toBe('Ada');
		expect(server.value).toBe('wss://collab.example.com');
	});

	it('emits start with a CollaborationConfig built from the fields', async () => {
		const wrapper = mount(ShareDialog, {
			global: { stubs: { teleport: true } },
			props: {
				open: true,
				defaults: { serverUrl: 'wss://collab.example.com' },
			},
		});

		await wrapper.get('#pptx-vue-share-room').setValue('  edited-room  ');
		await wrapper.get('#pptx-vue-share-name').setValue('Grace');

		const startButton = wrapper.findAll('button').find((b) => b.text() === 'Start sharing');
		expect(startButton).toBeDefined();
		await startButton!.trigger('click');

		const events = wrapper.emitted('start');
		expect(events).toHaveLength(1);
		const config = events![0][0] as CollaborationConfig;
		expect(config).toStrictEqual({
			roomId: 'edited-room',
			userName: 'Grace',
			serverUrl: 'wss://collab.example.com',
		});
	});

	it('does not emit start when required fields are blank', async () => {
		const wrapper = mount(ShareDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, defaults: { roomId: 'room' } },
		});

		const startButton = wrapper.findAll('button').find((b) => b.text() === 'Start sharing');
		await startButton!.trigger('click');

		expect(wrapper.emitted('start')).toBeUndefined();
	});

	it('shows a stop button and emits stop when active', async () => {
		const wrapper = mount(ShareDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, active: true },
		});

		const stopButton = wrapper.findAll('button').find((b) => b.text() === 'Stop sharing');
		expect(stopButton).toBeDefined();
		expect(wrapper.findAll('button').some((b) => b.text() === 'Start sharing')).toBeFalsy();

		await stopButton!.trigger('click');
		expect(wrapper.emitted('stop')).toHaveLength(1);
	});

	it('emits close from the cancel button', async () => {
		const wrapper = mount(ShareDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true },
		});
		const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel');
		await cancel!.trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
