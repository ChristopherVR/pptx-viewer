// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	CollaborationLivePatcher,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	createCollaborationLivePatcher,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { useCollaborationLivePatch } from './useCollaborationLivePatch';
import { useExternalYjsSession } from './useExternalYjsSession';
import { useYjsDocumentSync } from './useYjsDocumentSync';

const slide = (id: string): PptxSlide => ({ id, rId: id, slideNumber: 1, elements: [] });
const factories: YjsFactories = {
	createMap: () => new Y.Map(),
	createArray: () => new Y.Array(),
	createText: () => new Y.Text(),
};
const externalConfig = {
	externalSession: {
		getSnapshot: () => ({ status: 'connected', synced: true }),
		subscribe: () => () => {},
	},
	sessionIntent: 'join',
} as CollaborationConfig;
let root: Root;
let container: HTMLDivElement;
let doc: Y.Doc;
let current: PptxSlide[];
let setCurrent: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
let awareness: Awareness | undefined;

function externalControl(sharedAwareness?: Awareness) {
	let synced = true;
	let status: 'connected' | 'disconnected' = 'connected';
	const listeners = new Set<() => void>();
	awareness = sharedAwareness ?? new Awareness(doc);
	return {
		config: {
			roomId: 'readiness-test',
			serverUrl: '',
			userName: 'Participant',
			sessionIntent: 'join',
			externalSession: {
				doc,
				awareness,
				getSnapshot: () => ({ status, synced }),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
			},
		} satisfies CollaborationConfig,
		setSynced(value: boolean) {
			synced = value;
			for (const listener of listeners) {
				listener();
			}
		},
		setStatus(value: 'connected' | 'disconnected') {
			status = value;
			for (const listener of listeners) {
				listener();
			}
		},
		listenerCount: () => listeners.size,
	};
}

function ExternalProbe({
	config,
	patcher,
	onSlides,
}: {
	config: CollaborationConfig;
	patcher: CollaborationLivePatcher;
	onSlides?: (slides: PptxSlide[]) => void;
}): null {
	const session = useExternalYjsSession(config.externalSession);
	const [slides, setSlides] = useState([slide('bootstrap')]);
	current = slides;
	setCurrent = setSlides;
	useYjsDocumentSync({
		doc: session.doc,
		slides,
		setSlides,
		isConnected: Boolean(session.doc),
		isSynced: session.synced,
		config,
		loadOrigin: 'bootstrap',
		templateElementsBySlideId: {},
	});
	useCollaborationLivePatch({
		patcher,
		externalSession: config.externalSession,
		doc: session.doc,
		isConnected: Boolean(session.doc),
		isSynced: session.synced,
	});
	useEffect(() => {
		onSlides?.(slides);
	}, [slides, onSlides]);
	return null;
}

function Probe({
	synced = true,
	config = externalConfig,
	loadVersion = 0,
	loadOrigin = 'bootstrap' as const,
	document = doc,
}: {
	synced?: boolean;
	config?: CollaborationConfig;
	loadVersion?: number;
	loadOrigin?: 'bootstrap' | 'user';
	document?: Y.Doc;
}): null {
	const [slides, setSlides] = useState([slide('bootstrap')]);
	current = slides;
	setCurrent = setSlides;
	useYjsDocumentSync({
		doc: document,
		slides,
		setSlides,
		isConnected: true,
		isSynced: synced,
		config,
		loadVersion,
		loadOrigin,
		templateElementsBySlideId: {},
	});
	return null;
}
function seed(target: Y.Doc, id: string): void {
	reconcileSlidesInYDoc([slide(id)], target as unknown as YDocLike, factories, 'remote');
}
function ids(target = doc): string[] {
	return readSlidesFromYDoc(target as unknown as YDocLike).map((item) => item.id);
}
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	doc = new Y.Doc();
});
afterEach(() => {
	act(() => root.unmount());
	awareness?.destroy();
	awareness = undefined;
	doc.destroy();
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('host-owned document synchronization', () => {
	it.each([false, true])(
		'cancels pending publication when readiness is revoked (resume=%s)',
		async (resume) => {
			seed(doc, 'room');
			const control = externalControl();
			const patcher = createCollaborationLivePatcher();
			const onSlides = (slides: PptxSlide[]) => {
				if (slides[0]?.id === 'pending-local') {
					control.setSynced(false);
					if (resume) {
						control.setSynced(true);
					}
				}
			};
			await act(async () =>
				root.render(
					<ExternalProbe config={control.config} patcher={patcher} onSlides={onSlides} />,
				),
			);
			await act(async () => setCurrent([slide('pending-local')]));
			expect(ids()).toStrictEqual(['room']);
			if (!resume) {
				await act(async () => control.setSynced(true));
			}
			await act(async () => setCurrent([slide('fresh-local')]));
			expect(ids()).toStrictEqual(['fresh-local']);
			patcher.dispose();
		},
	);

	it('stops live patches immediately when host readiness is revoked', async () => {
		reconcileSlidesInYDoc(
			[
				{
					...slide('room'),
					elements: [{ id: 'shape', type: 'shape', x: 10, y: 20, width: 100, height: 60 }],
				},
			],
			doc,
			factories,
			'remote',
		);
		const control = externalControl();
		const patcher = createCollaborationLivePatcher();
		await act(async () => root.render(<ExternalProbe config={control.config} patcher={patcher} />));
		expect(patcher.isActive()).toBeTruthy();
		await act(async () => {
			control.setSynced(false);
			patcher.patchGeometry('room', 'shape', { x: 90 });
		});
		expect(readSlidesFromYDoc(doc)[0].elements[0].x).toBe(10);
		patcher.dispose();
	});

	it('drops queued geometry on a readiness pulse and allows a fresh gesture', async () => {
		reconcileSlidesInYDoc(
			[
				{
					...slide('room'),
					elements: [{ id: 'shape', type: 'shape', x: 10, y: 20, width: 100, height: 60 }],
				},
			],
			doc,
			factories,
			'remote',
		);
		const control = externalControl();
		const patcher = createCollaborationLivePatcher({ throttleMs: 10_000 });
		await act(async () => root.render(<ExternalProbe config={control.config} patcher={patcher} />));
		await act(async () => {
			patcher.patchGeometry('room', 'shape', { x: 30 });
			patcher.patchGeometry('room', 'shape', { x: 60 });
			control.setSynced(false);
			control.setSynced(true);
			patcher.flush();
		});
		expect(readSlidesFromYDoc(doc)[0].elements[0].x).toBe(30);
		await act(async () => patcher.patchGeometry('room', 'shape', { x: 90 }));
		expect(readSlidesFromYDoc(doc)[0].elements[0].x).toBe(90);
		patcher.dispose();
	});

	it.each([false, true])(
		'waits to adopt remote changes until readiness resumes (empty=%s)',
		async (empty) => {
			seed(doc, 'room');
			const control = externalControl();
			const patcher = createCollaborationLivePatcher();
			await act(async () =>
				root.render(<ExternalProbe config={control.config} patcher={patcher} />),
			);
			await act(async () => {
				control.setSynced(false);
				reconcileSlidesInYDoc(empty ? [] : [slide('remote')], doc, factories, 'remote');
			});
			expect(current.map((item) => item.id)).toStrictEqual(['room']);
			await act(async () => control.setSynced(true));
			expect(current.map((item) => item.id)).toStrictEqual(empty ? [] : ['remote']);
			await act(async () => setCurrent([slide('fresh-local')]));
			expect(ids()).toStrictEqual(['fresh-local']);
			patcher.dispose();
		},
	);

	it('keeps synchronized offline edits writable and releases session subscriptions on unmount', async () => {
		seed(doc, 'room');
		const control = externalControl();
		const patcher = createCollaborationLivePatcher();
		await act(async () => root.render(<ExternalProbe config={control.config} patcher={patcher} />));
		await act(async () => control.setStatus('disconnected'));
		await act(async () => setCurrent([slide('offline-local')]));
		expect(ids()).toStrictEqual(['offline-local']);
		expect(patcher.isActive()).toBeTruthy();
		expect(control.listenerCount()).toBeGreaterThan(0);
		await act(async () => root.render(null));
		expect(control.listenerCount()).toBe(0);
		expect(patcher.isActive()).toBeFalsy();
		expect(doc.isDestroyed).toBeFalsy();
		patcher.dispose();
	});

	it('detaches the old readiness signal when replacing a session on the same document', async () => {
		seed(doc, 'room');
		const previous = externalControl();
		const next = externalControl(previous.config.externalSession.awareness);
		const patcher = createCollaborationLivePatcher();
		await act(async () =>
			root.render(<ExternalProbe config={previous.config} patcher={patcher} />),
		);
		await act(async () => root.render(<ExternalProbe config={next.config} patcher={patcher} />));
		expect(previous.listenerCount()).toBe(0);
		await act(async () => previous.setSynced(false));
		expect(patcher.isActive()).toBeTruthy();
		await act(async () => setCurrent([slide('new-session-local')]));
		expect(ids()).toStrictEqual(['new-session-local']);
		await act(async () => next.setSynced(false));
		expect(patcher.isActive()).toBeFalsy();
		patcher.dispose();
	});

	it('adopts an already-synced room before publishing the bootstrap deck', async () => {
		seed(doc, 'room');
		const updates = vi.fn();
		doc.on('update', updates);
		await act(async () => root.render(<Probe />));
		expect(ids()).toStrictEqual(['room']);
		expect(current.map((item) => item.id)).toStrictEqual(['room']);
		expect(updates).not.toHaveBeenCalled();
	});

	it('waits for host sync and re-adopts the room when sync resumes', async () => {
		seed(doc, 'room');
		await act(async () => root.render(<Probe synced={false} />));
		expect(current.map((item) => item.id)).toStrictEqual(['bootstrap']);
		await act(async () => root.render(<Probe />));
		expect(current.map((item) => item.id)).toStrictEqual(['room']);
		await act(async () => root.render(<Probe synced={false} />));
		await act(async () => {
			setCurrent([slide('offline-local')]);
			seed(doc, 'reconnected');
		});
		await act(async () => root.render(<Probe />));
		expect(ids()).toStrictEqual(['reconnected']);
		expect(current.map((item) => item.id)).toStrictEqual(['reconnected']);
	});

	it('does not seed an empty join, but publishes an explicit file open', async () => {
		await act(async () => root.render(<Probe />));
		expect(ids()).toStrictEqual([]);
		await act(async () => {
			setCurrent([slide('opened')]);
			root.render(<Probe loadVersion={1} loadOrigin='user' />);
		});
		expect(ids()).toStrictEqual(['opened']);
	});

	it('adopts an empty authoritative room when synchronization resumes', async () => {
		seed(doc, 'room');
		await act(async () => root.render(<Probe />));
		await act(async () => root.render(<Probe synced={false} />));
		await act(async () => doc.getArray('pptx:slides').delete(0, 1));
		await act(async () => root.render(<Probe />));
		expect(current).toStrictEqual([]);
		expect(ids()).toStrictEqual([]);
	});

	it('seeds a new create session and synchronizes deletion of the last slide', async () => {
		const config = { ...externalConfig, sessionIntent: 'create' as const };
		await act(async () => root.render(<Probe config={config} />));
		expect(ids()).toStrictEqual(['bootstrap']);
		await act(async () => setCurrent([]));
		expect(ids()).toStrictEqual([]);
	});

	it('receives remote removal after adoption and does not resurrect the slide', async () => {
		seed(doc, 'room');
		await act(async () => root.render(<Probe />));
		await act(async () => doc.getArray('pptx:slides').delete(0, 1));
		expect(current).toStrictEqual([]);
		expect(ids()).toStrictEqual([]);
	});

	it('does not publish read-only state', async () => {
		seed(doc, 'room');
		await act(async () => root.render(<Probe config={{ ...externalConfig, role: 'viewer' }} />));
		await act(async () => setCurrent([slide('not-allowed')]));
		expect(ids()).toStrictEqual(['room']);
	});
});
