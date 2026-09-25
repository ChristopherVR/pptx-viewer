/**
 * useRibbonGalleryHost: the viewer-side half of the ribbon style galleries.
 *
 * Every gallery decision (what a gallery offers, how a tile looks, what a
 * pick writes) is made by `buildRibbonGallery` / `applyRibbonGalleryItem` in
 * `pptx-viewer-shared`. This composable only supplies what those calls need
 * from the loaded deck (the {@link RibbonGalleryContext}) and routes an apply
 * result onto the viewer's existing, history-aware update paths: element
 * patches through `ops.updateElement` (the same path the inspector's Quick
 * Styles use) and scheme swaps through the Design tab's theme editor.
 *
 * `PowerPointViewer` provides it under {@link RibbonGalleryHostKey}; gallery
 * components read it with {@link useRibbonGalleryHost}, which falls back to an
 * inert host (no selection, no-op dispatch) when mounted standalone.
 */
import type { PptxElement, PptxHandler, PptxTheme } from 'pptx-viewer-core';
import type { RibbonGalleryApplyResult, RibbonGalleryContext } from 'pptx-viewer-shared';
import { computed, inject, provide } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';

export interface RibbonGalleryHost {
	/** The context every descriptor is built from; rebuilt on selection / deck change. */
	context: ComputedRef<RibbonGalleryContext>;
	/** Carry out what a tile pick asked for. */
	dispatch: (result: RibbonGalleryApplyResult) => void;
}

export const RibbonGalleryHostKey: InjectionKey<RibbonGalleryHost> =
	Symbol('pptxRibbonGalleryHost');

/** Where an apply result lands. */
export interface RibbonGallerySinks {
	/** History-tracked element update (shallow top-level merge). */
	updateElement: (id: string, patch: Partial<PptxElement>) => void;
	/** Deck-wide theme update; unset scheme parts keep the current theme's. */
	applyTheme: (updates: Partial<PptxTheme>) => void;
}

/** Route one apply result to its sink. */
export function dispatchRibbonGalleryResult(
	result: RibbonGalleryApplyResult,
	sinks: RibbonGallerySinks,
): void {
	switch (result.kind) {
		case 'element':
			sinks.updateElement(result.elementId, result.patch);
			return;
		case 'themeColorScheme':
			sinks.applyTheme({ colorScheme: result.colorScheme });
			return;
		case 'themeFontScheme':
			sinks.applyTheme({ fontScheme: result.fontScheme });
	}
}

export interface UseRibbonGalleryHostInput extends RibbonGallerySinks {
	/** The primary selected element, or null. */
	selectedElement: () => PptxElement | null;
	theme: Ref<PptxTheme | undefined>;
	themeColorMap: Ref<Record<string, string> | undefined>;
	handler: ShallowRef<PptxHandler | null>;
}

/** Build and provide the gallery host for the viewer's ribbon. */
export function provideRibbonGalleryHost(input: UseRibbonGalleryHostInput): RibbonGalleryHost {
	const context = computed<RibbonGalleryContext>(() => {
		const handler = input.handler.value;
		return {
			element: input.selectedElement(),
			theme: input.theme.value,
			themeColorMap: input.themeColorMap.value,
			resolveStyleMatrix: handler ? (xml) => handler.resolveStyleMatrixReferences(xml) : undefined,
		};
	});
	const host: RibbonGalleryHost = {
		context,
		dispatch: (result) => dispatchRibbonGalleryResult(result, input),
	};
	provide(RibbonGalleryHostKey, host);
	return host;
}

const INERT_HOST: RibbonGalleryHost = {
	context: computed(() => ({ element: null })),
	dispatch: () => {},
};

/** The provided gallery host, or an inert one outside a viewer. */
export function useRibbonGalleryHost(): RibbonGalleryHost {
	return inject(RibbonGalleryHostKey, INERT_HOST);
}
