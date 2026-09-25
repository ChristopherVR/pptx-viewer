import type { PptxElement } from 'pptx-viewer-core';
import type { RibbonGalleryApplyResult } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { DeckActions } from './editor-deck-actions';
import type { EditorOps } from './editor-operations';

/**
 * The ribbon style galleries' dispatcher. What a pick writes is decided by the
 * shared `applyRibbonGalleryItem`; this only routes the result onto the
 * binding's existing history-integrated paths: an element patch merges onto
 * the named element (push -> mutate -> commit, the same shape every inspector
 * edit takes), and a theme colour / font scheme goes through the inspector
 * THEME EDITOR card's `applyThemeEdit`, which re-resolves every scheme colour.
 */
export interface GalleryActions {
	applyRibbonGalleryResult(result: RibbonGalleryApplyResult): void;
}

export interface GalleryActionsDeps {
	store: Store<ViewerState>;
	ops: Pick<EditorOps, 'pushHistory' | 'commitChange'>;
	deck: Pick<DeckActions, 'applyThemeEdit'>;
}

export function createGalleryActions(deps: GalleryActionsDeps): GalleryActions {
	const { store, ops, deck } = deps;
	return {
		applyRibbonGalleryResult(result) {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			if (result.kind === 'element') {
				const elements = getActiveElements(state);
				if (!elements.some((element) => element.id === result.elementId)) {
					return;
				}
				ops.pushHistory();
				store.set(
					replaceActiveElements(
						state,
						elements.map((element) =>
							element.id === result.elementId
								? ({ ...element, ...result.patch } as PptxElement)
								: element,
						),
					),
				);
				ops.commitChange();
				return;
			}
			if (result.kind === 'themeColorScheme') {
				deck.applyThemeEdit({
					colorScheme: result.colorScheme,
					fontScheme: state.fontScheme ?? {},
					name: result.name,
				});
				return;
			}
			if (!state.colorScheme) {
				return;
			}
			deck.applyThemeEdit({
				colorScheme: state.colorScheme,
				fontScheme: result.fontScheme,
				name: result.name,
			});
		},
	};
}
