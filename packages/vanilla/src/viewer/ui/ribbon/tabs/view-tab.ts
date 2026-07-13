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
		label: t('pptx.mode.masterView'),
		text: t('pptx.mode.masterView'),
		onClick: () => handlers.toggleMasterView?.(),
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
