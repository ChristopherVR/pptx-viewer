/**
 * Command-search data for the PowerPoint-style "Tell me what you want to do"
 * search bar. Provides searchable command entries grouped by category, each
 * mapping a label translation key to a command identifier that bindings can
 * dispatch.
 */

export interface CommandSearchEntry {
	/** Translation key for the display label. */
	labelKey: string;
	/** Command identifier dispatched to the host binding. */
	command: string;
	/** Optional icon hint (binding resolves to framework icon component). */
	icon?: string;
	/** Category grouping key. */
	category: 'format' | 'insert' | 'view' | 'slideShow' | 'design' | 'arrange';
}

/**
 * Static catalogue of searchable commands. Bindings filter this list by the
 * user's typed query (matching against the resolved translation text).
 */
export const COMMAND_SEARCH_ENTRIES: readonly CommandSearchEntry[] = [
	// Format
	{ labelKey: 'pptx.textPanel.bold', command: 'format.bold', icon: 'bold', category: 'format' },
	{
		labelKey: 'pptx.textPanel.italic',
		command: 'format.italic',
		icon: 'italic',
		category: 'format',
	},
	{
		labelKey: 'pptx.textPanel.underline',
		command: 'format.underline',
		icon: 'underline',
		category: 'format',
	},
	{
		labelKey: 'pptx.ribbon.alignLeft',
		command: 'format.alignLeft',
		icon: 'alignLeft',
		category: 'format',
	},
	{
		labelKey: 'pptx.ribbon.alignCenter',
		command: 'format.alignCenter',
		icon: 'alignCenter',
		category: 'format',
	},
	{
		labelKey: 'pptx.ribbon.alignRight',
		command: 'format.alignRight',
		icon: 'alignRight',
		category: 'format',
	},
	{
		labelKey: 'pptx.ribbon.clearFormatting',
		command: 'format.clear',
		icon: 'eraser',
		category: 'format',
	},
	// Insert
	{
		labelKey: 'pptx.insert.addTextBox',
		command: 'insert.textBox',
		icon: 'type',
		category: 'insert',
	},
	{ labelKey: 'pptx.insert.addShape', command: 'insert.shape', icon: 'square', category: 'insert' },
	{
		labelKey: 'pptx.ribbon.insertImage',
		command: 'insert.image',
		icon: 'image',
		category: 'insert',
	},
	{
		labelKey: 'pptx.ribbon.insertMedia',
		command: 'insert.media',
		icon: 'video',
		category: 'insert',
	},
	{
		labelKey: 'pptx.insert.insertTable',
		command: 'insert.table',
		icon: 'table',
		category: 'insert',
	},
	{
		labelKey: 'pptx.ribbon.insertChart',
		command: 'insert.chart',
		icon: 'barChart',
		category: 'insert',
	},
	{
		labelKey: 'pptx.insert.insertSmartArt',
		command: 'insert.smartArt',
		icon: 'layers',
		category: 'insert',
	},
	{
		labelKey: 'pptx.insert.insertEquation',
		command: 'insert.equation',
		icon: 'sigma',
		category: 'insert',
	},
	// View
	{ labelKey: 'pptx.grid.grid', command: 'view.toggleGrid', icon: 'grid', category: 'view' },
	{ labelKey: 'pptx.ruler.rulers', command: 'view.toggleRulers', icon: 'ruler', category: 'view' },
	{
		labelKey: 'pptx.slideSorter.title',
		command: 'view.slideSorter',
		icon: 'layoutGrid',
		category: 'view',
	},
	{
		labelKey: 'pptx.view.zoomToFit',
		command: 'view.zoomToFit',
		icon: 'maximize',
		category: 'view',
	},
	// Slide Show
	{
		labelKey: 'pptx.slideShow.fromBeginning',
		command: 'slideShow.fromBeginning',
		icon: 'play',
		category: 'slideShow',
	},
	{
		labelKey: 'pptx.slideShow.presenterView',
		command: 'slideShow.presenterView',
		icon: 'monitor',
		category: 'slideShow',
	},
	// Design
	{
		labelKey: 'pptx.ribbon.browseThemes',
		command: 'design.browseThemes',
		icon: 'palette',
		category: 'design',
	},
	{
		labelKey: 'pptx.ribbon.slideSize',
		command: 'design.slideSize',
		icon: 'monitor',
		category: 'design',
	},
	// Arrange
	{
		labelKey: 'pptx.arrange.bringToFront',
		command: 'arrange.bringToFront',
		icon: 'layers',
		category: 'arrange',
	},
	{
		labelKey: 'pptx.arrange.sendToBack',
		command: 'arrange.sendToBack',
		icon: 'layers',
		category: 'arrange',
	},
	{
		labelKey: 'pptx.arrange.duplicate',
		command: 'arrange.duplicate',
		icon: 'copy',
		category: 'arrange',
	},
	// Review
	{
		labelKey: 'pptx.review.spelling',
		command: 'review.spelling',
		icon: 'spellCheck',
		category: 'format',
	},
	{
		labelKey: 'pptx.review.language',
		command: 'review.language',
		icon: 'globe',
		category: 'format',
	},
	{
		labelKey: 'pptx.review.accessibilityCheck',
		command: 'review.accessibility',
		icon: 'shieldCheck',
		category: 'view',
	},
	{
		labelKey: 'pptx.ribbon.link',
		command: 'insert.link',
		icon: 'link',
		category: 'insert',
	},
] as const;

/**
 * Filter the command catalogue by a search query (case-insensitive substring
 * match against the resolved label). The `resolveLabel` callback is provided
 * by the binding to translate the key into the current locale's text.
 */
export function filterCommands(
	query: string,
	resolveLabel: (key: string) => string,
): CommandSearchEntry[] {
	if (!query.trim()) {
		return [];
	}
	const lowerQuery = query.toLowerCase();
	return COMMAND_SEARCH_ENTRIES.filter((entry) =>
		resolveLabel(entry.labelKey).toLowerCase().includes(lowerQuery),
	);
}
