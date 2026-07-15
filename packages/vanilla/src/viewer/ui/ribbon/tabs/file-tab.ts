import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonFileHandlers } from '../ribbon-types';

export interface FileTab {
	el: HTMLElement;
}

/**
 * The File ribbon tab: save (download .pptx) + the export formats already
 * implemented by the viewer's export lifecycle (PNG/PDF/GIF/video/print).
 * Unlike the other tabs this one is always enabled (exporting/saving a
 * read-only-loaded document is legitimate; only edit-mutating actions gate on
 * `editable`).
 */
export function createFileTab(doc: Document, t: Translator, handlers: RibbonFileHandlers): FileTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const save = makeButton(doc, {
		label: t('pptx.file.saveAsPptx'),
		icon: 'download',
		onClick: handlers.save,
	});
	save.btn.title = t('pptx.file.saveAsPptxTooltip');
	const png = makeButton(doc, {
		label: t('pptx.file.png'),
		icon: 'image',
		onClick: handlers.exportPng,
	});
	const pdf = makeButton(doc, {
		label: t('pptx.file.pdf'),
		icon: 'file',
		onClick: handlers.exportPdf,
	});
	const gif = makeButton(doc, {
		label: t('pptx.file.gif'),
		icon: 'image',
		onClick: handlers.exportGif,
	});
	const video = makeButton(doc, {
		label: t('pptx.file.video'),
		icon: 'video',
		onClick: handlers.exportVideo,
	});
	const print = makeButton(doc, {
		label: t('pptx.print.printButton'),
		icon: 'printer',
		onClick: handlers.print,
	});

	el.append(save.btn, png.btn, pdf.btn, gif.btn, video.btn, print.btn);

	return { el };
}
