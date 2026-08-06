import type { BackstagePage } from './backstage';

/**
 * Every action card the File-tab backstage can show, keyed by the operation it
 * triggers rather than by its wording.
 *
 * The five bindings used to hardcode a title and a body string each, which made
 * the whole backstage untranslatable and let the copy drift: the same card
 * carried four different descriptions depending on which binding you opened it
 * in. Both halves now live here as a dictionary key plus an English fallback,
 * so a wording change lands everywhere at once and a translator only has to
 * translate it once.
 */
export type BackstageCardId =
	| 'protect'
	| 'inspect'
	| 'embedFonts'
	| 'signatures'
	| 'versionHistory'
	| 'saveAsPptx'
	| 'saveAsPpsx'
	| 'saveAsPptm'
	| 'package'
	| 'pdf'
	| 'png'
	| 'video'
	| 'gif'
	| 'json'
	| 'copyImage'
	| 'print'
	| 'share'
	| 'sharePackage';

export interface BackstageCard {
	id: BackstageCardId;
	/** English fallback, used when the host supplies no dictionary. */
	title: string;
	/** English fallback for the one-line description under the title. */
	body: string;
	titleKey: string;
	bodyKey: string;
}

const card = (id: BackstageCardId, title: string, body: string): BackstageCard => ({
	id,
	title,
	body,
	titleKey: `pptx.backstage.card.${id}.title`,
	bodyKey: `pptx.backstage.card.${id}.body`,
});

export const BACKSTAGE_CARDS: Readonly<Record<BackstageCardId, BackstageCard>> = {
	protect: card(
		'protect',
		'Protect Presentation',
		'Control what changes people can make to this presentation.',
	),
	inspect: card(
		'inspect',
		'Inspect Presentation',
		'Review document properties, accessibility, and hidden content.',
	),
	embedFonts: card(
		'embedFonts',
		'Embed Fonts',
		'Keep typography consistent when the file moves between devices.',
	),
	signatures: card(
		'signatures',
		'Digital Signatures',
		'View and manage signatures attached to this presentation.',
	),
	versionHistory: card(
		'versionHistory',
		'Version History',
		'Restore or remove the latest recovery snapshot.',
	),
	saveAsPptx: card('saveAsPptx', 'PowerPoint Presentation', 'Save an editable .pptx copy.'),
	saveAsPpsx: card(
		'saveAsPpsx',
		'PowerPoint Show',
		'Save a .ppsx file that opens directly in slide show.',
	),
	saveAsPptm: card(
		'saveAsPptm',
		'Macro-Enabled Presentation',
		'Preserve VBA content in a .pptm file.',
	),
	package: card('package', 'Package for Sharing', 'Bundle the presentation and linked assets.'),
	pdf: card('pdf', 'Create PDF', 'Publish a portable document with one page per slide.'),
	png: card('png', 'Export current slide', 'Create a high-quality PNG image.'),
	video: card('video', 'Create a Video', 'Export slide timings and animations as WebM.'),
	gif: card('gif', 'Create an Animated GIF', 'Make a compact looping preview.'),
	json: card(
		'json',
		'Export as JSON',
		'Save a portable JSON document that re-imports with full fidelity.',
	),
	copyImage: card('copyImage', 'Copy as Image', 'Copy the current slide to the clipboard.'),
	print: card(
		'print',
		'Print Presentation',
		'Choose a printer, layout, copies, and output settings in your browser print dialog.',
	),
	share: card(
		'share',
		'Share with People',
		'Invite collaborators and work on the presentation together.',
	),
	sharePackage: card(
		'sharePackage',
		'Package for Sharing',
		'Download a self-contained package for offline sharing.',
	),
};

/**
 * Which cards a backstage page shows, in order.
 *
 * `saveAsPptm` is listed on Save As but only rendered when the open deck
 * actually has macros; that gating stays in the bindings because only they know
 * the current document. Every other entry is unconditional, so a binding that
 * renders this list in order matches the others by construction.
 */
export const BACKSTAGE_PAGE_CARDS: Readonly<
	Partial<Record<BackstagePage, readonly BackstageCardId[]>>
> = {
	info: ['protect', 'inspect', 'embedFonts', 'signatures', 'versionHistory'],
	saveAs: ['saveAsPptx', 'saveAsPpsx', 'saveAsPptm', 'package'],
	export: ['pdf', 'png', 'video', 'gif', 'json', 'copyImage'],
	print: ['print'],
	share: ['share', 'sharePackage'],
};

/** The cards for a page, already resolved to their descriptors. */
export function backstageCardsFor(page: BackstagePage): readonly BackstageCard[] {
	return (BACKSTAGE_PAGE_CARDS[page] ?? []).map((id) => BACKSTAGE_CARDS[id]);
}
