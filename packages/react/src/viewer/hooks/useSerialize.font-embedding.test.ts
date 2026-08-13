// @vitest-environment node
/**
 * Does File > Fonts > "Embed fonts in the file" reach the save call?
 *
 * It did not. Every binding stored an `embedFontsEnabled` boolean, rendered a
 * switch for it, and passed it to nothing: the saved bytes were identical in
 * either position. Core has supported this the whole time (`embeddedFontList:
 * null` strips `p:embeddedFontLst`, the `/font` relationships and the `.fntdata`
 * parts; omitting it re-embeds losslessly), so the toggle was purely decorative.
 *
 * This asserts on the OPTIONS OBJECT the real `useSerialize` hands the real save
 * helper, in both positions, because that is the thing the bug was about. A test
 * that only called `embeddedFontSaveOptions` would pass whether or not
 * `useSerialize` ever spread it.
 */
import type { PptxHandler, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import type React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useSerialize } from './useSerialize';
import type { UseSerializeInput } from './useSerialize';

/**
 * A stand-in handler whose only job is to record the options it is given.
 * `saveDeckWithPassword` (shared) is left in the path deliberately: it is what
 * chooses `save` vs `saveEncrypted`, and a font option that got dropped there
 * would be just as invisible to the user.
 */
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

/** Run the real hook once and return the callback it produced. */
function serializerFor(
	embedFonts: boolean,
	handler: PptxHandler,
): () => Promise<Uint8Array | null> {
	const handlerRef = { current: handler } as React.RefObject<PptxHandler | null>;
	let serialize: (() => Promise<Uint8Array | null>) | null = null;
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
		handlerRef,
		inlineEditingElementIdRef: { current: null },
		inlineEditingTextRef: { current: '' },
		embedFonts,
	};
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

describe('the Embed Fonts toggle reaches the save call', () => {
	it('asks core to strip the embedded font data when the toggle is off', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(false, handler)();

		expect(seen).toHaveLength(1);
		// `null`, not `undefined`: core reads `undefined` as "no opinion" and
		// re-embeds, which is exactly the no-op the toggle used to be.
		expect(seen[0]?.embeddedFontList).toBeNull();
	});

	it('says nothing about fonts when the toggle is on, so core re-embeds', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(true, handler)();

		expect(seen).toHaveLength(1);
		expect('embeddedFontList' in (seen[0] ?? {})).toBeFalsy();
	});

	it('defaults to keeping them, so a host that never wires the toggle loses nothing', async () => {
		const { handler, seen } = recordingHandler();
		const handlerRef = { current: handler } as React.RefObject<PptxHandler | null>;
		let serialize: (() => Promise<Uint8Array | null>) | null = null;
		function Harness(): null {
			serialize = useSerialize({
				slides: [],
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
				notesMaster: undefined,
				handoutMaster: undefined,
				handlerRef,
				inlineEditingElementIdRef: { current: null },
				inlineEditingTextRef: { current: '' },
			});
			return null;
		}
		renderToStaticMarkup(createElement(Harness));
		await (serialize as unknown as () => Promise<Uint8Array | null>)();

		expect('embeddedFontList' in (seen[0] ?? {})).toBeFalsy();
	});
});

// The shared decision itself is covered in
// packages/shared/src/render/font-embedding.test.ts; nothing here re-implements it.
