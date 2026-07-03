import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BroadcastDialog from './BroadcastDialog.vue';

/** ModalDialog teleports to `body`; stub teleport so content renders inline. */
const mountOptions = { global: { stubs: { teleport: true } } } as const;

afterEach(() => {
	vi.restoreAllMocks();
});

describe('broadcastDialog', () => {
	it('emits start with the room id, server url, and websocket transport', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: {
				open: true,
				defaults: { roomId: 'broadcast-fixed', serverUrl: 'ws://example.test:1234' },
			},
		});

		await wrapper.get('.pptx-vue-broadcast-btn-primary').trigger('click');

		const startEvents = wrapper.emitted('start');
		expect(startEvents).toHaveLength(1);
		// A non-empty server URL selects the y-websocket transport.
		expect(startEvents?.[0][0]).toStrictEqual({
			roomId: 'broadcast-fixed',
			serverUrl: 'ws://example.test:1234',
			transport: 'websocket',
		});
	});

	it('auto-generates a broadcast room id when no default is supplied', async () => {
		const wrapper = mount(BroadcastDialog, { ...mountOptions, props: { open: true } });

		const roomInput = wrapper.get('#pptx-vue-broadcast-room-id').element as HTMLInputElement;
		expect(roomInput.value).toMatch(/^broadcast-[a-z0-9]+$/u);

		await wrapper.get('.pptx-vue-broadcast-btn-primary').trigger('click');

		const payload = wrapper.emitted('start')?.[0][0] as {
			roomId: string;
			serverUrl: string;
			transport: string;
		};
		expect(payload.roomId).toMatch(/^broadcast-[a-z0-9]+$/u);
		expect(payload.serverUrl).toBe('ws://localhost:1234');
		expect(payload.transport).toBe('websocket');
	});

	it('emits the webrtc transport when the server url is left blank (P2P)', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: { open: true, defaults: { roomId: 'broadcast-p2p' } },
		});

		// Clear the server field: a blank server selects serverless peer-to-peer.
		await wrapper.get('#pptx-vue-broadcast-server-url').setValue('');
		// The P2P hint appears when the server is blank.
		expect(wrapper.find('.pptx-vue-broadcast-p2p-hint').exists()).toBeTruthy();

		await wrapper.get('.pptx-vue-broadcast-btn-primary').trigger('click');

		expect(wrapper.emitted('start')?.[0][0]).toStrictEqual({
			roomId: 'broadcast-p2p',
			serverUrl: '',
			transport: 'webrtc',
		});
	});

	it('shows the viewer url and emits stop when active', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: {
				open: true,
				active: true,
				viewerUrl: 'https://app.test/?broadcast=room-1&server=ws%3A%2F%2Fx',
			},
		});

		const urlInput = wrapper.get('#pptx-vue-broadcast-viewer-url').element as HTMLInputElement;
		expect(urlInput.value).toBe('https://app.test/?broadcast=room-1&server=ws%3A%2F%2Fx');
		expect(urlInput.readOnly).toBeTruthy();

		await wrapper.get('.pptx-vue-broadcast-stop').trigger('click');
		expect(wrapper.emitted('stop')).toHaveLength(1);
	});

	it('copies the viewer url via the clipboard when available', async () => {
		const writeText = vi.fn(() => Promise.resolve());
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: { open: true, active: true, viewerUrl: 'https://app.test/?broadcast=room-1' },
		});

		await wrapper.get('.pptx-vue-broadcast-link-row button').trigger('click');
		expect(writeText).toHaveBeenCalledWith('https://app.test/?broadcast=room-1');
	});

	it('disables copy when clipboard is unavailable', () => {
		vi.stubGlobal('navigator', {});

		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: { open: true, active: true, viewerUrl: 'https://app.test/?broadcast=room-1' },
		});

		const copyButton = wrapper.get('.pptx-vue-broadcast-link-row button');
		expect(copyButton.attributes('disabled')).toBeDefined();
	});

	it('emits close from the footer close button', async () => {
		const wrapper = mount(BroadcastDialog, { ...mountOptions, props: { open: true } });

		const closeButton = wrapper
			.findAll('.pptx-vue-broadcast-btn')
			.find((b) => !b.classes().includes('pptx-vue-broadcast-btn-primary'));
		await closeButton?.trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
