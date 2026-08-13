// @vitest-environment node
/**
 * Does a Slide Size edit reach the saved file?
 *
 * It did not. The inspector's Slide Size card edited a viewer-only pixel
 * `canvasSize`, whose only consumer was the JSON export, and `useSerialize`
 * built its save options without any slide size at all. Core has supported
 * this the whole time (`PptxHandlerSaveOptions.slideSize` rewrites `p:sldSz`),
 * so the card was decorative: reopening a resized deck showed the old size.
 *
 * These assert on the OPTIONS OBJECT the real `useSerialize` hands the real
 * save path, because that is the thing the bug was about. A test that only
 * called `resolveSlideSizeSelection` would pass whether or not `useSerialize`
 * ever forwarded it.
 */
import type { PptxHandler, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import type React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useSerialize } from './useSerialize';
import type { UseSerializeInput } from './useSerialize';

/** A stand-in handler whose only job is to record the options it is given. */
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

function serializerFor(
	handler: PptxHandler,
	overrides: Partial<UseSerializeInput>,
): () => Promise<Uint8Array | null> {
	const input: UseSerializeInput = {
		slides: [{ id: 's1', elements: [] } as unknown as PptxSlide],
		templateElementsBySlideId: {},
		activeSlideIndex: 0,
		canvasSize: { width: 960, height: 540 },
		guides: [],
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		slideMasters: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		handlerRef: { current: handler } as React.RefObject<PptxHandler | null>,
		inlineEditingElementIdRef: { current: null },
		inlineEditingTextRef: { current: '' },
		...overrides,
	};
	let serialize: (() => Promise<Uint8Array | null>) | null = null;
	function Harness(): null {
		serialize = useSerialize(input);
		return null;
	}
	renderToStaticMarkup(createElement(Harness));
	if (!serialize) {
		throw new Error('useSerialize produced no callback');
	}
	return serialize;
}

describe('the Slide Size card reaches the save call', () => {
	it('passes the EMU slide size the viewer is holding', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			// PowerPoint's Widescreen default.
			canvasSize: { width: 1280, height: 720 },
			slideSizeEmu: { widthEmu: 12192000, heightEmu: 6858000, type: '' },
		})();

		expect(seen).toHaveLength(1);
		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 12192000,
			heightEmu: 6858000,
			type: '',
		});
	});

	it('keeps a preset that does NOT survive a pixel round-trip', async () => {
		// Ledger is 12179300 x 9134475 EMU = 1278.5 x 958.9px. Deriving the EMU
		// back from the rounded pixels would move it and cost the deck its
		// `ppSlideSizeLedgerPaper` identity, so the EMU state has to win.
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			canvasSize: { width: 1279, height: 959 },
			slideSizeEmu: { widthEmu: 12179300, heightEmu: 9134475, type: 'ledger' },
		})();

		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 12179300,
			heightEmu: 9134475,
			type: 'ledger',
		});
	});

	it('lets a hand-typed pixel size win once it disagrees with the EMU state', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			// The user typed 1600 x 900 into the raw W/H inputs.
			canvasSize: { width: 1600, height: 900 },
			slideSizeEmu: { widthEmu: 12192000, heightEmu: 6858000, type: '' },
		})();

		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 1600 * 9525,
			heightEmu: 900 * 9525,
			type: '',
		});
	});

	it('still writes a size when no deck has been loaded (EMU state absent)', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, { canvasSize: { width: 960, height: 540 } })();

		expect(seen[0]?.slideSize).toStrictEqual({
			widthEmu: 9144000,
			heightEmu: 5143500,
			// 960x540 is exactly the 16:9 on-screen preset, so the type comes back.
			type: 'screen16x9',
		});
	});
});
