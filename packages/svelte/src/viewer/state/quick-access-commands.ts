import type { DeckApi } from '../editor/deck-api';
import type { ExportingApi } from '../export/exporting-api';
import type { ViewerParityUiState } from './viewer-parity-ui.svelte';

/** Everything the Quick Access Toolbar's configurable commands act on. */
export interface QuickAccessCommandDeps {
	deck: DeckApi;
	exportingApi: ExportingApi;
	parityUi: ViewerParityUiState;
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
	const { deck, exportingApi, parityUi } = deps;
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
