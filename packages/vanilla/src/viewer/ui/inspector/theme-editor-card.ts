import { registerPptxWebControls, themeEditorLabels } from 'pptx-viewer-shared';
import type { ThemeEditorApplyEvent } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { DeckCard } from './deck-card-helpers';
import type { InspectorDeckState, InspectorHandlers } from './types';

export type ThemeEditorCardState = Pick<
	InspectorDeckState,
	'editable' | 'colorScheme' | 'fontScheme' | 'themeName'
>;
export interface ThemeEditorCard extends DeckCard {
	update(state: ThemeEditorCardState): void;
}

/** Native callback/state adapter for the shared view. */
export function createThemeEditorCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'applyThemeEdit'>,
	options: { inline?: boolean; onClose?: () => void } = {},
): ThemeEditorCard {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-theme-editor');
	if (options.inline !== false) {
		el.setAttribute('inline', '');
	}
	el.labels = themeEditorLabels(t);
	let busy = false;
	let editable = true;
	el.addEventListener('theme-editor-apply', (event) => {
		if (!el.disabled && !busy) {
			busy = true;
			el.disabled = true;
			void Promise.resolve(
				handlers.applyThemeEdit((event as ThemeEditorApplyEvent).detail),
			).finally(() => {
				busy = false;
				el.disabled = !editable;
			});
		}
	});
	el.addEventListener('theme-editor-close', () => options.onClose?.());
	return {
		el,
		update(state) {
			editable = state.editable;
			el.disabled = !editable || busy;
			el.theme = {
				name: state.themeName,
				colorScheme: state.colorScheme,
				fontScheme: state.fontScheme,
			};
		},
	};
}
