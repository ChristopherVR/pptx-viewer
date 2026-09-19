import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
	createCollaborationShell,
	createInitialViewerState,
	createStore,
	overlayInlineTextSnapshot,
} from '../../index';
import type { ExternalCollaborationSnapshot, PptxSlide } from '../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	cleanups
		.splice(0)
		.reverse()
		.forEach((cleanup) => cleanup());
});

function setup() {
	const store = createStore(createInitialViewerState());
	let allowed = true;
	let pending = false;
	let scale = 1;
	const shell = createCollaborationShell({
		document,
		store,
		getHandler: () => null,
		getCanEdit: () => allowed,
		getSourcePending: () => pending,
		getScale: () => scale,
	});
	cleanups.push(() => shell.destroy());
	return {
		store,
		shell,
		setAllowed: (value: boolean) => {
			allowed = value;
			shell.refresh();
		},
		setPending: (value: boolean) => {
			pending = value;
			shell.refresh();
		},
		setScale: (value: number) => {
			scale = value;
			shell.refresh();
		},
	};
}

function room() {
	const doc = new Y.Doc();
	const awareness = new Awareness(doc);
	const destroy = vi.spyOn(doc, 'destroy');
	const listeners = new Set<() => void>();
	let snapshot: ExternalCollaborationSnapshot = { status: 'connected', synced: true };
	cleanups.unshift(() => {
		awareness.destroy();
		doc.destroy();
	});
	return {
		doc,
		destroy,
		config: {
			roomId: 'custom-shell',
			serverUrl: '',
			userName: 'Host',
			externalSession: {
				doc,
				awareness,
				getSnapshot: () => snapshot,
				subscribe: (callback: () => void) => {
					listeners.add(callback);
					return () => {
						listeners.delete(callback);
					};
				},
			},
		},
		update(next: ExternalCollaborationSnapshot) {
			snapshot = next;
			listeners.forEach((listener) => listener());
		},
	};
}

describe('public Vanilla collaboration shell', () => {
	it('exports the shared snapshot overlay without changing its nested-element semantics', () => {
		const child = { id: 'text', type: 'text', text: 'Old', textSegments: [{ text: 'Old' }] };
		const group = { id: 'group', type: 'group', children: [child] };
		const next = overlayInlineTextSnapshot([group] as PptxSlide['elements'], {
			elementId: 'text',
			text: 'New',
			textSegments: [{ text: 'New', style: { bold: true } }],
		});
		expect(next[0]).toMatchObject({ children: [{ text: 'New' }] });
		expect(child.text).toBe('Old');
	});

	it('adopts an occupied room after a bootstrap load without publishing the local source', async () => {
		const { store, shell } = setup();
		const host = room();
		const remote: PptxSlide[] = [{ id: 'remote', rId: 'rId1', slideNumber: 1, elements: [] }];
		reconcileSlidesInYDoc(remote, host.doc, {
			createMap: () => new Y.Map(),
			createArray: () => new Y.Array(),
			createText: () => new Y.Text(),
		});
		await shell.setConfig(host.config);
		shell.controller.beginContentLoad('bootstrap');
		store.set({ slides: [{ ...remote[0], id: 'local-startup' }] });
		expect(readSlidesFromYDoc(host.doc).map((slide) => slide.id)).toStrictEqual(['remote']);
		shell.controller.notifyContentLoaded('bootstrap');
		expect(store.get().slides.map((slide) => slide.id)).toStrictEqual(['remote']);
		expect(readSlidesFromYDoc(host.doc).map((slide) => slide.id)).toStrictEqual(['remote']);
	});

	it('preserves authorization without a config, including blank/loading/error state', () => {
		const { store, shell, setPending, setAllowed } = setup();
		setPending(true);
		store.set({ error: 'Invalid source' });
		expect(shell.getState().canEdit).toBeTruthy();
		expect(store.get().editable).toBeTruthy();
		setAllowed(false);
		expect(shell.getState().canEdit).toBeFalsy();
	});

	it('combines readiness and source loading without changing host permission', async () => {
		const { store, shell, setPending, setAllowed } = setup();
		const host = room();
		setPending(true);
		await shell.setConfig(host.config);
		expect(shell.getState().canEdit).toBeFalsy();
		setPending(false);
		expect(store.get().editable).toBeTruthy();
		host.update({ status: 'disconnected', synced: true });
		expect(store.get().editable).toBeTruthy();
		host.update({ status: 'disconnected', synced: false });
		expect(store.get().editable).toBeFalsy();
		setAllowed(false);
		host.update({ status: 'connected', synced: true });
		expect(store.get().editable).toBeFalsy();
		setAllowed(true);
		expect(store.get().editable).toBeTruthy();
		shell.destroy();
		expect(host.destroy).not.toHaveBeenCalled();
	});

	it('releases invalid and stopped viewer configs but honors an active viewer role', async () => {
		const { shell, store } = setup();
		const host = room();
		await shell.setConfig({ ...host.config, role: 'viewer' });
		expect(store.get().editable).toBeFalsy();
		await shell.setConfig({ ...host.config, role: 'viewer', roomId: 'bad room' });
		expect(shell.getState().status).toBe('error');
		expect(store.get().editable).toBeTruthy();
		await shell.setConfig(undefined);
		expect(shell.getState().status).toBe('disconnected');
		expect(shell.getState().remoteUsers).toStrictEqual([]);
	});

	it('projects cursor and selection coordinates at the requested scale and clears them on stop', async () => {
		const { shell, store, setScale } = setup();
		await shell.setConfig(room().config);
		store.set({ cursors: [{ clientId: 2, userName: 'Peer', color: '#123456', x: 40, y: 60 }] });
		store.set({
			slides: [
				{
					id: 'slide',
					rId: 'rId1',
					slideNumber: 1,
					elements: [{ id: 'shape', type: 'text', x: 20, y: 40, width: 100, height: 80 }],
				},
			],
			remotePresences: [
				{
					clientId: 2,
					userName: 'Peer',
					userColor: '#123456',
					activeSlideIndex: 0,
					selectedElementId: 'shape',
					cursorX: 40,
					cursorY: 60,
					lastUpdated: new Date().toISOString(),
				},
			],
		});
		setScale(0.5);
		expect(
			shell.cursorOverlay.el.querySelector('[data-pptx-remote-cursor]')?.getAttribute('style'),
		).toContain('translate(20px, 30px)');
		const selection = shell.selectionOverlay.el.querySelector<HTMLElement>(
			'[data-pptx-remote-selection]',
		);
		expect(selection?.style.transform).toBe('translate(10px, 20px)');
		expect(selection?.style.width).toBe('50px');
		expect(selection?.style.height).toBe('40px');
		await shell.setConfig(undefined);
		expect(shell.cursorOverlay.el.childElementCount).toBe(0);
		expect(shell.selectionOverlay.el.childElementCount).toBe(0);
	});
});
