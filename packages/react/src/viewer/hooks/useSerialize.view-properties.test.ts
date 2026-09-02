// @vitest-environment node
/**
 * Does a View-ribbon grid/snap/guides toggle reach the saved file?
 *
 * It did not. `useSerialize` never included `viewProperties` in `saveOptions`
 * at all, so core's save pipeline fell back to `this.loadedViewProperties`
 * (the deck as it was FIRST opened) unconditionally: even after the wave-4
 * `useViewPreferencesSync` wiring updated `state.viewProperties` in response
 * to a toggle, that updated value never reached the save call, and reopening
 * a saved deck silently reverted every session change to Snap to Grid, Snap
 * to Objects and Show Guides.
 *
 * This asserts on the OPTIONS OBJECT the real `useSerialize` hands the real
 * save path, because that is the thing the bug was about; a test that only
 * exercised `viewPropertiesPatchFromPreferences` would pass whether or not
 * `useSerialize` ever forwarded the result.
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

describe('a View-ribbon toggle reaches the save call', () => {
	it('passes a changed snapToGrid through to saveOptions.viewProperties', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			viewProperties: {
				slideViewPr: { snapToGrid: false, snapToObjects: true, showGuides: true },
			},
		})();

		expect(seen).toHaveLength(1);
		expect(seen[0]?.viewProperties?.slideViewPr?.snapToGrid).toBeFalsy();
	});

	it('omits viewProperties (undefined) when the caller supplies none', async () => {
		// Reproduces the pre-fix state for a not-yet-loaded deck: core's own
		// `this.loadedViewProperties` fallback still applies, unchanged.
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {})();

		expect(seen[0]?.viewProperties).toBeUndefined();
	});

	it('preserves grid spacing alongside a toggle change', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			viewProperties: {
				slideViewPr: { snapToGrid: true, snapToObjects: false, showGuides: false },
				gridSpacing: { cx: 72008, cy: 72008 },
			},
		})();

		expect(seen[0]?.viewProperties?.gridSpacing).toStrictEqual({ cx: 72008, cy: 72008 });
	});
});
