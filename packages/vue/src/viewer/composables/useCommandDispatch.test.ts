import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useCommandDispatch } from './useCommandDispatch';
import type { CommandDispatchActions } from './useCommandDispatch';

function actions(): CommandDispatchActions & {
	startPresentingCalls: number;
	presentFromBeginningCalls: number;
} {
	const result = {
		updateTextStyle: () => {},
		addText: () => {},
		addShape: () => {},
		addTable: () => {},
		addChart: () => {},
		openImagePicker: () => {},
		openMediaPicker: () => {},
		showInsertSmartArt: ref(false),
		showEquationEditor: ref(false),
		editingEquationOmml: ref(null),
		hyperlinkOpen: ref(false),
		showGrid: ref(false),
		showRulers: ref(false),
		showSorter: ref(false),
		spellCheckEnabled: ref(false),
		themeGalleryOpen: ref(false),
		zoomIn: () => {},
		zoomOut: () => {},
		zoomReset: () => {},
		startPresenting: () => {
			result.startPresentingCalls += 1;
		},
		presentFromBeginning: () => {
			result.presentFromBeginningCalls += 1;
		},
		moveToEdge: () => {},
		duplicateSelected: () => {},
		openPrintDialog: () => {},
		exportPdf: () => {},
		addSlide: () => {},
		startPresentingCalls: 0,
		presentFromBeginningCalls: 0,
	};
	return result;
}

/**
 * "Slide Show > From Beginning" and the quick-access "Present from start"
 * command used to call the SAME `startPresenting()` as every other entry
 * point, so the show could not tell "from beginning" apart from "from current
 * slide" (wave-4 B1). Both now dispatch to `presentFromBeginning`.
 */
describe('useCommandDispatch: slide show entry points', () => {
	it('routes "slideShow.fromBeginning" to presentFromBeginning, not startPresenting', () => {
		const a = actions();
		const { handleCommandSearch } = useCommandDispatch(a);
		handleCommandSearch('slideShow.fromBeginning');
		expect(a.presentFromBeginningCalls).toBe(1);
		expect(a.startPresentingCalls).toBe(0);
	});

	it('routes the quick-access "presentFromStart" command to presentFromBeginning', () => {
		const a = actions();
		const { handleQuickAccessCommand } = useCommandDispatch(a);
		handleQuickAccessCommand('presentFromStart');
		expect(a.presentFromBeginningCalls).toBe(1);
		expect(a.startPresentingCalls).toBe(0);
	});

	it('routes "slideShow.presenterView" to startPresenting (from current slide)', () => {
		const a = actions();
		const { handleCommandSearch } = useCommandDispatch(a);
		handleCommandSearch('slideShow.presenterView');
		expect(a.startPresentingCalls).toBe(1);
		expect(a.presentFromBeginningCalls).toBe(0);
	});
});
