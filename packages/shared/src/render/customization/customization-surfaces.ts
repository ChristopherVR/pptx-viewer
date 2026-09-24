/**
 * Decision functions that apply a resolved customisation to the descriptor
 * lists the bindings already render: the File > Options schema, the File tab
 * navigation and cards, and the two right-click menus.
 *
 * Each takes the list a binding would have rendered anyway and returns the
 * list it should render instead, so wiring a binding is a one-line change at
 * the render site rather than a new branch per id.
 *
 * @module render/customization/customization-surfaces
 */
import type { BackstagePage } from '../backstage';
import type { BackstageCard } from '../backstage-cards';
import type { CanvasContextMenuEntry } from '../canvas-context-menu-commands';
import type { ContextMenuEntry } from '../context-menu-commands';
import type {
	ViewerOptionsControl,
	ViewerOptionsSection,
	ViewerOptionsTabDefinition,
} from '../options/viewer-options-controls';
import type { ResolvedCustomization } from './customization-resolve';
import type { OptionsPageId, OptionsSectionId, OptionsSettingId } from './customization-types';

/** The `<group>.<key>` id of a schema control. */
export function optionsSettingIdOf(control: ViewerOptionsControl): OptionsSettingId {
	return `${control.group}.${control.key}` as OptionsSettingId;
}

/** True unless the host hid this Options page. */
export function isOptionsPageVisible(
	resolved: ResolvedCustomization,
	page: OptionsPageId,
): boolean {
	return !resolved.hiddenOptionsPages.has(page);
}

/** True when the host locked this setting to a fixed value. */
export function isSettingLocked(resolved: ResolvedCustomization, id: OptionsSettingId): boolean {
	return Object.hasOwn(resolved.lockedSettings, id);
}

/** True unless the host hid this setting. */
export function isSettingVisible(resolved: ResolvedCustomization, id: OptionsSettingId): boolean {
	return !resolved.hiddenSettings.has(id);
}

function customizeSection(
	tabId: string,
	section: ViewerOptionsSection,
	resolved: ResolvedCustomization,
): ViewerOptionsSection | null {
	if (resolved.hiddenOptionsSections.has(`${tabId}.${section.id}` as OptionsSectionId)) {
		return null;
	}
	const controls = section.controls
		.filter((control) => isSettingVisible(resolved, optionsSettingIdOf(control)))
		.map((control) =>
			isSettingLocked(resolved, optionsSettingIdOf(control))
				? { ...control, readOnly: true }
				: control,
		);
	// A section that lost every control and has no bespoke block is an empty
	// heading; drop it. One that was empty to begin with keeps its shape.
	if (controls.length === 0 && section.controls.length > 0 && !section.special) {
		return null;
	}
	return { ...section, controls };
}

/**
 * The File > Options tabs to render: hidden pages, sections and settings
 * removed, locked settings marked `readOnly`. A page that loses every section
 * (and has no bespoke pane) is removed too. Returns the input unchanged when
 * nothing about Options is customised, so a memoised render stays stable.
 */
export function customizeOptionsTabs(
	tabs: readonly ViewerOptionsTabDefinition[],
	resolved: ResolvedCustomization,
): readonly ViewerOptionsTabDefinition[] {
	if (
		resolved.hiddenOptionsPages.size === 0 &&
		resolved.hiddenOptionsSections.size === 0 &&
		resolved.hiddenSettings.size === 0 &&
		Object.keys(resolved.lockedSettings).length === 0
	) {
		return tabs;
	}
	const result: ViewerOptionsTabDefinition[] = [];
	for (const tab of tabs) {
		if (!isOptionsPageVisible(resolved, tab.id)) {
			continue;
		}
		const sections = tab.sections
			.map((section) => customizeSection(tab.id, section, resolved))
			.filter((section): section is ViewerOptionsSection => section !== null);
		if (sections.length === 0 && tab.sections.length > 0 && !tab.custom) {
			continue;
		}
		result.push({ ...tab, sections });
	}
	return result;
}

/**
 * Drop hidden entries from a menu and repair its separators: a group that
 * lost its first entry hands the rule to its next survivor, and the menu never
 * starts with a rule.
 */
export function filterMenuEntries<E extends { id: string; separatorBefore?: boolean }>(
	entries: readonly E[],
	hidden: ReadonlySet<string>,
): E[] {
	const result: E[] = [];
	let pendingSeparator = false;
	for (const entry of entries) {
		if (hidden.has(entry.id)) {
			pendingSeparator ||= entry.separatorBefore === true;
			continue;
		}
		const separatorBefore =
			result.length > 0 && (entry.separatorBefore === true || pendingSeparator);
		pendingSeparator = false;
		result.push(
			separatorBefore === (entry.separatorBefore === true) ? entry : { ...entry, separatorBefore },
		);
	}
	return result;
}

/** The element context menu after the host's customisation (empty when disabled). */
export function customizeContextMenuEntries(
	entries: readonly ContextMenuEntry[],
	resolved: ResolvedCustomization,
): ContextMenuEntry[] {
	if (!resolved.elementMenuEnabled) {
		return [];
	}
	return filterMenuEntries(entries, resolved.hiddenElementCommands);
}

/** The empty-canvas context menu after the host's customisation (empty when disabled). */
export function customizeCanvasContextMenuEntries(
	entries: readonly CanvasContextMenuEntry[],
	resolved: ResolvedCustomization,
): CanvasContextMenuEntry[] {
	if (!resolved.canvasMenuEnabled) {
		return [];
	}
	return filterMenuEntries(entries, resolved.hiddenCanvasCommands);
}

/** True unless the host hid this File tab page. */
export function isBackstagePageVisible(
	resolved: ResolvedCustomization,
	page: BackstagePage,
): boolean {
	return !resolved.hiddenBackstagePages.has(page);
}

/** Filter any `{ id: BackstagePage }` list (the nav rail) down to visible pages. */
export function customizeBackstageNav<T extends { id: BackstagePage }>(
	items: readonly T[],
	resolved: ResolvedCustomization,
): T[] {
	return items.filter((item) => isBackstagePageVisible(resolved, item.id));
}

/** Filter a page's action cards down to the ones the host kept. */
export function customizeBackstageCards<T extends Pick<BackstageCard, 'id'>>(
	cards: readonly T[],
	resolved: ResolvedCustomization,
): T[] {
	return cards.filter((card) => !resolved.hiddenBackstageCards.has(card.id));
}
