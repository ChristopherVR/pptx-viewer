import { isDialogAvailable, isFeatureEnabled } from 'pptx-viewer-shared';
import type { ResolvedCustomization } from 'pptx-viewer-shared';

import type { DeckApi } from '../editor/deck-api';
import type { ExportingApi } from '../export/exporting-api';
import type { ViewerParityUiState } from './viewer-parity-ui.svelte';

/** Everything the Quick Access Toolbar's configurable commands act on. */
export interface QuickAccessCommandDeps {
	deck: DeckApi;
	exportingApi: ExportingApi;
	parityUi: ViewerParityUiState;
	/** Host customisation: a removed dialog / feature makes its command inert. */
	customization?: ResolvedCustomization;
}

/**
 * Run a Quick Access Toolbar command by catalog id. Save/Undo/Redo keep their
 * dedicated title-bar buttons (they carry the undo state), so only the
 * options-configured remainder arrives here; an unknown id is a no-op.
 *
 * Extracted from `PowerPointViewer.svelte` to keep that file under the repo's
 * file-size budget.
 */
export function runQuickAccessCommand(id: string, deps: QuickAccessCommandDeps): void {
	const { deck, exportingApi, parityUi, customization } = deps;
	if (customization && !quickAccessCommandAllowed(id, customization)) {
		return;
	}
	const handlers: Record<string, () => void> = {
		presentFromStart: () => {
			deck.goTo(0);
			deck.setMode('present');
		},
		print: () => void exportingApi.print(),
		exportPdf: () => void exportingApi.exportPdf(),
		newSlide: () => deck.addSlide(),
		spellCheck: () => {
			parityUi.preferences.spellCheck = !parityUi.preferences.spellCheck;
		},
		zoomIn: () => deck.zoomIn(),
		zoomOut: () => deck.zoomOut(),
	};
	handlers[id]?.();
}

/** The customisation gate each Quick Access command answers to. */
function quickAccessCommandAllowed(id: string, resolved: ResolvedCustomization): boolean {
	switch (id) {
		case 'presentFromStart':
			return isFeatureEnabled(resolved, 'presentMode');
		case 'print':
			return isDialogAvailable(resolved, 'print');
		case 'exportPdf':
			return isDialogAvailable(resolved, 'export') && !resolved.hiddenBackstageCards.has('pdf');
		default:
			return true;
	}
}
