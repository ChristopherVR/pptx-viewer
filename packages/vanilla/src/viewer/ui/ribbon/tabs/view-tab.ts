import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonNavHandlers } from '../ribbon-types';

export interface ViewTab {
	el: HTMLElement;
}

/**
 * The View ribbon tab: zoom in/out/fit, present, and notes-toggle, mirroring
 * the always-visible nav row (see `ribbon-nav-row.ts` docs for why those stay
 * outside the tab system too: read-only mode needs them regardless of the
 * ribbon). This tab exists for ribbon-parity/discoverability while editing.
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
		label: t('pptx.ribbon.editTemplateTitle'),
		icon: 'sidebar',
		onClick: () => handlers.toggleTemplateEditing?.(),
	});

	el.append(
		zoomOut.btn,
		zoomIn.btn,
		fit.btn,
		present.btn,
		notes.btn,
		accessibility.btn,
		templates.btn,
	);

	return { el };
}
