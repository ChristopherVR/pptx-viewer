import type { RibbonControlId, RibbonGroupId } from './customization';

/** A host supplies translated labels and controlled state; shared owns markup. */
export interface RibbonCommandView {
	id: RibbonControlId;
	label: string;
	icon: string;
	title?: string;
	disabled?: boolean;
	active?: boolean;
	pressed?: boolean;
	expanded?: boolean;
	hidden?: boolean;
	compact?: boolean;
	/** Opens a menu or panel: draws PowerPoint's drop-down chevron after the label. */
	caret?: boolean;
	badge?: number;
	/** Commands with the same column share a vertical stack. */
	column?: number;
}

export interface RibbonGroupView {
	id: RibbonGroupId;
	label: string;
	commands: readonly RibbonCommandView[];
}

/**
 * Commands that open a menu, gallery or panel rather than acting at once.
 * PowerPoint draws a drop-down chevron on them; the shared command element reads
 * this set (or an explicit `caret` attribute) so every binding shows it without
 * wiring a per-command flag.
 */
export const RIBBON_MENU_COMMAND_IDS: ReadonlySet<string> = new Set<RibbonControlId>([
	'slideShow.startSlideShow.customShow',
	'record.camera.cameo',
	'record.manage.clear',
	'record.manage.reset',
	'review.accessibility.check',
	'review.language.language',
	'review.comments.showComments',
	'review.ink.hideInk',
]);
