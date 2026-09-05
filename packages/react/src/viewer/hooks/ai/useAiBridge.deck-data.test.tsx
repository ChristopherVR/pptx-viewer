// @vitest-environment happy-dom
/**
 * `getDeckData`/`applyDeckData` must round-trip `viewProperties`,
 * `tableStyleMap`, `tableStylesDefaultId` and `tags`, the same as the main
 * Save/Export path (`useSerialize`'s `buildDeckSaveOptions` call): before this
 * fix the AI bridge silently omitted them, so an MCP deck tool operating on
 * `getDeckData()` could not see or commit a table style or view-property
 * edit even though a manual Ctrl+S would have persisted it.
 */
import type { ParsedTableStyleMap, PptxSlide, PptxViewProperties } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { UseAiBridgeInput } from './useAiBridge';
import { useAiBridge } from './useAiBridge';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function slides(): PptxSlide[] {
	return [{ id: 's0', slideNumber: 1, elements: [] }] as unknown as PptxSlide[];
}

function baseInput(overrides: Partial<UseAiBridgeInput> = {}): UseAiBridgeInput {
	return {
		slides: slides(),
		activeSlideIndex: 0,
		canvasSize: { width: 960, height: 540 },
		theme: undefined,
		selectedElementId: null,
		selectedElementIds: [],
		pinnedFocus: null,
		handlerRef: { current: null },
		sections: [],
		presentationProperties: {},
		customProperties: [],
		coreProperties: undefined,
		appProperties: undefined,
		viewProperties: undefined,
		tableStyleMap: undefined,
		tableStylesDefaultId: undefined,
		tagCollections: [],
		setSlides: () => {},
		setActiveSlideIndex: () => {},
		setCanvasSize: () => {},
		setSections: () => {},
		setPresentationProperties: () => {},
		setCustomProperties: () => {},
		setCoreProperties: () => {},
		setAppProperties: () => {},
		setViewProperties: () => {},
		setTableStyleMap: () => {},
		setTableStylesDefaultId: () => {},
		setTagCollections: () => {},
		applySelection: () => {},
		bumpHistory: () => {},
		markDirty: () => {},
		applyThemeUpdates: () => {},
		...overrides,
	};
}

describe('useAiBridge deck-data metadata parity', () => {
	it('getDeckData exposes viewProperties/tableStyleMap/tableStylesDefaultId/tags', () => {
		const viewProperties: PptxViewProperties = { showComments: true };
		const tableStyleMap: ParsedTableStyleMap = {
			'{guid}': { styleId: '{guid}', styleName: 'Style' },
		};
		let captured: ReturnType<typeof useAiBridge> | null = null;
		function Probe(): null {
			captured = useAiBridge(
				baseInput({
					viewProperties,
					tableStyleMap,
					tableStylesDefaultId: '{guid}',
					tagCollections: [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] }],
				}),
			);
			return null;
		}
		act(() => root.render(<Probe />));
		const deckData = captured?.getDeckData?.();
		expect(deckData?.viewProperties).toStrictEqual(viewProperties);
		expect(deckData?.tableStyleMap).toStrictEqual(tableStyleMap);
		expect(deckData?.tableStylesDefaultId).toBe('{guid}');
		expect(deckData?.tags).toStrictEqual([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] },
		]);
	});

	it('applyDeckData commits a changed viewProperties/tableStyleMap/tags back through the setters', () => {
		const setViewPropertiesCalls: (PptxViewProperties | undefined)[] = [];
		const setTableStyleMapCalls: (ParsedTableStyleMap | undefined)[] = [];
		const setTagsCalls: unknown[] = [];
		let captured: ReturnType<typeof useAiBridge> | null = null;
		function Probe(): null {
			captured = useAiBridge(
				baseInput({
					setViewProperties: (v) => setViewPropertiesCalls.push(v),
					setTableStyleMap: (m) => setTableStyleMapCalls.push(m),
					setTagCollections: (t) => setTagsCalls.push(t),
				}),
			);
			return null;
		}
		act(() => root.render(<Probe />));

		act(() => {
			captured?.applyDeckData?.((data) => {
				data.viewProperties = { showComments: false };
				data.tableStyleMap = { '{new}': { styleId: '{new}', styleName: 'New' } };
				data.tags = [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] }];
				return data;
			}, 'test');
		});

		expect(setViewPropertiesCalls).toStrictEqual([{ showComments: false }]);
		expect(setTableStyleMapCalls).toStrictEqual([
			{ '{new}': { styleId: '{new}', styleName: 'New' } },
		]);
		expect(setTagsCalls).toStrictEqual([
			[{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'a', value: 'b' }] }],
		]);
	});

	it('applyDeckData is a no-op for unchanged metadata fields', () => {
		let setViewPropertiesCalls = 0;
		let captured: ReturnType<typeof useAiBridge> | null = null;
		function Probe(): null {
			captured = useAiBridge(
				baseInput({
					viewProperties: { showComments: true },
					setViewProperties: () => {
						setViewPropertiesCalls += 1;
					},
				}),
			);
			return null;
		}
		act(() => root.render(<Probe />));

		act(() => {
			captured?.applyDeckData?.((data) => data, 'noop');
		});

		expect(setViewPropertiesCalls).toBe(0);
	});
});
