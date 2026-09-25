/**
 * The per-viewer customisation store plus the imperative helper API every
 * binding exposes on its component ref / instance.
 *
 * A binding creates ONE controller per viewer, feeds its `customization`
 * prop into `setCustomization`, subscribes to it (React through
 * `useSyncExternalStore`, Vue through a `shallowRef`, Angular through a
 * signal, Svelte through `$state`, Vanilla by calling it), and spreads
 * `controller.api` onto its public handle. Because the helpers live here, the
 * five handles expose the same methods with the same semantics.
 *
 * @module render/customization/customization-controller
 */
import type { BackstagePage } from '../backstage';
import type { BackstageCardId } from '../backstage-cards';
import type { CanvasContextMenuCommandId } from '../canvas-context-menu-commands';
import type { ContextMenuCommandId } from '../context-menu-commands';
import type { EditorKeyActionName } from '../editor-keymap';
import type { ViewerOptionPrimitive } from '../options/viewer-options';
import type { RibbonContextualTabId, ToolbarButtonId, ToolbarTabId } from '../toolbar-actions';
import { createViewerStore } from '../viewer-store';
import { mergeCustomization, toggleInList, withRecordEntry } from './customization-merge';
import { resolveCustomization } from './customization-resolve';
import type { ResolvedCustomization } from './customization-resolve';
import type {
	OptionsPageId,
	OptionsSectionId,
	OptionsSettingId,
	ShortcutChord,
	ViewerCustomization,
	ViewerDialogId,
	ViewerFeatureId,
	ViewerPanelId,
} from './customization-types';
import type { RibbonControlId, RibbonGroupId } from './ribbon-control-ids';

/** The imperative methods every binding's component handle exposes. */
export interface ViewerCustomizationApi {
	/** The current customisation object (a snapshot; do not mutate). */
	getCustomization(): ViewerCustomization;
	/** Replace the whole customisation. */
	setCustomization(next: ViewerCustomization): void;
	/** Merge a partial customisation (see `mergeCustomization`). */
	updateCustomization(patch: ViewerCustomization): void;
	/** Drop every customisation, back to the stock UI. */
	resetCustomization(): void;
	/** Hide a fixed tab, or stop a contextual tab (`shapeFormat`, ...) from appearing. */
	hideRibbonTab(tab: ToolbarTabId | RibbonContextualTabId): void;
	showRibbonTab(tab: ToolbarTabId | RibbonContextualTabId): void;
	/** Hide a group inside a tab (`home.font`). */
	hideRibbonGroup(group: RibbonGroupId): void;
	showRibbonGroup(group: RibbonGroupId): void;
	/** Hide a top-level toolbar button or any ribbon control (`home.font.bold`). */
	hideToolbarButton(button: ToolbarButtonId | RibbonControlId): void;
	showToolbarButton(button: ToolbarButtonId | RibbonControlId): void;
	/** Alias of `hideToolbarButton` for a ribbon control id. */
	hideRibbonControl(control: RibbonControlId): void;
	showRibbonControl(control: RibbonControlId): void;
	hideOptionsPage(page: OptionsPageId): void;
	showOptionsPage(page: OptionsPageId): void;
	hideOptionsSection(section: OptionsSectionId): void;
	showOptionsSection(section: OptionsSectionId): void;
	hideSetting(setting: OptionsSettingId): void;
	showSetting(setting: OptionsSettingId): void;
	/** Pin a setting to `value`; `hidden` also removes it from the dialog. */
	lockSetting(setting: OptionsSettingId, value: ViewerOptionPrimitive, hidden?: boolean): void;
	unlockSetting(setting: OptionsSettingId): void;
	/** Set (or with `undefined`, clear) the host default for a setting. */
	setSettingDefault(setting: OptionsSettingId, value: ViewerOptionPrimitive | undefined): void;
	hideBackstagePage(page: BackstagePage): void;
	showBackstagePage(page: BackstagePage): void;
	hideBackstageCard(card: BackstageCardId): void;
	showBackstageCard(card: BackstageCardId): void;
	hideContextMenuCommand(command: ContextMenuCommandId): void;
	showContextMenuCommand(command: ContextMenuCommandId): void;
	hideCanvasContextMenuCommand(command: CanvasContextMenuCommandId): void;
	showCanvasContextMenuCommand(command: CanvasContextMenuCommandId): void;
	disableShortcut(action: EditorKeyActionName): void;
	enableShortcut(action: EditorKeyActionName): void;
	/** Move a command onto new chord(s); `undefined` restores the built-in chord. */
	remapShortcut(
		action: EditorKeyActionName,
		chords: ShortcutChord | readonly ShortcutChord[] | undefined,
	): void;
	setPanelVisible(panel: ViewerPanelId, visible: boolean): void;
	setFeatureEnabled(feature: ViewerFeatureId, enabled: boolean): void;
	setDialogAvailable(dialog: ViewerDialogId, available: boolean): void;
}

export interface ViewerCustomizationController {
	/** The helper methods, ready to spread onto a component handle. */
	readonly api: ViewerCustomizationApi;
	/** The normalised view the render sites read. Stable until the next change. */
	getResolved(): ResolvedCustomization;
	/** Subscribe to every change; returns the unsubscribe function. */
	subscribe(listener: () => void): () => void;
}

interface State {
	customization: ViewerCustomization;
	resolved: ResolvedCustomization;
}

function stateOf(customization: ViewerCustomization): State {
	return { customization, resolved: resolveCustomization(customization) };
}

/** Create the store for one viewer instance, seeded with `initial`. */
export function createCustomizationController(
	initial?: ViewerCustomization,
): ViewerCustomizationController {
	const store = createViewerStore<State>(stateOf({ ...initial }));
	const current = (): ViewerCustomization => store.getState().customization;
	const set = (next: ViewerCustomization): void => store.setState(stateOf(next));
	const update = (patch: ViewerCustomization): void => set(mergeCustomization(current(), patch));

	const ribbon = (edit: (r: NonNullable<ViewerCustomization['ribbon']>) => void): void => {
		const next = { ...current().ribbon };
		edit(next);
		update({ ribbon: next });
	};
	const options = (edit: (o: NonNullable<ViewerCustomization['options']>) => void): void => {
		const next = { ...current().options };
		edit(next);
		update({ options: next });
	};
	const backstage = (edit: (b: NonNullable<ViewerCustomization['backstage']>) => void): void => {
		const next = { ...current().backstage };
		edit(next);
		update({ backstage: next });
	};
	const menus = (edit: (m: NonNullable<ViewerCustomization['contextMenu']>) => void): void => {
		const next = { ...current().contextMenu };
		edit(next);
		update({ contextMenu: next });
	};
	const keys = (edit: (k: NonNullable<ViewerCustomization['keyboard']>) => void): void => {
		const next = { ...current().keyboard };
		edit(next);
		update({ keyboard: next });
	};

	const api: ViewerCustomizationApi = {
		getCustomization: current,
		setCustomization: (next) => set({ ...next }),
		updateCustomization: update,
		resetCustomization: () => set({}),
		hideRibbonTab: (tab) => ribbon((r) => (r.hiddenTabs = toggleInList(r.hiddenTabs, tab, true))),
		showRibbonTab: (tab) => ribbon((r) => (r.hiddenTabs = toggleInList(r.hiddenTabs, tab, false))),
		hideToolbarButton: (b) =>
			ribbon((r) => (r.hiddenButtons = toggleInList(r.hiddenButtons, b, true))),
		showToolbarButton: (b) =>
			ribbon((r) => (r.hiddenButtons = toggleInList(r.hiddenButtons, b, false))),
		hideRibbonControl: (b) =>
			ribbon((r) => (r.hiddenButtons = toggleInList(r.hiddenButtons, b, true))),
		showRibbonControl: (b) =>
			ribbon((r) => (r.hiddenButtons = toggleInList(r.hiddenButtons, b, false))),
		hideRibbonGroup: (g) => ribbon((r) => (r.hiddenGroups = toggleInList(r.hiddenGroups, g, true))),
		showRibbonGroup: (g) =>
			ribbon((r) => (r.hiddenGroups = toggleInList(r.hiddenGroups, g, false))),
		hideOptionsPage: (p) => options((o) => (o.hiddenPages = toggleInList(o.hiddenPages, p, true))),
		showOptionsPage: (p) => options((o) => (o.hiddenPages = toggleInList(o.hiddenPages, p, false))),
		hideOptionsSection: (s) =>
			options((o) => (o.hiddenSections = toggleInList(o.hiddenSections, s, true))),
		showOptionsSection: (s) =>
			options((o) => (o.hiddenSections = toggleInList(o.hiddenSections, s, false))),
		hideSetting: (s) =>
			options((o) => (o.hiddenSettings = toggleInList(o.hiddenSettings, s, true))),
		showSetting: (s) =>
			options((o) => (o.hiddenSettings = toggleInList(o.hiddenSettings, s, false))),
		lockSetting: (s, value, hidden) =>
			options((o) => {
				o.locked = withRecordEntry(o.locked, s, value);
				if (hidden !== undefined) {
					o.hiddenSettings = toggleInList(o.hiddenSettings, s, hidden);
				}
			}),
		unlockSetting: (s) => options((o) => (o.locked = withRecordEntry(o.locked, s, undefined))),
		setSettingDefault: (s, value) =>
			options((o) => (o.defaults = withRecordEntry(o.defaults, s, value))),
		hideBackstagePage: (p) =>
			backstage((b) => (b.hiddenPages = toggleInList(b.hiddenPages, p, true))),
		showBackstagePage: (p) =>
			backstage((b) => (b.hiddenPages = toggleInList(b.hiddenPages, p, false))),
		hideBackstageCard: (c) =>
			backstage((b) => (b.hiddenCards = toggleInList(b.hiddenCards, c, true))),
		showBackstageCard: (c) =>
			backstage((b) => (b.hiddenCards = toggleInList(b.hiddenCards, c, false))),
		hideContextMenuCommand: (c) =>
			menus((m) => (m.hiddenElementCommands = toggleInList(m.hiddenElementCommands, c, true))),
		showContextMenuCommand: (c) =>
			menus((m) => (m.hiddenElementCommands = toggleInList(m.hiddenElementCommands, c, false))),
		hideCanvasContextMenuCommand: (c) =>
			menus((m) => (m.hiddenCanvasCommands = toggleInList(m.hiddenCanvasCommands, c, true))),
		showCanvasContextMenuCommand: (c) =>
			menus((m) => (m.hiddenCanvasCommands = toggleInList(m.hiddenCanvasCommands, c, false))),
		disableShortcut: (a) => keys((k) => (k.disabled = toggleInList(k.disabled, a, true))),
		enableShortcut: (a) => keys((k) => (k.disabled = toggleInList(k.disabled, a, false))),
		remapShortcut: (a, chords) => keys((k) => (k.remap = withRecordEntry(k.remap, a, chords))),
		setPanelVisible: (panel, visible) =>
			update({ hiddenPanels: toggleInList(current().hiddenPanels, panel, !visible) }),
		setFeatureEnabled: (feature, enabled) =>
			update({ disabledFeatures: toggleInList(current().disabledFeatures, feature, !enabled) }),
		setDialogAvailable: (dialog, available) =>
			update({ hiddenDialogs: toggleInList(current().hiddenDialogs, dialog, !available) }),
	};

	return {
		api,
		getResolved: () => store.getState().resolved,
		subscribe: (listener) => store.subscribe(listener),
	};
}
