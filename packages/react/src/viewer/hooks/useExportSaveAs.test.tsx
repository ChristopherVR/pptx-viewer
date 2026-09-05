// @vitest-environment happy-dom
/**
 * Save As is `useSerialize` with an output format. It used to assemble a
 * second save-options object of its own and every option added to
 * `useSerialize` afterwards (`viewProperties`, the table-style map,
 * `embedFonts`) was missing from it: a table style edited in the inspector
 * reached `getContent()` and autosave, but the file the backstage Save button
 * downloaded came back with `ppt/tableStyles.xml` byte-identical to the
 * original. Proved live in the React demo before this test existed.
 */
import type { PptxSaveFormat, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useExportSaveAs } from './useExportSaveAs';
import type { ExportSaveAsResult, UseExportSaveAsInput } from './useExportSaveAs';

function baseInput(
	serializeSlides: UseExportSaveAsInput['serializeSlides'],
	filePath = 'deck.pptx',
): UseExportSaveAsInput {
	return {
		slides: [{ id: 's1', elements: [] } as unknown as PptxSlide],
		templateElementsBySlideId: {},
		filePath,
		serializeSlides,
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		theme: undefined,
		canvasSize: { width: 1040, height: 720 },
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
	vi.restoreAllMocks();
});

function mount(input: UseExportSaveAsInput): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness input={input} />);
	});
}

/** Records the `download` name of every anchor click `downloadBlob` performs. */
function recordDownloads(): string[] {
	const names: string[] = [];
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
		function (this: HTMLAnchorElement) {
			names.push(this.download);
		},
	);
	return names;
}

describe('save As goes through the one serialiser', () => {
	it('asks useSerialize for the chosen format instead of building its own options', async () => {
		const serializeSlides = vi.fn<(format?: PptxSaveFormat) => Promise<Uint8Array | null>>(() =>
			Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
		);
		const downloads = recordDownloads();
		mount(baseInput(serializeSlides));

		await act(async () => {
			await api?.handleSaveAsFormat('ppsx');
		});

		expect(serializeSlides).toHaveBeenCalledExactlyOnceWith('ppsx');
		expect(downloads).toStrictEqual(['deck.ppsx']);
	});

	it('the format shortcuts each pass their own container', async () => {
		const serializeSlides = vi.fn<(format?: PptxSaveFormat) => Promise<Uint8Array | null>>(() =>
			Promise.resolve(new Uint8Array([1])),
		);
		recordDownloads();
		mount(baseInput(serializeSlides));

		await act(async () => {
			api?.handleSaveAsPptx();
			api?.handleSaveAsPpsx();
			api?.handleSaveAsPptm();
		});

		expect(serializeSlides.mock.calls.map(([format]) => format)).toStrictEqual([
			'pptx',
			'ppsx',
			'pptm',
		]);
	});

	it('downloads nothing when no deck is loaded (the serialiser returns null)', async () => {
		const downloads = recordDownloads();
		mount(baseInput(() => Promise.resolve(null)));

		await act(async () => {
			await api?.handleSaveAsFormat('pptx');
		});

		expect(downloads).toStrictEqual([]);
	});
});
