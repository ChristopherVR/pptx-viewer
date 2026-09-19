import { flushPromises, mount } from '@vue/test-utils';
import { PptxHandler } from 'pptx-viewer-core';
import { findElementYMap, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import HostOwnedHeadlessEditor from '../../../../demos/demo-vue/src/HostOwnedHeadlessEditor.vue';
import type { HostOwnedDemo } from '../../../../demos/shared/host-owned-collaboration';
import {
	CollaborationCursors,
	CollaborationStatusIndicator,
	FollowModeBar,
	InlineTextEditor,
	overlayInlineTextSnapshot,
	RemoteSelectionOverlay,
	useCollaboration,
	useCollaborativeHistory,
	useCollaborativeState,
	usePresenceTracking,
	useYjsProvider,
	useInlineEditing,
} from './index';

describe('stable collaboration exports', () => {
	it('composes native text, pending Save and permission retirement in the public custom shell', async () => {
		const doc = new Y.Doc();
		const awareness = new Awareness(doc);
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const source = await handler.save(data.slides);
		reconcileSlidesInYDoc(
			[
				{
					id: 'slide',
					rId: 'r1',
					slideNumber: 1,
					elements: [
						{
							id: 'text',
							type: 'text',
							x: 10,
							y: 10,
							width: 200,
							height: 50,
							text: 'Body',
							textSegments: [{ text: 'Body', style: { bold: true } }],
						},
					],
				},
			],
			doc,
			{
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			},
		);
		const host: HostOwnedDemo = {
			source,
			editable: true,
			fileName: 'test.pptx',
			attachControls: () => {},
			dispose: () => {},
			config: {
				roomId: 'custom-shell',
				serverUrl: '',
				userName: 'Host',
				role: 'collaborator',
				sessionIntent: 'join',
				externalSession: {
					doc,
					awareness,
					getSnapshot: () => ({ status: 'connected', synced: true }),
					subscribe: () => () => {},
				},
			},
		};
		const wrapper = mount(HostOwnedHeadlessEditor, { attachTo: document.body, props: { host } });
		try {
			await vi.waitFor(() => expect(wrapper.get('output').text()).toContain('Editable'));
			await wrapper.get('[data-element-id="text"]').trigger('dblclick');
			const surface = wrapper.get('[data-inline-editor]').element as HTMLElement;
			const node = surface.querySelector('span')!.firstChild as Text;
			window.getSelection()!.setBaseAndExtent(node, 4, node, 4);
			surface.dispatchEvent(
				new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }),
			);
			node.data += ' local';
			surface.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
			const shared = findElementYMap(doc, 'slide', 'text')!.get('textBody') as Y.Text;
			shared.insert(0, 'Peer ', {});
			await flushPromises();
			expect(surface.textContent).toBe('Peer Body local');
			const reader = new PptxHandler();
			try {
				const saved = await reader.load(await wrapper.vm.getContent());
				expect(saved.slides[0].elements[0]).toMatchObject({ text: 'Peer Body local' });
			} finally {
				reader.dispose();
			}
			expect(surface.isConnected).toBeTruthy();
			surface.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
			await expect(wrapper.vm.getContent()).rejects.toThrow('Finish the current text input');
			const updates = vi.fn();
			doc.on('update', updates);
			await wrapper.setProps({ host: { ...host, editable: false } });
			expect(updates).not.toHaveBeenCalled();
			expect(wrapper.find('[data-inline-editor]').exists()).toBeFalsy();
			expect(wrapper.text()).toContain('Peer Body local');
		} finally {
			wrapper.unmount();
			handler.dispose();
			awareness.destroy();
			doc.destroy();
		}
	});

	it('exposes collaboration composables and UI components', () => {
		expect(useCollaboration).toBeTypeOf('function');
		expect(useYjsProvider).toBeTypeOf('function');
		expect(usePresenceTracking).toBeTypeOf('function');
		expect(useCollaborativeState).toBeTypeOf('function');
		expect(useCollaborativeHistory).toBeTypeOf('function');
		expect(CollaborationCursors).toBeTruthy();
		expect(CollaborationStatusIndicator).toBeTruthy();
		expect(RemoteSelectionOverlay).toBeTruthy();
		expect(FollowModeBar).toBeTruthy();
		expect(InlineTextEditor).toBeTruthy();
		expect(overlayInlineTextSnapshot).toBeTypeOf('function');
		expect(useInlineEditing).toBeTypeOf('function');
	});
});
