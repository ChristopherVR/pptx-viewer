/**
 * The ribbon galleries' link to the editor: it builds the shared
 * `RibbonGalleryContext` from the editor's live selection and deck, asks
 * shared for descriptors, and dispatches a pick's `RibbonGalleryApplyResult`
 * onto this binding's existing update paths (the undoable element patch the
 * inspector uses, and the theme editor's scheme path). Every decision about
 * WHAT a gallery offers lives in `pptx-viewer-shared`.
 *
 * Published to the ribbon subtree through Svelte context so every tab (Home,
 * Design and the contextual tabs) reaches the same host without prop
 * threading.
 */
import type { PptxTheme, XmlObject } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { applyRibbonGalleryItem, buildRibbonGallery } from 'pptx-viewer-shared';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
	RibbonGalleryId,
} from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

import type { EditorState } from '../../../editor/editor-state.svelte';
import { applyThemeColorScheme, applyThemeFontScheme } from '../../../editor/editor-theme-scheme';

export interface RibbonGalleryHost {
	/** The context shared galleries read; reading it inside `$derived` tracks the editor. */
	context(): RibbonGalleryContext;
	build(id: RibbonGalleryId): RibbonGalleryDescriptor;
	/** Apply tile `itemId` of gallery `id` to the selection / deck. */
	apply(id: RibbonGalleryId, itemId: string): Promise<void>;
}

/** Build the host over `editor`; `onthemechange` publishes a new presentation theme. */
export function createRibbonGalleryHost(
	editor: EditorState,
	onthemechange?: (theme: PptxTheme) => void,
): RibbonGalleryHost {
	const context = (): RibbonGalleryContext => {
		const handler = editor.getHandler();
		return {
			element: editor.selectedElement ?? null,
			themeColorMap: editor.themeColorMap,
			theme: editor.theme,
			resolveStyleMatrix: handler
				? (xml: XmlObject) => handler.resolveStyleMatrixReferences(xml)
				: undefined,
		};
	};

	async function dispatch(result: RibbonGalleryApplyResult): Promise<void> {
		if (result.kind === 'element') {
			editor.applyElementPatch(result.elementId, result.patch);
			return;
		}
		const handler = editor.getHandler();
		if (!handler || !editor.editable) {
			return;
		}
		const current: PptxTheme = editor.theme ?? {
			name: 'Custom Theme',
			colorScheme: THEME_PRESETS[0].colorScheme,
			fontScheme: THEME_PRESETS[0].fontScheme,
		};
		const next =
			result.kind === 'themeColorScheme'
				? await applyThemeColorScheme(editor, handler, current, result.colorScheme)
				: await applyThemeFontScheme(handler, current, result.fontScheme);
		editor.theme = next;
		onthemechange?.(next);
	}

	return {
		context,
		build: (id) => buildRibbonGallery(id, context()),
		apply: async (id, itemId) => {
			const result = applyRibbonGalleryItem(id, itemId, context());
			if (result) {
				await dispatch(result);
			}
		},
	};
}

const RIBBON_GALLERY_HOST_KEY = Symbol('pptx-svelte-ribbon-gallery-host');

/** Publish `host` to the ribbon subtree (Ribbon.svelte, or a test harness). */
export function provideRibbonGalleryHost(host: RibbonGalleryHost): void {
	setContext(RIBBON_GALLERY_HOST_KEY, host);
}

/** The nearest host, or undefined when a gallery is mounted outside a ribbon. */
export function useRibbonGalleryHost(): RibbonGalleryHost | undefined {
	return getContext<RibbonGalleryHost | undefined>(RIBBON_GALLERY_HOST_KEY);
}

/** A context map carrying `host`, for `mount(Component, { context })` in tests. */
export function ribbonGalleryHostContext(host: RibbonGalleryHost): Map<symbol, unknown> {
	return new Map<symbol, unknown>([[RIBBON_GALLERY_HOST_KEY, host]]);
}
