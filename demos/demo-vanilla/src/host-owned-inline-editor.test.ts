import { createCollaborationShell, createInitialViewerState, createStore } from 'pptx-vanilla-viewer';
import { findElementYMap, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { createHostOwnedInlineEditor } from './host-owned-inline-editor';

async function setup() {
	const doc = new Y.Doc();
	const awareness = new Awareness(doc);
	const store = createStore(createInitialViewerState());
	let allowed = true;
	const shell = createCollaborationShell({
		document, store, getHandler: () => null, getCanEdit: () => allowed,
	});
	reconcileSlidesInYDoc([{
		id: 'slide', rId: 'r1', slideNumber: 1,
		elements: [{ id: 'text', type: 'text', x: 0, y: 0, width: 200, height: 50,
			text: 'Body', textSegments: [{ text: 'Body', style: { bold: true } }] }],
	}], doc, { createMap: () => new Y.Map(), createArray: () => new Y.Array(), createText: () => new Y.Text() });
	await shell.setConfig({
		roomId: 'custom-shell', serverUrl: '', userName: 'Host',
		externalSession: { doc, awareness,
			getSnapshot: () => ({ status: 'connected', synced: true }), subscribe: () => () => {},
		},
	});
	const root = document.createElement('div');
	document.body.append(root);
	const inline = createHostOwnedInlineEditor({
		root, store, patcher: shell.controller.livePatcher, getScale: () => 1, onChange: () => {},
	});
	const stop = store.subscribe(() => inline.sync());
	return { doc, store, root, inline,
		disable() { allowed = false; shell.refresh(); },
		dispose() { stop(); inline.cancel(); root.remove(); shell.destroy(); awareness.destroy(); doc.destroy(); },
	};
}

describe('custom-shell native inline lifecycle', () => {
	it.each(['composition', 'beforeinput'] as const)(
		'keeps canonical text and rejects Save during %s', async (pending) => {
			const h = await setup();
			try {
				h.inline.open(h.store.get().slides[0].elements[0]);
				const surface = h.root.querySelector<HTMLElement>('[data-inline-editor]')!;
				const node = surface.querySelector('span')!.firstChild as Text;
				window.getSelection()!.setBaseAndExtent(node, 4, node, 4);
				surface.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }));
				node.data += ' local';
				surface.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
				const shared = findElementYMap(h.doc, 'slide', 'text')!.get('textBody') as Y.Text;
				shared.insert(0, 'Peer ', {});
				const beforeSave = h.store.get().slides;
				expect(h.inline.readSlides()[0].elements[0]).toMatchObject({ text: 'Peer Body local' });
				expect(h.store.get().slides).toBe(beforeSave);
				expect(surface.isConnected).toBeTruthy();
				surface.dispatchEvent(pending === 'composition'
					? new CompositionEvent('compositionstart', { bubbles: true })
					: new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }));
				expect(h.inline.commit()).toBeFalsy();
				expect(() => h.inline.readSlides()).toThrow('Finish the current text input before saving.');
				const updates = vi.fn();
				h.doc.on('update', updates);
				h.disable();
				expect(updates).not.toHaveBeenCalled();
				expect(surface.isConnected).toBeFalsy();
				expect(h.inline.readSlides()[0].elements[0]).toMatchObject({ text: 'Peer Body local' });
			} finally { h.dispose(); }
		},
	);
});
