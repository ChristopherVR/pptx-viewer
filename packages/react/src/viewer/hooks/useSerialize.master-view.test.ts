// @vitest-environment node
/**
 * Do View > Slide Master edits reach the saved file?
 *
 * They did not. React was the only binding whose save options carried no
 * `slideMasters` array, and core rewrites a master or layout part only for the
 * parts the caller hands back, so every master-view edit was viewer-local: a
 * deleted master shape came back on reload and a picked master background
 * reverted to white. Vue, Angular, Svelte and Vanilla all passed it.
 *
 * This asserts on the OPTIONS OBJECT the real `useSerialize` hands the real
 * save path, because that is what the bug was about: the master-view routing
 * itself (`replaceMasterViewElements` and friends) was already correct and
 * unit-tested, and stayed green throughout.
 */
import type {
	PptxHandler,
	PptxHandlerSaveOptions,
	PptxElement,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import type React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useSerialize } from './useSerialize';
import type { UseSerializeInput } from './useSerialize';

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout1.xml';

function editedMasters(): PptxSlideMaster[] {
	return [
		{
			path: MASTER_PATH,
			backgroundColor: '#2f6f4f',
			// The master shape the user just deleted in the Slides tab.
			elements: [],
			layouts: [{ path: LAYOUT_PATH, elements: [] }],
		},
	];
}

/** A stand-in handler whose only job is to record the options it is given. */
function recordingHandler(): {
	handler: PptxHandler;
	seen: PptxHandlerSaveOptions[];
	savedSlides: PptxSlide[][];
} {
	const seen: PptxHandlerSaveOptions[] = [];
	const savedSlides: PptxSlide[][] = [];
	const handler = {
		save: (_slides: PptxSlide[], options?: PptxHandlerSaveOptions) => {
			savedSlides.push(_slides);
			seen.push(options ?? {});
			return Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		},
	} as unknown as PptxHandler;
	return { handler, seen, savedSlides };
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

describe('the Slide Master view reaches the save call', () => {
	const element: PptxElement = {
		id: 'live-list',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'Item',
		textSegments: [{ text: 'Item', style: { fontSize: 12 }, bulletInfo: { char: '•' } }],
	};
	const snapshot = {
		elementId: element.id,
		text: 'Item\nNew',
		textSegments: [
			{ text: 'Item', style: { fontSize: 12 }, bulletInfo: { char: '•' } },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{
				text: 'New',
				style: { fontSize: 32, bold: true },
				bulletInfo: { char: '•' },
				paragraphLevel: 1,
			},
		],
	};
	const pending = {
		inlineEditingElementIdRef: { current: element.id },
		inlineEditingTextRef: { current: snapshot.text },
		inlineEditingSnapshotRef: { current: snapshot },
	};

	it('saves a pending list draft only to the active slide, without mutating either model', async () => {
		const { handler, savedSlides } = recordingHandler();
		const slides = ['s1', 's2'].map((id) => ({ id, elements: [element] }) as PptxSlide);
		await serializerFor(handler, { ...pending, slides, activeSlideIndex: 1 })();
		expect(savedSlides[0][0].elements[0]).toBe(element);
		expect(savedSlides[0][1].elements[0]).toMatchObject({
			text: snapshot.text,
			textSegments: snapshot.textSegments,
		});
		expect(slides[1].elements[0]).toBe(element);
		expect(element).toMatchObject({ text: 'Item' });
	});

	it('saves the active layout list draft through master options, not a same-ID slide', async () => {
		const { handler, seen, savedSlides } = recordingHandler();
		const slideMasters = editedMasters();
		slideMasters[0].layouts![0].elements = [element];
		await serializerFor(handler, {
			...pending,
			slideMasters,
			slides: [{ id: 's1', elements: [element] } as PptxSlide],
			masterViewTarget: { tab: 'slides', masterIndex: 0, layoutIndex: 0 },
		})();
		expect(seen[0].slideMasters?.[0].layouts?.[0].elements[0]).toMatchObject({
			text: snapshot.text,
			textSegments: snapshot.textSegments,
		});
		expect(savedSlides[0][0].elements[0]).toBe(element);
		expect(slideMasters[0].layouts![0].elements[0]).toBe(element);
	});

	it('passes the edited masters, with their layouts', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, { slideMasters: editedMasters() })();

		expect(seen).toHaveLength(1);
		expect(seen[0]?.slideMasters).toHaveLength(1);
		expect(seen[0]?.slideMasters?.[0].path).toBe(MASTER_PATH);
		// The deletion and the background pick both have to travel: core reads
		// the element list to rewrite the shape tree and `backgroundColor` to
		// rewrite `p:bg`.
		expect(seen[0]?.slideMasters?.[0].elements).toStrictEqual([]);
		expect(seen[0]?.slideMasters?.[0].backgroundColor).toBe('#2f6f4f');
		// A layout-level edit rides in on the same array; no binding passes the
		// separate `slideLayouts` option, so this is the only route it has.
		expect(seen[0]?.slideMasters?.[0].layouts?.[0].path).toBe(LAYOUT_PATH);
	});

	it('passes an empty array unchanged for a deck with no masters', async () => {
		const { handler, seen } = recordingHandler();
		await serializerFor(handler, {})();

		expect(seen[0]?.slideMasters).toStrictEqual([]);
	});
});
