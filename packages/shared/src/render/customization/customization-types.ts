/**
 * The framework-neutral UI customisation model.
 *
 * A host describes what its users should (and should not) see in ONE plain
 * object, `ViewerCustomization`. Every binding (React, Vue, Angular, Svelte,
 * Vanilla) accepts the same object through its own idiom (a prop, an input, a
 * constructor option) and exposes the same imperative helpers, and every render
 * site asks the pure decision functions in this directory instead of deciding
 * for itself. That keeps the five bindings from drifting: a new id added here
 * reaches all five at once.
 *
 * Every field is optional and every list defaults to "hide nothing", so an
 * empty object (or no object at all) is exactly today's behaviour.
 *
 * @module render/customization/customization-types
 */
import type { BackstagePage } from '../backstage';
import type { BackstageCardId } from '../backstage-cards';
import type { CanvasContextMenuCommandId } from '../canvas-context-menu-commands';
import type { ContextMenuCommandId } from '../context-menu-commands';
import type { EditPointsCommandId } from '../edit-points/edit-points-menu';
import type { FreeformToolKind } from '../edit-points/freeform-tool-geometry';
import type { EditorKeyActionName } from '../editor-keymap';
import type {
	ViewerOptionPrimitive,
	ViewerOptions,
	ViewerOptionsGroupId,
} from '../options/viewer-options';
import type { ViewerOptionsTabId } from '../options/viewer-options-controls';
import type { RibbonContextualTabId, ToolbarButtonId, ToolbarTabId } from '../toolbar-actions';
import type { RibbonControlId, RibbonGroupId } from './ribbon-control-ids';

/** Keys of an options group whose value is a primitive (not an array). */
type PrimitiveKeys<T> = {
	[K in keyof T]: T[K] extends ViewerOptionPrimitive ? K : never;
}[keyof T] &
	string;

/**
 * One File > Options setting, addressed as `<group>.<key>`, for example
 * `general.userName` or `advanced.showGrid`. The union is derived from the
 * `ViewerOptions` model itself, so a typo is a compile error.
 */
export type OptionsSettingId = {
	[G in ViewerOptionsGroupId]: `${G}.${PrimitiveKeys<ViewerOptions[G]>}`;
}[ViewerOptionsGroupId];

/**
 * A File > Options page: the ten PowerPoint categories plus `ai`, the AI
 * assistant page a binding adds when the host configured an assistant.
 */
export type OptionsPageId = ViewerOptionsTabId | 'ai';

/**
 * One section of an Options page, addressed as `<page>.<section>`, for
 * example `general.personalize` or `advanced.print`. The full list is
 * `OPTIONS_SECTION_IDS` (derived from the schema at runtime).
 */
export type OptionsSectionId = `${ViewerOptionsTabId}.${string}`;

/** Values a host forces onto settings. */
export type OptionsSettingValues = Partial<Record<OptionsSettingId, ViewerOptionPrimitive>>;

/** Ribbon and toolbar customisation. */
export interface RibbonCustomization {
	/**
	 * Ribbon tabs to remove (the File tab included, unlike Customize Ribbon),
	 * and contextual tabs (`shapeFormat`, `pictureFormat`, ...) that should
	 * never appear.
	 */
	hiddenTabs?: readonly (ToolbarTabId | RibbonContextualTabId)[];
	/** Groups inside a tab to remove, as `<tab>.<group>` (`home.font`). */
	hiddenGroups?: readonly RibbonGroupId[];
	/**
	 * Controls to remove: a top-level toolbar button / control cluster
	 * (`share`, `zoom`, ...) or any ribbon control as
	 * `<tab>.<group>.<control>` (`home.font.bold`).
	 */
	hiddenButtons?: readonly (ToolbarButtonId | RibbonControlId)[];
}

/** File > Options (the Settings dialog) customisation. */
export interface OptionsCustomization {
	/** Whole pages to remove from the dialog's category rail. */
	hiddenPages?: readonly OptionsPageId[];
	/** Sections (`<page>.<section>`) to remove from their page. */
	hiddenSections?: readonly OptionsSectionId[];
	/** Individual settings (`<group>.<key>`) to remove wherever they appear. */
	hiddenSettings?: readonly OptionsSettingId[];
	/**
	 * Settings pinned to a fixed value. The value is forced into the options
	 * store, user edits to it are ignored, and the control renders read-only.
	 * Add the id to `hiddenSettings` too to lock it invisibly.
	 */
	locked?: OptionsSettingValues;
	/**
	 * Host defaults: the value a setting starts at when the user has not saved
	 * a choice of their own. "Reset" returns to these, not to the built-ins.
	 */
	defaults?: OptionsSettingValues;
}

/** File tab (backstage) customisation. */
export interface BackstageCustomization {
	/** Navigation entries (pages) to remove from the File tab. */
	hiddenPages?: readonly BackstagePage[];
	/** Action cards to remove from the pages that show them. */
	hiddenCards?: readonly BackstageCardId[];
}

/** Right-click menu customisation. */
export interface ContextMenuCustomization {
	/** Entries to remove from the element (right-click on a shape) menu. */
	hiddenElementCommands?: readonly ContextMenuCommandId[];
	/** Entries to remove from the empty-canvas menu. */
	hiddenCanvasCommands?: readonly CanvasContextMenuCommandId[];
	/**
	 * Entries to remove from the Edit Points menu (right-click a vertex or a
	 * segment while editing a shape's points).
	 */
	hiddenEditPointsCommands?: readonly EditPointsCommandId[];
	/** Remove the element context menu entirely. */
	disableElementMenu?: boolean;
	/** Remove the empty-canvas context menu entirely. */
	disableCanvasMenu?: boolean;
}

/**
 * A shortcut chord in the form `Mod+Shift+D`: modifiers `Mod` (Ctrl on
 * Windows/Linux, Cmd on macOS), `Ctrl`, `Meta`, `Alt`, `Shift`, joined by `+`,
 * followed by a `KeyboardEvent.key` value (`D`, `Delete`, `ArrowLeft`, `F2`).
 */
export type ShortcutChord = string;

/** Editor keyboard-shortcut customisation. */
export interface KeyboardCustomization {
	/** Turn every editor shortcut off (the host owns the keyboard). */
	disableAll?: boolean;
	/** Editor commands whose shortcut is turned off. */
	disabled?: readonly EditorKeyActionName[];
	/**
	 * Replacement chords per command. A remapped command no longer answers to
	 * its built-in chord; it answers to the chord(s) given here instead.
	 */
	remap?: Partial<Record<EditorKeyActionName, ShortcutChord | readonly ShortcutChord[]>>;
}

/**
 * Chrome regions a host can remove. Each id maps onto one region in every
 * binding; see `VIEWER_PANEL_IDS` for the catalogue.
 */
export type ViewerPanelId =
	| 'statusBar'
	| 'slidesPane'
	| 'inspector'
	| 'notes'
	| 'quickAccessToolbar'
	| 'titleBar';

/** Feature areas that can be switched off as a whole. */
export type ViewerFeatureId = 'ai' | 'collaboration' | 'comments' | 'presentMode' | 'editPoints';

/**
 * The click-to-place drawing tools of Insert > Shapes > Lines: Freeform:
 * Shape and Curve.
 */
export type ViewerDrawingToolId = FreeformToolKind;

/** Dialogs (and the entry points that open them) a host can remove. */
export type ViewerDialogId = 'options' | 'share' | 'broadcast' | 'print' | 'export';

/** Export formats offered by the File > Export page. */
export type ViewerExportFormatId = 'pdf' | 'png' | 'video' | 'gif' | 'json' | 'copyImage';

/**
 * The whole customisation object. Every field is optional; omitted fields hide
 * nothing and lock nothing.
 */
export interface ViewerCustomization {
	ribbon?: RibbonCustomization;
	options?: OptionsCustomization;
	backstage?: BackstageCustomization;
	contextMenu?: ContextMenuCustomization;
	keyboard?: KeyboardCustomization;
	/** Chrome regions to remove (`true` hides). */
	hiddenPanels?: readonly ViewerPanelId[];
	/** Feature areas to switch off (their buttons, menus, pages and panels). */
	disabledFeatures?: readonly ViewerFeatureId[];
	/** Dialogs to remove, along with every entry point that opens them. */
	hiddenDialogs?: readonly ViewerDialogId[];
	/** Export formats to remove from File > Export. */
	hiddenExportFormats?: readonly ViewerExportFormatId[];
	/** Drawing tools to remove from the Insert > Shapes gallery. */
	hiddenDrawingTools?: readonly ViewerDrawingToolId[];
}
