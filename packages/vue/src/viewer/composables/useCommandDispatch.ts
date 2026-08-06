/**
 * useCommandDispatch: the two "run a command by id" entry points in the title
 * bar, kept out of the SFC because they are lookup tables, not presentation.
 *
 *  - `handleCommandSearch` backs the search box, whose ids are
 *    `"<category>.<action>"` strings produced by the shared command catalog.
 *  - `handleQuickAccessCommand` backs the user-configurable Quick Access
 *    Toolbar. Save / Undo / Redo keep their dedicated title-bar buttons (they
 *    carry the undo labels and the `hiddenActions` gate), so only the
 *    options-configured remainder arrives here.
 */
import type { TextStyle } from 'pptx-viewer-core';
import { DEFAULT_INSERT_CHART_KIND } from 'pptx-viewer-shared';
import type { InsertChartKind } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import type { ShapePreset } from '../components/EditorToolbar.vue';

/**
 * The actions the two dispatchers can invoke. Passed as one object so the
 * catalogs below stay flat tables; every entry is already owned by some other
 * composable, this only names them.
 */
export interface CommandDispatchActions {
	updateTextStyle: (patch: Partial<TextStyle>) => void;
	addText: () => void;
	addShape: (preset: ShapePreset) => void;
	addTable: () => void;
	addChart: (chartKind: InsertChartKind) => void;
	openImagePicker: () => void;
	openMediaPicker: () => void;
	showInsertSmartArt: Ref<boolean>;
	showEquationEditor: Ref<boolean>;
	editingEquationOmml: Ref<Record<string, unknown> | null>;
	hyperlinkOpen: Ref<boolean>;
	showGrid: Ref<boolean>;
	showRulers: Ref<boolean>;
	showSorter: Ref<boolean>;
	spellCheckEnabled: Ref<boolean>;
	themeGalleryOpen: Ref<boolean>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomReset: () => void;
	startPresenting: () => void;
	moveToEdge: (edge: string) => void;
	duplicateSelected: () => void;
	openPrintDialog: () => void;
	exportPdf: () => void | Promise<void>;
	addSlide: () => void;
}

export interface UseCommandDispatchResult {
	handleCommandSearch: (command: string) => void;
	handleQuickAccessCommand: (id: string) => void;
}

export function useCommandDispatch(actions: CommandDispatchActions): UseCommandDispatchResult {
	/**
	 * `"<category>.<action>"` to handler. A nested record rather than one flat map
	 * because the ids arrive pre-split and the categories mirror the ribbon tabs,
	 * which is how the catalog is authored.
	 */
	const catalog: Record<string, Record<string, () => void>> = {
		format: {
			bold: () => actions.updateTextStyle({ bold: true }),
			italic: () => actions.updateTextStyle({ italic: true }),
			underline: () => actions.updateTextStyle({ underline: true }),
			alignLeft: () => actions.updateTextStyle({ align: 'left' }),
			alignCenter: () => actions.updateTextStyle({ align: 'center' }),
			alignRight: () => actions.updateTextStyle({ align: 'right' }),
			clear: () =>
				actions.updateTextStyle({
					bold: false,
					italic: false,
					underline: false,
					strikethrough: false,
				}),
		},
		insert: {
			textBox: () => actions.addText(),
			shape: () => actions.addShape('rect'),
			image: () => actions.openImagePicker(),
			media: () => actions.openMediaPicker(),
			table: () => actions.addTable(),
			chart: () => actions.addChart(DEFAULT_INSERT_CHART_KIND),
			smartArt: () => {
				actions.showInsertSmartArt.value = true;
			},
			equation: () => {
				actions.editingEquationOmml.value = null;
				actions.showEquationEditor.value = true;
			},
			link: () => {
				actions.hyperlinkOpen.value = true;
			},
		},
		view: {
			toggleGrid: () => {
				actions.showGrid.value = !actions.showGrid.value;
			},
			toggleRulers: () => {
				actions.showRulers.value = !actions.showRulers.value;
			},
			slideSorter: () => {
				actions.showSorter.value = true;
			},
			zoomToFit: () => actions.zoomReset(),
		},
		slideShow: {
			fromBeginning: () => actions.startPresenting(),
			presenterView: () => actions.startPresenting(),
		},
		design: {
			browseThemes: () => {
				actions.themeGalleryOpen.value = !actions.themeGalleryOpen.value;
			},
		},
		arrange: {
			bringToFront: () => actions.moveToEdge('front'),
			sendToBack: () => actions.moveToEdge('back'),
			duplicate: () => actions.duplicateSelected(),
		},
		review: {
			spelling: () => {
				actions.spellCheckEnabled.value = !actions.spellCheckEnabled.value;
			},
		},
	};

	function handleCommandSearch(command: string): void {
		const [category, action] = command.split('.');
		if (category === undefined || action === undefined) {
			return;
		}
		catalog[category]?.[action]?.();
	}

	function handleQuickAccessCommand(id: string): void {
		const handlers: Record<string, () => void> = {
			presentFromStart: () => actions.startPresenting(),
			print: () => actions.openPrintDialog(),
			exportPdf: () => void actions.exportPdf(),
			newSlide: () => actions.addSlide(),
			spellCheck: () => {
				actions.spellCheckEnabled.value = !actions.spellCheckEnabled.value;
			},
			zoomIn: actions.zoomIn,
			zoomOut: actions.zoomOut,
		};
		handlers[id]?.();
	}

	return { handleCommandSearch, handleQuickAccessCommand };
}
