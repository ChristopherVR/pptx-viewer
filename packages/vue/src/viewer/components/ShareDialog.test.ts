/* oxlint-disable eslint/one-var -- independent per-test locals, not intended as one statement */
import { flushPromises, mount } from '@vue/test-utils';
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import type { UseCollaborationResult } from '../composables/useCollaboration';
import ShareDialog from './ShareDialog.vue';

const mountOptions = { global: { stubs: { teleport: true } } } as const;

/** A minimal stand-in for `useCollaboration()`'s return value. */
function makeCollab(
	overrides: Partial<Pick<UseCollaborationResult, 'status' | 'remotePresences'>> = {},
): UseCollaborationResult {
	const status = overrides.status ?? ref('connected');
	const remotePresences = overrides.remotePresences ?? ref([]);
	return {
		status,
		connected: computed(() => status.value === 'connected'),
		cursors: ref([]),
		remotePresences,
		connectedCount: computed(() => remotePresences.value.length + 1),
		active: ref(true),
		activeRole: ref('collaborator'),
		followedClientId: ref(null),
		followedSlideIndex: computed(() => null),
		broadcasterSlideIndex: computed(() => null),
		start: vi.fn(),
		stop: vi.fn(),
		retry: vi.fn(),
		setCursor: vi.fn(),
		setSelection: vi.fn(),
		setActiveSlide: vi.fn(),
		followUser: vi.fn(),
		livePatcher: {
			publish: vi.fn(),
			stop: vi.fn(),
		} as unknown as UseCollaborationResult['livePatcher'],
	};
}

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

	it('lists the local user and every remote peer when a session is active', () => {
		const activeCollaboration: CollaborationConfig = {
			roomId: 'team-room',
			userName: 'Ada Lovelace',
			userColor: '#f97316',
			serverUrl: 'wss://collab.example.com',
			transport: 'websocket',
			role: 'collaborator',
		};
		const collab = makeCollab({
			remotePresences: ref([
				{
					clientId: 7,
					userName: 'Grace Hopper',
					color: '#22c55e',
					selectionIds: [],
					activeSlide: 2,
				},
			]),
		});
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			props: { open: true, active: true, collab, activeCollaboration },
		});

		const rows = wrapper.findAll('.pptx-vue-share-active [class*="items-center"][class*="gap-2"]');
		const text = wrapper.text();
		expect(text).toContain('Ada Lovelace');
		expect(text).toContain('Grace Hopper');
		expect(text).toContain('team-room');
		expect(text).toContain('wss://collab.example.com');
		expect(rows.length).toBeGreaterThan(0);
	});

	it('copies the share link to the clipboard and shows the copied confirmation', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		const activeCollaboration: CollaborationConfig = {
			roomId: 'team-room',
			userName: 'Ada',
			serverUrl: 'wss://collab.example.com',
			transport: 'websocket',
			role: 'collaborator',
		};
		const wrapper = mount(ShareDialog, {
			...mountOptions,
			props: { open: true, active: true, collab: makeCollab(), activeCollaboration },
		});

		const copyBtn = wrapper
			.findAll('button')
			.find((b) => b.attributes('title') === 'Copy share link');
		expect(copyBtn?.text()).toBe('Copy URL');
		await copyBtn?.trigger('click');
		await flushPromises();
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining('room=team-room'));
		await flushPromises();
		await wrapper.vm.$nextTick();
		expect(wrapper.get('.pptx-vue-share-active').text()).toContain('Copied');
	});
});
