import { DEFAULT_INSERT_CHART_KIND, registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	FreeformToolKind,
	InsertChartKind,
	RibbonInsertRequestEvent,
	RibbonInsertState,
	ShapePresetType,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { RibbonInsertHandlers } from '../ribbon-types';
import { createSmartArtDialog } from './insert/smartart-dialog';

export interface InsertTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Gate the selection-scoped commands (Link attaches to a selected element). */
	setHasSelection(hasSelection: boolean): void;
	/** Reflect the armed Freeform: Shape / Curve tool. */
	setFreeformTool(tool: FreeformToolKind | null): void;
	/** Open the SmartArt gallery dialog (title-bar command search). */
	openSmartArt(): void;
}

/**
 * The Insert ribbon tab: a thin adapter over the shared `pptx-ui-ribbon-insert`,
 * which owns the groups, icons, labels, shape/chart pickers, Freeform tools and the
 * Action / Field menus. Every insertion routes through `RibbonInsertHandlers`
 * (backed by `EditActions`, so it's undoable and selects the new element), except
 * Equation, which opens the modal equation editor dialog, Hyperlink, which opens the
 * link editor for the current selection, Header & Footer, which opens the viewer's
 * own dialog, and SmartArt, whose gallery dialog stays native to this binding.
 */
export function createInsertTab(
	doc: Document,
	t: Translator,
	handlers: RibbonInsertHandlers,
	onToggleEquationPanel: () => void,
	onOpenHeaderFooter: () => void,
	onOpenHyperlink: () => void,
): InsertTab {
	registerPptxWebControls();
	// The pane keeps the ribbon's shared row layout (scrolling when narrow).
	const el = doc.createElement('div');
	el.className = 'pptxv-ribbon-tab-content';
	const shared = doc.createElement('pptx-ui-ribbon-insert');
	el.append(shared);
	const smartArt = createSmartArtDialog(doc, t, (layout, defaultItems) =>
		handlers.insertSmartArt(layout, defaultItems),
	);
	let state: RibbonInsertState = {
		editable: true,
		hasSelection: false,
		shapeType: 'rect',
		chartKind: DEFAULT_INSERT_CHART_KIND,
		activeFreeformTool: null,
		freeformTools: handlers.armFreeformTool ? (handlers.visibleDrawingTools?.() ?? []) : [],
		translate: t,
	};
	const sync = () => {
		shared.state = state;
	};
	shared.addEventListener('insert-request', (event) => {
		const intent = (event as RibbonInsertRequestEvent).detail;
		switch (intent.kind) {
			case 'command':
				switch (intent.value) {
					case 'textBox':
						handlers.insert('text');
						break;
					case 'table':
						handlers.insert('table');
						break;
					case 'image':
						void handlers.insertImage();
						break;
					case 'media':
						void handlers.insertMedia();
						break;
					case 'smartArt':
						smartArt.open(el.closest<HTMLElement>('.pptxv') ?? doc.body, () =>
							shared.focusControl('insert.illustrations.smartArt'),
						);
						break;
					case 'equation':
						onToggleEquationPanel();
						break;
					case 'link':
						onOpenHyperlink();
						break;
					case 'headerFooter':
						onOpenHeaderFooter();
				}
				break;
			case 'shapeType':
				state = { ...state, shapeType: intent.value };
				sync();
				break;
			case 'shape':
				handlers.insert('shape', intent.value as ShapePresetType);
				break;
			case 'chartType':
				state = { ...state, chartKind: intent.value };
				sync();
				break;
			case 'chart':
				handlers.insertChart(intent.value as InsertChartKind);
				break;
			case 'freeform':
				handlers.armFreeformTool?.(intent.value as FreeformToolKind | null);
				break;
			case 'actionButton':
				handlers.insertActionButton(intent.value);
				break;
			case 'field':
				handlers.insertField(intent.value);
		}
	});
	sync();
	return {
		el,
		openSmartArt: () => smartArt.open(el.closest<HTMLElement>('.pptxv') ?? doc.body, () => {}),
		setEditable(editable) {
			state = { ...state, editable };
			if (!editable) {
				smartArt.close();
			}
			sync();
		},
		setHasSelection(hasSelection) {
			state = { ...state, hasSelection };
			sync();
		},
		setFreeformTool(tool) {
			state = { ...state, activeFreeformTool: tool };
			sync();
		},
	};
}
