import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonFileHandlers } from '../ribbon-types';

export interface FileTab {
	el: HTMLElement;
	setHasMacros(hasMacros: boolean): void;
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

	const documentProperties = makeButton(doc, {
		label: t('pptx.ribbon.documentProperties'),
		icon: 'file',
		onClick: handlers.openDocumentProperties,
	});
	const protect = makeButton(doc, {
		label: t('pptx.security.protectPresentation'),
		icon: 'file',
		onClick: handlers.openPasswordProtection,
	});
	const fonts = makeButton(doc, {
		label: t('pptx.ribbon.embedFonts'),
		icon: 'file',
		onClick: handlers.openFontEmbedding,
	});
	const signatures = makeButton(doc, {
		label: t('pptx.viewer.digitalSignatures'),
		icon: 'file',
		onClick: handlers.openDigitalSignatures,
	});
	const save = makeButton(doc, {
		label: t('pptx.file.saveAsPptx'),
		icon: 'download',
		onClick: handlers.save,
	});
	save.btn.title = t('pptx.file.saveAsPptxTooltip');
	const savePpsx = makeButton(doc, {
		label: t('pptx.file.saveAsPpsx'),
		icon: 'play',
		onClick: handlers.saveAsPpsx,
	});
	savePpsx.btn.title = t('pptx.file.saveAsPpsxTooltip');
	const savePptm = makeButton(doc, {
		label: t('pptx.file.saveAsPptm'),
		icon: 'file',
		onClick: handlers.saveAsPptm,
	});
	savePptm.btn.title = t('pptx.file.saveAsPptmTooltip');
	savePptm.btn.hidden = true;
	const packageForSharing = makeButton(doc, {
		label: t('pptx.file.package'),
		icon: 'package',
		onClick: handlers.packageForSharing,
	});
	packageForSharing.btn.title = t('pptx.file.packageTooltip');
	const png = makeButton(doc, {
		label: t('pptx.file.png'),
		icon: 'image',
		onClick: handlers.exportPng,
	});
	const copyImage = makeButton(doc, {
		label: t('pptx.file.copyImage'),
		icon: 'copy',
		onClick: handlers.copySlideAsImage,
	});
	copyImage.btn.title = t('pptx.file.copyImageTooltip');
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

	el.append(
		documentProperties.btn,
		protect.btn,
		fonts.btn,
		signatures.btn,
		save.btn,
		savePpsx.btn,
		savePptm.btn,
		packageForSharing.btn,
		png.btn,
		pdf.btn,
		gif.btn,
		video.btn,
		copyImage.btn,
		print.btn,
	);

	return {
		el,
		setHasMacros: (hasMacros) => {
			savePptm.btn.hidden = !hasMacros;
		},
	};
}
