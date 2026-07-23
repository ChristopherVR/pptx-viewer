import {
	Box,
	Copy,
	Download,
	FileImage,
	FileText,
	Info,
	Lock,
	Package,
	Play,
	Printer,
	Share2,
	ShieldAlert,
	Type,
	Video,
} from 'lucide-vue-next';
import type { BackstagePage, ToolbarActionId } from 'pptx-viewer-shared';
import type { Component } from 'vue';

import type { FileSectionProps } from './file-section-types';

/**
 * `[label, description, icon, onClick]` action card shown on a backstage page.
 * The icon is a `lucide-vue-next` component, picked to match the `react-icons/lu`
 * glyph React's `toolbar/FileSection.tsx` renders for the same card.
 */
export type FileSectionAction = readonly [string, string, Component, (() => void) | undefined];

/**
 * Backstage action-card list for the given page, mirroring PowerPoint's
 * File-tab layout. Extracted from `FileSection.vue` to keep that file under
 * the repo's ~300 LOC convention.
 *
 * `isHidden` gates the Export page's action cards on the shared `'export'`
 * toolbar-action id: when hidden, the Export page renders no cards instead of
 * PNG/PDF/Video/GIF/Copy-as-Image. Save-As, Print, and Share are unaffected;
 * they map to their own ids elsewhere, not `'export'`.
 */
export function buildFileSectionActions(
	page: BackstagePage,
	props: FileSectionProps,
	isHidden: (id: ToolbarActionId) => boolean,
): FileSectionAction[] {
	if (page === 'info') {
		return [
			[
				'Protect Presentation',
				'Control what changes people can make.',
				Lock,
				props.onOpenPasswordProtection,
			],
			[
				'Inspect Presentation',
				'Review properties and hidden content.',
				Info,
				props.onOpenDocumentProperties,
			],
			[
				'Embed Fonts',
				'Keep typography consistent across devices.',
				Type,
				props.onOpenFontEmbedding,
			],
			[
				'Digital Signatures',
				'View and manage attached signatures.',
				ShieldAlert,
				props.onOpenDigitalSignatures,
			],
		];
	}
	if (page === 'saveAs') {
		const items: FileSectionAction[] = [
			['PowerPoint Presentation', 'Save an editable .pptx copy.', Download, props.onSaveAsPptx],
			['PowerPoint Show', 'Save a .ppsx slide show.', Play, props.onSaveAsPpsx],
		];
		if (props.hasMacros) {
			items.push([
				'Macro-Enabled Presentation',
				'Preserve VBA in a .pptm file.',
				FileText,
				props.onSaveAsPptm,
			]);
		}
		items.push([
			'Package for Sharing',
			'Bundle the deck and linked assets.',
			Package,
			props.onPackageForSharing,
		]);
		return items;
	}
	if (page === 'export') {
		if (isHidden('export')) {
			return [];
		}
		return [
			['Create PDF', 'Publish one page per slide.', FileText, props.onExportPdf],
			['Export current slide', 'Create a high-quality PNG image.', FileImage, props.onExportPng],
			['Create a Video', 'Export timings and animations as WebM.', Video, props.onExportVideo],
			['Create an Animated GIF', 'Make a compact looping preview.', Box, props.onExportGif],
			['Copy as Image', 'Copy the current slide to the clipboard.', Copy, props.onCopySlideAsImage],
		];
	}
	if (page === 'print') {
		return [
			[
				'Print Presentation',
				'Choose layout and output settings in the browser print dialog.',
				Printer,
				props.onPrint,
			],
		];
	}
	if (page === 'share') {
		return [
			[
				'Share with People',
				'Invite collaborators to work together.',
				Share2,
				props.onOpenShareDialog,
			],
			[
				'Package for Sharing',
				'Download a self-contained offline package.',
				Package,
				props.onPackageForSharing,
			],
		];
	}
	return [];
}
