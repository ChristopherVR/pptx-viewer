/**
 * Runtime catalogues of every id the customisation model accepts.
 *
 * The union types in `customization-types.ts` catch typos at compile time;
 * these arrays are the same sets as values, for hosts that build a settings
 * screen of their own, for the docs reference (which is generated from them,
 * see `customization-reference.ts`), and for the test that fails when an id is
 * left undocumented. Each literal list carries a compile-time exhaustiveness
 * check against its union, so a new command id cannot be forgotten here.
 *
 * @module render/customization/customization-catalog
 */
import { BACKSTAGE_NAV } from '../backstage';
import type { BackstagePage } from '../backstage';
import { BACKSTAGE_CARDS } from '../backstage-cards';
import type { BackstageCardId } from '../backstage-cards';
import type { CanvasContextMenuCommandId } from '../canvas-context-menu-commands';
import type { ContextMenuCommandId } from '../context-menu-commands';
import type { EditorKeyActionName } from '../editor-keymap';
import { DEFAULT_VIEWER_OPTIONS } from '../options/viewer-options';
import type { ViewerOptionsGroupId } from '../options/viewer-options';
import { VIEWER_OPTIONS_TABS } from '../options/viewer-options-schema';
import { TOOLBAR_TABS } from '../toolbar-actions';
import type { ToolbarButtonId, ToolbarTabId } from '../toolbar-actions';
import type {
	OptionsPageId,
	OptionsSectionId,
	OptionsSettingId,
	ViewerDialogId,
	ViewerExportFormatId,
	ViewerFeatureId,
	ViewerPanelId,
} from './customization-types';

/** Compile-time proof that `List` names every member of `Union`. */
type Exhaustive<Union, List extends readonly Union[]> = [Exclude<Union, List[number]>] extends [
	never,
]
	? List
	: never;

function exhaustive<Union>() {
	return <const List extends readonly Union[]>(list: Exhaustive<Union, List>): List => list;
}

export const RIBBON_TAB_IDS: readonly ToolbarTabId[] = TOOLBAR_TABS.map((tab) => tab.id);

export const TOOLBAR_BUTTON_IDS = exhaustive<ToolbarButtonId>()([
	'share',
	'broadcast',
	'export',
	'undo',
	'redo',
	'record',
	'notes',
	'fullscreen',
	'zoom',
	'navigation',
]);

export const OPTIONS_PAGE_IDS: readonly OptionsPageId[] = [
	...VIEWER_OPTIONS_TABS.map((tab) => tab.id),
	'ai',
];

export const OPTIONS_SECTION_IDS: readonly OptionsSectionId[] = VIEWER_OPTIONS_TABS.flatMap((tab) =>
	tab.sections.map((section): OptionsSectionId => `${tab.id}.${section.id}`),
);

function primitiveSettingIds(): OptionsSettingId[] {
	const ids: string[] = [];
	for (const group of Object.keys(DEFAULT_VIEWER_OPTIONS) as ViewerOptionsGroupId[]) {
		const values = DEFAULT_VIEWER_OPTIONS[group] as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(values)) {
			if (!Array.isArray(value)) {
				ids.push(`${group}.${key}`);
			}
		}
	}
	return ids as OptionsSettingId[];
}

export const OPTIONS_SETTING_IDS: readonly OptionsSettingId[] = primitiveSettingIds();

export const BACKSTAGE_PAGE_IDS: readonly BackstagePage[] = BACKSTAGE_NAV.map((item) => item.id);

export const BACKSTAGE_CARD_IDS: readonly BackstageCardId[] = Object.keys(
	BACKSTAGE_CARDS,
) as BackstageCardId[];

export const ELEMENT_CONTEXT_MENU_COMMAND_IDS = exhaustive<ContextMenuCommandId>()([
	'copy',
	'cut',
	'paste',
	'duplicate',
	'edit-text',
	'bring-forward',
	'send-backward',
	'bring-front',
	'send-back',
	'ai-ask',
	'ai-fix',
	'comment',
	'hyperlink',
	'table-insert-row-above',
	'table-insert-row-below',
	'table-delete-row',
	'table-insert-col-left',
	'table-insert-col-right',
	'table-delete-col',
	'table-merge-selected',
	'table-merge-right',
	'table-merge-down',
	'table-split',
	'group',
	'ungroup',
	'save-as-picture',
	'edit-alt-text',
	'size-and-position',
	'format-shape',
	'delete',
]);

export const CANVAS_CONTEXT_MENU_COMMAND_IDS = exhaustive<CanvasContextMenuCommandId>()([
	'paste',
	'layout',
	'reset-slide',
	'format-background',
	'grid-and-guides',
	'ruler',
]);

export const EDITOR_SHORTCUT_ACTION_IDS = exhaustive<EditorKeyActionName>()([
	'undo',
	'redo',
	'copy',
	'cut',
	'paste',
	'duplicate',
	'delete',
	'selectAll',
	'group',
	'ungroup',
	'nudge',
	'prevSlide',
	'nextSlide',
	'escape',
	'find',
	'findReplace',
	'toggleShortcuts',
	'alignLeft',
	'alignCenter',
	'alignRight',
	'alignJustify',
	'increaseFontSize',
	'decreaseFontSize',
	'copyFormat',
	'pasteFormat',
	'newSlide',
	'hyperlink',
	'clearFormatting',
	'cycleSelectionNext',
	'cycleSelectionPrev',
	'pasteSpecial',
]);

export const VIEWER_PANEL_IDS = exhaustive<ViewerPanelId>()([
	'statusBar',
	'slidesPane',
	'inspector',
	'notes',
	'quickAccessToolbar',
	'titleBar',
]);

export const VIEWER_FEATURE_IDS = exhaustive<ViewerFeatureId>()([
	'ai',
	'collaboration',
	'comments',
	'presentMode',
]);

export const VIEWER_DIALOG_IDS = exhaustive<ViewerDialogId>()([
	'options',
	'share',
	'broadcast',
	'print',
	'export',
]);

export const VIEWER_EXPORT_FORMAT_IDS = exhaustive<ViewerExportFormatId>()([
	'pdf',
	'png',
	'video',
	'gif',
	'json',
	'copyImage',
]);
