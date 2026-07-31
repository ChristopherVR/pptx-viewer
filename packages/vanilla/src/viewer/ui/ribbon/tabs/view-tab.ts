import type { ToolbarActionId } from 'pptx-viewer-shared';
import { isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers } from '../ribbon-types';

/** The View > Show toggles, as the viewer state currently holds them. */
export interface ViewToggleState {
	showGrid: boolean;
	showRulers: boolean;
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
}

export interface ViewTab {
	el: HTMLElement;
	setTemplateEditing(active: boolean): void;
	setEditable(editable: boolean): void;
	/** Reflect the Show group's toggles (pressed styling) from viewer state. */
	setViewOptions(options: ViewToggleState): void;
}

/**
 * The View ribbon tab: Presentation Views, Master Views, Show, Zoom and
 * Window, matching React's `ViewSection` command for command.
 *
 * Zoom in / zoom out / slide show / notes are deliberately absent: they live
 * in the status bar, which is always on screen, and duplicating them here made
 * this tab the only one in any binding with its own navigation row.
 *
 * "Reading View" is a real command, not the disabled placeholder it shipped as
 * in all five bindings: it opens the deck at full window size with the chrome
 * reduced to a nav bar (see `ui/reading-view.ts`). It sits next to Normal and
 * Slide Sorter because PowerPoint groups the three presentation views together.
 *
 * "Outline View" sits between Slide Sorter and Reading View, which is where
 * PowerPoint puts it and the order `e2e/ribbon-control-inventory.spec.ts` diffs
 * every binding against. It opens the deck as editable indented text (see
 * `ui/outline-view.ts`).
 *
 * "Guides" and "Snap to shape" are one control each, for the one thing each of
 * them names. They used to be crossed: Guides drove shape snapping and Snap to
 * shape was a permanently disabled placeholder, so the ribbon carried a label
 * describing a feature that lived on a differently-named control. Guide
 * visibility and shape snapping are genuinely separate settings (you can want
 * the guides drawn without every drag magnetising to a neighbour), and the
 * viewer state carries both flags.
 */
export function createViewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): ViewTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const command = (key: string, onClick: () => void): ButtonHandle =>
		makeButton(doc, { label: t(key), text: t(key), onClick });
	const placeholder = (key: string): HTMLButtonElement => {
		const button = command(key, () => {});
		button.setDisabled(true);
		return button.btn;
	};

	const normal = command('pptx.view.normal', handlers.normalView);
	normal.btn.title = t('pptx.statusBar.normalView');
	const sorter = command('pptx.slideSorter.title', handlers.openSlideSorter);
	sorter.btn.title = t('pptx.view.slideSorterTooltip');
	const outline = command('pptx.view.outlineView', handlers.openOutlineView);
	outline.btn.title = t('pptx.view.outlineViewTooltip');
	const reading = command('pptx.view.readingView', handlers.openReadingView);

	const masterView = command('pptx.master.title', () => handlers.toggleMasterView?.());
	masterView.btn.title = t('pptx.view.slideMasterTooltip');

	const rulers = command('pptx.ruler.rulers', () => handlers.toggleViewOption('showRulers'));
	const grid = command('pptx.grid.grid', () => handlers.toggleViewOption('showGrid'));
	const guides = command('pptx.view.guides', () => handlers.toggleViewOption('showGuides'));
	guides.btn.title = t('pptx.ribbon.toggleGuides');
	const snapGrid = command('pptx.view.snapToGrid', () => handlers.toggleViewOption('snapToGrid'));
	const snapShape = command('pptx.view.snapToShape', () =>
		handlers.toggleViewOption('snapToShape'),
	);
	const selection = command('pptx.view.selection', handlers.openSelectionPane);
	selection.btn.title = t('pptx.selectionPane.title');
	const eyedropper = command('pptx.ribbon.eyedropper', handlers.activateEyedropper);
	eyedropper.btn.title = t('pptx.view.eyedropperTooltip');
	const horizontalGuide = command('pptx.view.hGuide', () => handlers.addGuide('h'));
	horizontalGuide.btn.title = t('pptx.view.addHorizontalGuide');
	const verticalGuide = command('pptx.view.vGuide', () => handlers.addGuide('v'));
	verticalGuide.btn.title = t('pptx.view.addVerticalGuide');

	const showZoom = !isActionHidden('zoom', hiddenActions);
	const zoomToFit = showZoom ? command('pptx.view.zoomToFit', handlers.zoomToFit) : null;
	if (zoomToFit) {
		zoomToFit.btn.title = t('pptx.view.zoomToFitTooltip');
	}

	const templates = command('pptx.ribbon.templatesOff', () => handlers.toggleTemplateEditing?.());
	templates.btn.dataset.testid = 'template-edit-toggle';
	templates.btn.title = t('pptx.view.templateEditingTooltip');

	el.append(
		normal.btn,
		sorter.btn,
		outline.btn,
		reading.btn,
		masterView.btn,
		placeholder('pptx.master.handoutMasterTitle'),
		placeholder('pptx.master.notesMasterTitle'),
		rulers.btn,
		grid.btn,
		guides.btn,
		snapGrid.btn,
		selection.btn,
		eyedropper.btn,
		snapShape.btn,
		horizontalGuide.btn,
		verticalGuide.btn,
		...(showZoom ? [placeholder('pptx.slideSorter.zoom'), zoomToFit?.btn ?? []].flat() : []),
		templates.btn,
		placeholder('pptx.view.macros'),
	);

	return {
		el,
		setEditable(editable) {
			templates.setDisabled(!editable);
			masterView.setDisabled(!editable);
			eyedropper.setDisabled(!editable);
		},
		setViewOptions(options) {
			rulers.setActive(options.showRulers);
			grid.setActive(options.showGrid);
			guides.setActive(options.showGuides);
			snapGrid.setActive(options.snapToGrid);
			snapShape.setActive(options.snapToShape);
		},
		setTemplateEditing(active) {
			const label = t(active ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff');
			templates.btn.textContent = label;
			templates.btn.title = t('pptx.view.templateEditingTooltip');
			templates.btn.setAttribute('aria-label', label);
			templates.setActive(active);
		},
	};
}
