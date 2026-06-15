import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BroadcastDialog from './BroadcastDialog.vue';

/** ModalDialog teleports to `body`; stub teleport so content renders inline. */
const mountOptions = { global: { stubs: { teleport: true } } } as const;

afterEach(() => {
	vi.restoreAllMocks();
});

describe('broadcastDialog', () => {
	it('emits start with the configured room id and server url', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: {
				open: true,
				defaults: { roomId: 'broadcast-fixed', serverUrl: 'ws://example.test:1234' },
			},
		});

		const buttons = wrapper.findAll('button');
		const startButton = buttons.find((b) => b.text() === 'Start broadcast');
		expect(startButton).toBeDefined();

		await startButton?.trigger('click');

		const startEvents = wrapper.emitted('start');
		expect(startEvents).toHaveLength(1);
		expect(startEvents?.[0][0]).toStrictEqual({
			roomId: 'broadcast-fixed',
			serverUrl: 'ws://example.test:1234',
		});
	});

	it('auto-generates a broadcast room id when no default is supplied', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: { open: true },
		});

		const roomInput = wrapper.get('#pptx-vue-broadcast-room-id').element as HTMLInputElement;
		expect(roomInput.value).toMatch(/^broadcast-[a-z0-9]+$/u);

		const startButton = wrapper.findAll('button').find((b) => b.text() === 'Start broadcast');
		await startButton?.trigger('click');

		const payload = wrapper.emitted('start')?.[0][0] as { roomId: string; serverUrl: string };
		expect(payload.roomId).toMatch(/^broadcast-[a-z0-9]+$/u);
		expect(payload.serverUrl).toBe('ws://localhost:1234');
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

		const stopButton = wrapper.findAll('button').find((b) => b.text() === 'Stop broadcast');
		expect(stopButton).toBeDefined();
		await stopButton?.trigger('click');

		expect(wrapper.emitted('stop')).toHaveLength(1);
	});

	it('copies the viewer url via the clipboard when available', async () => {
		const writeText = vi.fn(() => Promise.resolve());
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: {
				open: true,
				active: true,
				viewerUrl: 'https://app.test/?broadcast=room-1',
			},
		});

		const copyButton = wrapper.findAll('button').find((b) => b.text() === 'Copy link');
		expect(copyButton).toBeDefined();
		await copyButton?.trigger('click');

		expect(writeText).toHaveBeenCalledWith('https://app.test/?broadcast=room-1');
	});

	it('disables copy when clipboard is unavailable', () => {
		vi.stubGlobal('navigator', {});

		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: {
				open: true,
				active: true,
				viewerUrl: 'https://app.test/?broadcast=room-1',
			},
		});

		const copyButton = wrapper.findAll('button').find((b) => b.text() === 'Copy link');
		expect(copyButton?.attributes('disabled')).toBeDefined();
	});

	it('emits close from the footer close button', async () => {
		const wrapper = mount(BroadcastDialog, {
			...mountOptions,
			props: { open: true },
		});

		const closeButton = wrapper.findAll('button').find((b) => b.text() === 'Close');
		await closeButton?.trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
