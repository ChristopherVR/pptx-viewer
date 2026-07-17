import type { BackstagePage, ToolbarActionId } from 'pptx-viewer-shared';

import type { FileSectionProps } from './file-section-types';

/** `[label, description, glyph, onClick]` action card shown on a backstage page. */
export type FileSectionAction = readonly [string, string, string, (() => void) | undefined];

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
				'🔒',
				props.onOpenPasswordProtection,
			],
			[
				'Inspect Presentation',
				'Review properties and hidden content.',
				'ⓘ',
				props.onOpenDocumentProperties,
			],
			['Embed Fonts', 'Keep typography consistent across devices.', 'T', props.onOpenFontEmbedding],
			[
				'Digital Signatures',
				'View and manage attached signatures.',
				'✓',
				props.onOpenDigitalSignatures,
			],
		];
	}
	if (page === 'saveAs') {
		const items: FileSectionAction[] = [
			['PowerPoint Presentation', 'Save an editable .pptx copy.', 'P', props.onSaveAsPptx],
			['PowerPoint Show', 'Save a .ppsx slide show.', '▶', props.onSaveAsPpsx],
		];
		if (props.hasMacros) {
			items.push([
				'Macro-Enabled Presentation',
				'Preserve VBA in a .pptm file.',
				'M',
				props.onSaveAsPptm,
			]);
		}
		items.push([
			'Package for Sharing',
			'Bundle the deck and linked assets.',
			'□',
			props.onPackageForSharing,
		]);
		return items;
	}
	if (page === 'export') {
		if (isHidden('export')) {
			return [];
		}
		return [
			['Create PDF', 'Publish one page per slide.', 'PDF', props.onExportPdf],
			['Export current slide', 'Create a high-quality PNG image.', 'PNG', props.onExportPng],
			['Create a Video', 'Export timings and animations as WebM.', '▶', props.onExportVideo],
			['Create an Animated GIF', 'Make a compact looping preview.', 'GIF', props.onExportGif],
			['Copy as Image', 'Copy the current slide to the clipboard.', '▣', props.onCopySlideAsImage],
		];
	}
	if (page === 'print') {
		return [
			[
				'Print Presentation',
				'Choose layout and output settings in the browser print dialog.',
				'▧',
				props.onPrint,
			],
		];
	}
	if (page === 'share') {
		return [
			['Share with People', 'Invite collaborators to work together.', '◇', props.onOpenShareDialog],
			[
				'Package for Sharing',
				'Download a self-contained offline package.',
				'□',
				props.onPackageForSharing,
			],
		];
	}
	return [];
}
