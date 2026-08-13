// @vitest-environment happy-dom
/**
 * Save As builds its OWN save options rather than reusing `useSerialize`, and
 * the backstage File > Save routes through it. It carried no slide size, so a
 * preset picked in the inspector reached `Save` (the imperative serialiser) and
 * NOT the file the user actually downloaded: the saved `p:sldSz` never moved.
 *
 * Proved live before this test existed: picking A4 in the demo and saving
 * produced `<p:sldSz cx="12192000" cy="6858000">`, the original widescreen size.
 */
import type { PptxHandler, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useExportSaveAs } from './useExportSaveAs';
import type { ExportSaveAsResult, UseExportSaveAsInput } from './useExportSaveAs';

function recordingHandler(): { handler: PptxHandler; seen: PptxHandlerSaveOptions[] } {
	const seen: PptxHandlerSaveOptions[] = [];
	const handler = {
		save: (_slides: PptxSlide[], options?: PptxHandlerSaveOptions) => {
			seen.push(options ?? {});
			return Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		},
	} as unknown as PptxHandler;
	return { handler, seen };
}

function baseInput(handler: PptxHandler): UseExportSaveAsInput {
	return {
		slides: [{ id: 's1', elements: [] } as unknown as PptxSlide],
		templateElementsBySlideId: {},
		filePath: 'deck.pptx',
		handlerRef: { current: handler },
		serializeSlides: () => Promise.resolve(null),
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: null,
		appProperties: null,
		customProperties: [],
		tagCollections: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		guides: [],
		activeSlideIndexForGuides: 0,
		theme: undefined,
		canvasSize: { width: 1040, height: 720 },
		slideSizeEmu: { widthEmu: 9906000, heightEmu: 6858000, type: 'A4' },
		modalControls: {
			setExportModalOpen: () => {},
			setExportModalTitle: () => {},
			setExportProgress: () => {},
			setExportStatusMessage: () => {},
			exportAbortRef: { current: null },
		},
	};
}

let api: ExportSaveAsResult | null = null;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({ input }: { input: UseExportSaveAsInput }): null {
	api = useExportSaveAs(input);
	return null;
}

beforeAll(() => {
	// happy-dom does not implement object URLs, which `downloadBlob` uses.
	URL.createObjectURL ??= () => 'blob:test';
	URL.revokeObjectURL ??= () => {};
});

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	host?.remove();
	root = null;
	host = null;
	api = null;
});

function mount(input: UseExportSaveAsInput): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness input={input} />);
	});
}

describe('the Save As path carries the slide size', () => {
	it('passes the EMU size the viewer holds, preset type included', async () => {
		const { handler, seen } = recordingHandler();
		mount(baseInput(handler));
		await act(async () => {
			await api?.handleSaveAsFormat('pptx');
		});

		expect(seen).toHaveLength(1);
		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 9906000,
			heightEmu: 6858000,
			type: 'A4',
		});
	});

	it('falls back to the pixel canvas when the two disagree', async () => {
		const { handler, seen } = recordingHandler();
		mount({ ...baseInput(handler), canvasSize: { width: 1600, height: 900 } });
		await act(async () => {
			await api?.handleSaveAsFormat('pptx');
		});

		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 1600 * 9525,
			heightEmu: 900 * 9525,
			type: '',
		});
	});
});
