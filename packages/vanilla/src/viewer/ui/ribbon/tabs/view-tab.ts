import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers } from '../ribbon-types';

export interface ViewTab {
	el: HTMLElement;
	setTemplateEditing(active: boolean): void;
}

/**
 * The View ribbon tab: zoom in/out/fit, present, and notes-toggle. The status
 * bar keeps these actions available outside the tab while avoiding a duplicate
 * navigation row above the ribbon.
 */
export function createViewTab(doc: Document, t: Translator, handlers: RibbonNavHandlers): ViewTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const zoomOut = makeButton(doc, {
		label: t('pptx.statusBar.zoomOut'),
		icon: 'zoom-out',
		onClick: handlers.zoomOut,
	});
	const zoomIn = makeButton(doc, {
		label: t('pptx.statusBar.zoomIn'),
		icon: 'zoom-in',
		onClick: handlers.zoomIn,
	});
	const fit = makeButton(doc, {
		label: t('pptx.view.zoomToFit'),
		icon: 'fit',
		onClick: handlers.zoomToFit,
	});
	const present = makeButton(doc, {
		label: t('pptx.statusBar.slideShow'),
		icon: 'play',
		onClick: handlers.togglePresentation,
	});
	const notes = makeButton(doc, {
		label: t('pptx.statusBar.toggleNotes'),
		icon: 'notes',
		onClick: handlers.toggleNotes,
	});
	const accessibility = makeButton(doc, {
		label: t('pptx.ribbon.accessibilityCheck'),
		icon: 'sidebar',
		onClick: handlers.openAccessibility,
	});
	const templates = makeButton(doc, {
		label: t('pptx.ribbon.templatesOff'),
		text: t('pptx.ribbon.templatesOff'),
		onClick: () => handlers.toggleTemplateEditing?.(),
	});
	const masterView = makeButton(doc, {
		label: t('pptx.master.title'),
		text: t('pptx.master.title'),
		onClick: () => handlers.toggleMasterView?.(),
	});
	const sorter = makeButton(doc, {
		label: t('pptx.view.slideSorterTooltip'),
		text: t('pptx.slideSorter.title'),
		onClick: handlers.openSlideSorter,
	});
	const selection = makeButton(doc, {
		label: t('pptx.selectionPane.title'),
		text: t('pptx.selectionPane.title'),
		onClick: handlers.openSelectionPane,
	});
	const grid = makeButton(doc, {
		label: t('pptx.view.gridlines'),
		text: t('pptx.view.gridlines'),
		onClick: () => handlers.toggleViewOption('showGrid'),
	});
	const rulers = makeButton(doc, {
		label: t('pptx.view.ruler'),
		text: t('pptx.view.ruler'),
		onClick: () => handlers.toggleViewOption('showRulers'),
	});
	const snapGrid = makeButton(doc, {
		label: t('pptx.view.snapToGrid'),
		text: t('pptx.view.snapToGrid'),
		onClick: () => handlers.toggleViewOption('snapToGrid'),
	});
	const snapShape = makeButton(doc, {
		label: t('pptx.view.snapToShape'),
		text: t('pptx.view.snapToShape'),
		onClick: () => handlers.toggleViewOption('snapToShape'),
	});
	const horizontalGuide = makeButton(doc, {
		label: t('pptx.view.addHorizontalGuide'),
		text: t('pptx.view.addHorizontalGuide'),
		onClick: () => handlers.addGuide('h'),
	});
	const verticalGuide = makeButton(doc, {
		label: t('pptx.view.addVerticalGuide'),
		text: t('pptx.view.addVerticalGuide'),
		onClick: () => handlers.addGuide('v'),
	});
	const eyedropper = makeButton(doc, {
		label: t('pptx.ribbon.eyedropper'),
		text: t('pptx.ribbon.eyedropper'),
		onClick: handlers.activateEyedropper,
	});
	templates.btn.dataset.testid = 'template-edit-toggle';

	el.append(
		zoomOut.btn,
		zoomIn.btn,
		fit.btn,
		present.btn,
		notes.btn,
		accessibility.btn,
		templates.btn,
		masterView.btn,
		sorter.btn,
		selection.btn,
		grid.btn,
		rulers.btn,
		snapGrid.btn,
		snapShape.btn,
		horizontalGuide.btn,
		verticalGuide.btn,
		eyedropper.btn,
	);

	return {
		el,
		setTemplateEditing(active) {
			const label = t(active ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff');
			templates.btn.textContent = label;
			templates.btn.title = label;
			templates.btn.setAttribute('aria-label', label);
			templates.setActive(active);
		},
	};
}
