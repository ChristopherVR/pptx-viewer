// @vitest-environment node
/**
 * Does a table style DEFINITION edit ("Edit style...") reach the saved file?
 *
 * `TablePropertiesPanel`/`TableStyleEditor` were wired in W4-E but nothing
 * threaded `tableStyleMap`/`tableStylesDefaultId`/`tableStylesToDelete` into
 * `useSerialize`'s `saveOptions`, so an edit rendered live but reverted on
 * reload, same failure mode `useSerialize.view-properties.test.ts` documents
 * for `viewProperties`.
 */
import type {
	ParsedTableStyleMap,
	PptxHandler,
	PptxHandlerSaveOptions,
	PptxSlide,
} from 'pptx-viewer-core';
import type React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useSerialize } from './useSerialize';
import type { SerializeSlides, UseSerializeInput } from './useSerialize';

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
): SerializeSlides {
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
	let serialize: SerializeSlides | null = null;
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

const STYLE_MAP: ParsedTableStyleMap = {
	'{guid}': { styleId: '{guid}', styleName: 'Edited' },
};

describe('a table style editor edit reaches the save call', () => {
	it('passes an edited tableStyleMap through to saveOptions.tableStyles', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, { tableStyleMap: STYLE_MAP })();

		expect(seen).toHaveLength(1);
		expect(seen[0]?.tableStyles).toStrictEqual(STYLE_MAP);
	});

	it('passes tableStylesDefaultId through unchanged', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, { tableStylesDefaultId: '{guid}' })();

		expect(seen[0]?.tableStylesDefaultId).toBe('{guid}');
	});

	it('passes tableStylesToDelete through so a deleted style is actually removed', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, { tableStylesToDelete: ['{deleted-guid}'] })();

		expect(seen[0]?.tableStylesToDelete).toStrictEqual(['{deleted-guid}']);
	});

	it('omits all three fields when the caller supplies none', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {})();

		expect(seen[0]?.tableStyles).toBeUndefined();
		expect(seen[0]?.tableStylesDefaultId).toBeUndefined();
		expect(seen[0]?.tableStylesToDelete).toBeUndefined();
	});
});

describe('save As reuses the same serialiser with an output format', () => {
	it('forwards the format as outputFormat next to every other save option', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {
			tableStyleMap: STYLE_MAP,
			tableStylesToDelete: ['{deleted-guid}'],
			viewProperties: { showGuides: true },
		})('ppsx');

		expect(seen).toHaveLength(1);
		expect(seen[0]?.outputFormat).toBe('ppsx');
		// The options Save As used to drop when it assembled its own object.
		expect(seen[0]?.tableStyles).toStrictEqual(STYLE_MAP);
		expect(seen[0]?.tableStylesToDelete).toStrictEqual(['{deleted-guid}']);
		expect(seen[0]?.viewProperties).toStrictEqual({ showGuides: true });
	});

	it('leaves outputFormat unset for a plain save', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {})();

		expect(seen[0]?.outputFormat).toBeUndefined();
	});
});
