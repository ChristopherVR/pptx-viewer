import {
	BadgeCheck,
	Clock3,
	Copy,
	FileCode2,
	FileJson,
	FileText,
	Image,
	Images,
	Info,
	LockKeyhole,
	Package,
	Presentation,
	Printer,
	Type,
	UserPlus,
	Video,
} from 'lucide';
import type { IconNode } from 'lucide';
import type { BackstageCardId, BackstagePage, ToolbarActionId } from 'pptx-viewer-shared';
import { backstageCardsFor, isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonFileHandlers } from '../ribbon-types';
import { button } from './file-tab-dom';
import { createLucideIcon } from './file-tab-icons';

const CARD_ICONS: Record<BackstageCardId, IconNode> = {
	protect: LockKeyhole,
	inspect: Info,
	embedFonts: Type,
	signatures: BadgeCheck,
	versionHistory: Clock3,
	saveAsPptx: FileText,
	saveAsPpsx: Presentation,
	saveAsPptm: FileCode2,
	package: Package,
	pdf: FileText,
	png: Image,
	video: Video,
	gif: Images,
	json: FileJson,
	copyImage: Copy,
	print: Printer,
	share: UserPlus,
	sharePackage: Package,
};

/**
 * The backstage action-card grid for one page.
 *
 * Card order, titles and bodies come from `pptx-viewer-shared`; this module
 * only maps each card to its lucide glyph and to the handler that runs it. The
 * copy used to be hardcoded here, which made the whole File tab
 * untranslatable and let it drift from the other four bindings.
 */
export function createFileActionGrid(
	doc: Document,
	page: BackstagePage,
	handlers: RibbonFileHandlers,
	hasMacros: boolean,
	run: (callback: () => void) => void,
	t: Translator,
	hiddenActions?: readonly ToolbarActionId[],
): HTMLElement {
	const grid = createEl(doc, 'div', 'pptxv-bs-actions');
	if (page === 'export' && isActionHidden('export', hiddenActions)) {
		return grid;
	}
	const callbacks: Record<BackstageCardId, (() => void) | undefined> = {
		protect: handlers.openPasswordProtection,
		inspect: handlers.openDocumentProperties,
		embedFonts: handlers.openFontEmbedding,
		signatures: handlers.openDigitalSignatures,
		versionHistory: handlers.openVersionHistory,
		saveAsPptx: handlers.save,
		saveAsPpsx: handlers.saveAsPpsx,
		saveAsPptm: handlers.saveAsPptm,
		package: handlers.packageForSharing,
		pdf: handlers.exportPdf,
		png: handlers.exportPng,
		video: handlers.exportVideo,
		gif: handlers.exportGif,
		json: handlers.exportJson,
		copyImage: handlers.copySlideAsImage,
		print: handlers.print,
		share: handlers.openShare,
		sharePackage: handlers.packageForSharing,
	};
	for (const card of backstageCardsFor(page)) {
		if (card.id === 'saveAsPptm' && !hasMacros) {
			continue;
		}
		const callback = callbacks[card.id];
		const result = button(doc, '', () => run(() => callback?.()));
		const glyph = doc.createElement('b');
		glyph.appendChild(createLucideIcon(doc, CARD_ICONS[card.id], 22));
		const copy = doc.createElement('span');
		const heading = doc.createElement('strong');
		heading.textContent = t(card.titleKey);
		const text = doc.createElement('small');
		text.textContent = t(card.bodyKey);
		copy.append(heading, text);
		result.append(glyph, copy);
		grid.appendChild(result);
	}
	return grid;
}
