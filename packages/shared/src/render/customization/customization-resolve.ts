/**
 * Normalise a `ViewerCustomization` into the sets every decision function
 * reads, folding the cross-cutting rules in ONCE so no binding re-derives them:
 *
 *  - switching off the `ai` feature removes the AI context-menu entries and the
 *    AI Options page;
 *  - switching off `collaboration` removes the Share and Broadcast dialogs;
 *  - switching off `comments` removes the Add Comment menu entry;
 *  - switching off `presentMode` removes the Slide Show tab;
 *  - switching off `editPoints` removes the Edit Points menu entry;
 *  - hiding a dialog removes every entry point that opens it (toolbar button,
 *    File tab page, action card);
 *  - hiding every export format removes the Export page and button.
 *
 * @module render/customization/customization-resolve
 */
import type { BackstagePage } from '../backstage';
import type { BackstageCardId } from '../backstage-cards';
import type { CanvasContextMenuCommandId } from '../canvas-context-menu-commands';
import type { ContextMenuCommandId } from '../context-menu-commands';
import type { EditPointsCommandId } from '../edit-points/edit-points-menu';
import type { ToolbarActionId } from '../toolbar-actions';
import { VIEWER_EXPORT_FORMAT_IDS } from './customization-catalog';
import { resolveKeyboardCustomization } from './customization-keymap';
import type { ResolvedKeyboardCustomization } from './customization-keymap';
import type {
	OptionsPageId,
	OptionsSectionId,
	OptionsSettingId,
	OptionsSettingValues,
	ViewerCustomization,
	ViewerDialogId,
	ViewerDrawingToolId,
	ViewerFeatureId,
	ViewerPanelId,
} from './customization-types';

/** The normalised, set-based view of a customisation. Treat as immutable. */
export interface ResolvedCustomization {
	hiddenActions: ReadonlySet<ToolbarActionId>;
	hiddenOptionsPages: ReadonlySet<OptionsPageId>;
	hiddenOptionsSections: ReadonlySet<OptionsSectionId>;
	hiddenSettings: ReadonlySet<OptionsSettingId>;
	lockedSettings: OptionsSettingValues;
	defaultSettings: OptionsSettingValues;
	hiddenBackstagePages: ReadonlySet<BackstagePage>;
	hiddenBackstageCards: ReadonlySet<BackstageCardId>;
	hiddenElementCommands: ReadonlySet<ContextMenuCommandId>;
	hiddenCanvasCommands: ReadonlySet<CanvasContextMenuCommandId>;
	hiddenEditPointsCommands: ReadonlySet<EditPointsCommandId>;
	hiddenDrawingTools: ReadonlySet<ViewerDrawingToolId>;
	elementMenuEnabled: boolean;
	canvasMenuEnabled: boolean;
	hiddenPanels: ReadonlySet<ViewerPanelId>;
	disabledFeatures: ReadonlySet<ViewerFeatureId>;
	hiddenDialogs: ReadonlySet<ViewerDialogId>;
	keyboard: ResolvedKeyboardCustomization;
}

/** Which toolbar button, File page and card each dialog owns. */
const DIALOG_ENTRY_POINTS: Record<
	ViewerDialogId,
	{ actions: ToolbarActionId[]; pages: BackstagePage[]; cards: BackstageCardId[] }
> = {
	options: { actions: [], pages: ['options'], cards: [] },
	share: { actions: ['share'], pages: ['share'], cards: ['share'] },
	broadcast: { actions: ['broadcast'], pages: [], cards: [] },
	print: { actions: [], pages: ['print'], cards: ['print'] },
	export: { actions: ['export'], pages: ['export'], cards: [...VIEWER_EXPORT_FORMAT_IDS] },
};

function addAll<T>(target: Set<T>, values: readonly T[] | undefined): void {
	for (const value of values ?? []) {
		target.add(value);
	}
}

function resolveDialogs(customization: ViewerCustomization): Set<ViewerDialogId> {
	const dialogs = new Set<ViewerDialogId>(customization.hiddenDialogs ?? []);
	const features = new Set(customization.disabledFeatures ?? []);
	if (features.has('collaboration')) {
		dialogs.add('share');
		dialogs.add('broadcast');
	}
	const formats = new Set(customization.hiddenExportFormats ?? []);
	if (VIEWER_EXPORT_FORMAT_IDS.every((id) => formats.has(id))) {
		dialogs.add('export');
	}
	return dialogs;
}

/** Normalise `customization` (undefined means "customise nothing"). */
export function resolveCustomization(
	customization: ViewerCustomization | undefined,
): ResolvedCustomization {
	const c = customization ?? {};
	const hiddenActions = new Set<ToolbarActionId>();
	addAll(hiddenActions, c.ribbon?.hiddenTabs);
	addAll(hiddenActions, c.ribbon?.hiddenButtons);
	const pages = new Set<BackstagePage>(c.backstage?.hiddenPages ?? []);
	const cards = new Set<BackstageCardId>(c.backstage?.hiddenCards ?? []);
	addAll(cards, c.hiddenExportFormats);
	const dialogs = resolveDialogs(c);
	for (const dialog of dialogs) {
		const entry = DIALOG_ENTRY_POINTS[dialog];
		addAll(hiddenActions, entry.actions);
		addAll(pages, entry.pages);
		addAll(cards, entry.cards);
	}
	const features = new Set<ViewerFeatureId>(c.disabledFeatures ?? []);
	const elementCommands = new Set<ContextMenuCommandId>(c.contextMenu?.hiddenElementCommands);
	const optionsPages = new Set<OptionsPageId>(c.options?.hiddenPages ?? []);
	if (features.has('ai')) {
		elementCommands.add('ai-ask');
		elementCommands.add('ai-fix');
		optionsPages.add('ai');
	}
	if (features.has('comments')) {
		elementCommands.add('comment');
	}
	if (features.has('presentMode')) {
		hiddenActions.add('slideShow');
	}
	if (features.has('editPoints')) {
		elementCommands.add('edit-points');
	}
	return {
		hiddenActions,
		hiddenOptionsPages: optionsPages,
		hiddenOptionsSections: new Set(c.options?.hiddenSections ?? []),
		hiddenSettings: new Set(c.options?.hiddenSettings ?? []),
		lockedSettings: { ...c.options?.locked },
		defaultSettings: { ...c.options?.defaults },
		hiddenBackstagePages: pages,
		hiddenBackstageCards: cards,
		hiddenElementCommands: elementCommands,
		hiddenCanvasCommands: new Set(c.contextMenu?.hiddenCanvasCommands ?? []),
		hiddenEditPointsCommands: new Set(c.contextMenu?.hiddenEditPointsCommands ?? []),
		hiddenDrawingTools: new Set(c.hiddenDrawingTools ?? []),
		elementMenuEnabled: c.contextMenu?.disableElementMenu !== true,
		canvasMenuEnabled: c.contextMenu?.disableCanvasMenu !== true,
		hiddenPanels: new Set(c.hiddenPanels ?? []),
		disabledFeatures: features,
		hiddenDialogs: dialogs,
		keyboard: resolveKeyboardCustomization(c.keyboard),
	};
}

/** The resolution of "no customisation", shared so it is allocated once. */
export const EMPTY_RESOLVED_CUSTOMIZATION: ResolvedCustomization = resolveCustomization(undefined);

/**
 * The `hiddenActions` list a binding threads through its existing ribbon and
 * toolbar gates: the legacy `hiddenActions` prop unioned with the ribbon,
 * dialog and feature rules above. Returns `undefined` when nothing is hidden,
 * which is what those gates treat as "show everything".
 */
export function resolveEffectiveHiddenActions(
	resolved: ResolvedCustomization,
	legacyHiddenActions?: readonly ToolbarActionId[],
): ToolbarActionId[] | undefined {
	if (resolved.hiddenActions.size === 0 && !legacyHiddenActions?.length) {
		return legacyHiddenActions ? [...legacyHiddenActions] : undefined;
	}
	const merged = new Set<ToolbarActionId>(legacyHiddenActions ?? []);
	addAll(merged, [...resolved.hiddenActions]);
	return [...merged];
}

/** True unless the host removed this chrome region. */
export function isPanelVisible(resolved: ResolvedCustomization, panel: ViewerPanelId): boolean {
	return !resolved.hiddenPanels.has(panel);
}

/** True unless the host switched this feature area off. */
export function isFeatureEnabled(
	resolved: ResolvedCustomization,
	feature: ViewerFeatureId,
): boolean {
	return !resolved.disabledFeatures.has(feature);
}

/** True unless the host removed this dialog (directly, or via a feature). */
export function isDialogAvailable(
	resolved: ResolvedCustomization,
	dialog: ViewerDialogId,
): boolean {
	return !resolved.hiddenDialogs.has(dialog);
}

/**
 * True unless the host switched Edit Points off (the feature, or just its
 * element context-menu entry, which is its only entry point).
 */
export function isEditPointsEnabled(resolved: ResolvedCustomization): boolean {
	return (
		!resolved.disabledFeatures.has('editPoints') &&
		!resolved.hiddenElementCommands.has('edit-points')
	);
}

/** True unless the host removed this Insert > Shapes drawing tool. */
export function isDrawingToolVisible(
	resolved: ResolvedCustomization,
	tool: ViewerDrawingToolId,
): boolean {
	return !resolved.hiddenDrawingTools.has(tool);
}
