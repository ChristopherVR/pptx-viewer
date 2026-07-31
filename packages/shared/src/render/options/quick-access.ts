/**
 * Quick Access Toolbar command catalog and list-editing helpers, backing the
 * Options > Quick Access Toolbar pane and the title-bar QAT strip.
 *
 * Ids map onto actions every binding already exposes; each binding resolves
 * an id to its own icon + handler when rendering the strip.
 */

export interface QuickAccessCommandDefinition {
	id: string;
	labelKey: string;
	/** Logical icon name bindings map to their icon set. */
	icon: string;
}

export const QUICK_ACCESS_COMMAND_CATALOG: readonly QuickAccessCommandDefinition[] = [
	{ id: 'save', labelKey: 'pptx.toolbar.save', icon: 'save' },
	{ id: 'undo', labelKey: 'pptx.toolbar.undo', icon: 'undo' },
	{ id: 'redo', labelKey: 'pptx.toolbar.redo', icon: 'redo' },
	{
		id: 'presentFromStart',
		labelKey: 'pptx.options.quickAccess.command.presentFromStart',
		icon: 'play',
	},
	{ id: 'print', labelKey: 'pptx.options.quickAccess.command.print', icon: 'printer' },
	{ id: 'exportPdf', labelKey: 'pptx.options.quickAccess.command.exportPdf', icon: 'fileDown' },
	{ id: 'newSlide', labelKey: 'pptx.options.quickAccess.command.newSlide', icon: 'plus' },
	{ id: 'spellCheck', labelKey: 'pptx.settings.spellCheck', icon: 'spellCheck' },
	{ id: 'zoomIn', labelKey: 'pptx.options.quickAccess.command.zoomIn', icon: 'zoomIn' },
	{ id: 'zoomOut', labelKey: 'pptx.options.quickAccess.command.zoomOut', icon: 'zoomOut' },
];

export const DEFAULT_QUICK_ACCESS_COMMAND_IDS: readonly string[] = [
	'save',
	'undo',
	'redo',
	'presentFromStart',
];

export function getQuickAccessCommand(id: string): QuickAccessCommandDefinition | undefined {
	return QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
}

/**
 * Ids every title bar renders as a dedicated button rather than from the
 * catalog. They carry state the generic strip has no way to know: undo/redo
 * enablement, the "Undo: <action>" tooltip, and the host's `hiddenActions`
 * gate.
 */
const DEDICATED_QUICK_ACCESS_IDS: ReadonlySet<string> = new Set(['save', 'undo', 'redo']);

/**
 * The configured Quick Access commands a title bar must render BEYOND its
 * dedicated Save/Undo/Redo buttons, in configured order, unknown ids dropped.
 *
 * Every binding needs exactly this list and four of the five used to skip it
 * entirely, so their strips showed three buttons while the options model (and
 * Angular) said four. Deriving it here is what makes "the strip follows File >
 * Options" one decision instead of five.
 */
export function extraQuickAccessCommands(
	commandIds: readonly string[],
): QuickAccessCommandDefinition[] {
	const seen = new Set<string>();
	const extras: QuickAccessCommandDefinition[] = [];
	for (const id of commandIds) {
		if (DEDICATED_QUICK_ACCESS_IDS.has(id) || seen.has(id)) {
			continue;
		}
		const command = getQuickAccessCommand(id);
		if (command) {
			seen.add(id);
			extras.push(command);
		}
	}
	return extras;
}

/** Commands not yet on the toolbar, in catalog order. */
export function availableQuickAccessCommands(
	commandIds: readonly string[],
): QuickAccessCommandDefinition[] {
	return QUICK_ACCESS_COMMAND_CATALOG.filter((entry) => !commandIds.includes(entry.id));
}

export function addQuickAccessCommand(commandIds: readonly string[], id: string): string[] {
	if (commandIds.includes(id) || !getQuickAccessCommand(id)) {
		return [...commandIds];
	}
	return [...commandIds, id];
}

export function removeQuickAccessCommand(commandIds: readonly string[], id: string): string[] {
	return commandIds.filter((entry) => entry !== id);
}

export function moveQuickAccessCommand(
	commandIds: readonly string[],
	id: string,
	direction: 'up' | 'down',
): string[] {
	const index = commandIds.indexOf(id);
	const target = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || target < 0 || target >= commandIds.length) {
		return [...commandIds];
	}
	const next = [...commandIds];
	const swapped = next[target];
	if (swapped === undefined) {
		return next;
	}
	next[target] = id;
	next[index] = swapped;
	return next;
}
