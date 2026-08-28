import {
	Box,
	Clock3,
	Copy,
	Download,
	FileImage,
	FileJson,
	FileText,
	Info,
	Lock,
	Play,
	Printer,
	Share2,
	ShieldAlert,
	Type,
	Video,
} from 'lucide-vue-next';
import { backstageCardsFor } from 'pptx-viewer-shared';
import type { BackstageCardId, BackstagePage, ToolbarActionId } from 'pptx-viewer-shared';
import type { Component } from 'vue';

import type { FileSectionProps } from './file-section-types';

/**
 * `[titleKey, bodyKey, icon, onClick, titleFallback, bodyFallback]` action card
 * shown on a backstage page. The icon is a `lucide-vue-next` component, picked
 * to match the `react-icons/lu` glyph React renders for the same card.
 */
export type FileSectionAction = readonly [
	string,
	string,
	Component,
	(() => void) | undefined,
	string,
	string,
];

const ICONS: Record<BackstageCardId, Component> = {
	protect: Lock,
	inspect: Info,
	embedFonts: Type,
	signatures: ShieldAlert,
	versionHistory: Clock3,
	saveAsPptx: Download,
	saveAsPpsx: Play,
	saveAsPptm: FileText,
	pdf: FileText,
	png: FileImage,
	video: Video,
	gif: Box,
	json: FileJson,
	copyImage: Copy,
	print: Printer,
	share: Share2,
};

/**
 * Backstage action-card list for the given page, mirroring PowerPoint's
 * File-tab layout.
 *
 * Card order, titles and bodies all come from `pptx-viewer-shared`; this module
 * only maps each card to a Vue icon component and to the host callback that
 * runs it. The wording used to be hardcoded here, which both made it
 * untranslatable and let it drift away from the other four bindings.
 *
 * `isHidden` gates the Export page's action cards on the shared `'export'`
 * toolbar-action id: when hidden, the Export page renders no cards instead of
 * PNG/PDF/Video/GIF/JSON/Copy-as-Image. Save-As, Print, and Share are
 * unaffected;
 * they map to their own ids elsewhere, not `'export'`.
 */
export function buildFileSectionActions(
	page: BackstagePage,
	props: FileSectionProps,
	isHidden: (id: ToolbarActionId) => boolean,
): FileSectionAction[] {
	if (page === 'export' && isHidden('export')) {
		return [];
	}
	const handlers: Record<BackstageCardId, (() => void) | undefined> = {
		protect: props.onOpenPasswordProtection,
		inspect: props.onOpenDocumentProperties,
		embedFonts: props.onOpenFontEmbedding,
		signatures: props.onOpenDigitalSignatures,
		versionHistory: props.onOpenVersionHistory,
		saveAsPptx: props.onSaveAsPptx,
		saveAsPpsx: props.onSaveAsPpsx,
		saveAsPptm: props.onSaveAsPptm,
		pdf: props.onExportPdf,
		png: props.onExportPng,
		video: props.onExportVideo,
		gif: props.onExportGif,
		json: props.onExportJson,
		copyImage: props.onCopySlideAsImage,
		print: props.onPrint,
		share: props.onOpenShareDialog,
	};
	return backstageCardsFor(page)
		.filter((card) => card.id !== 'saveAsPptm' || props.hasMacros)
		.map(
			(card) =>
				[
					card.titleKey,
					card.bodyKey,
					ICONS[card.id],
					handlers[card.id],
					card.title,
					card.body,
				] as const,
		);
}
