// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike, YjsFactories } from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { useYjsDocumentSync } from './useYjsDocumentSync';

const slide = (id: string): PptxSlide => ({ id, rId: id, slideNumber: 1, elements: [] });
const factories: YjsFactories = {
	createMap: () => new Y.Map(),
	createArray: () => new Y.Array(),
	createText: () => new Y.Text(),
};
const externalConfig = {
	externalSession: { getSnapshot: () => ({ status: 'connected', synced: true }) },
	sessionIntent: 'join',
} as CollaborationConfig;
let root: Root;
let container: HTMLDivElement;
let doc: Y.Doc;
let current: PptxSlide[];
let setCurrent: React.Dispatch<React.SetStateAction<PptxSlide[]>>;

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
	doc.destroy();
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('host-owned document synchronization', () => {
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
