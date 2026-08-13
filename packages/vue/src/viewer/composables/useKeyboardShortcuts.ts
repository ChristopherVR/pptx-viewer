/**
 * useKeyboardShortcuts: central, config-driven keyboard-shortcut registry for
 * the Vue PowerPoint editor.
 *
 * This is the Vue port of the React `useKeyboardShortcuts` hook
 * (`packages/react/src/viewer/hooks/useKeyboardShortcuts.ts`). Where the React
 * hook hard-codes a `switch` over key combos, the Vue version is built around a
 * **typed shortcut catalog**: a list of `{ id, combo, when, run, description,
 * group }` entries, so the same data drives both dispatch (`handleKeyDown`) and
 * the help overlay (`ShortcutPanel.vue`).
 *
 * Design goals:
 *  - **DOM-free-testable.** The composable takes a plain options object (action
 *    callbacks + reactive flags) and returns a pure `matchShortcut(event)`
 *    matcher and a `handleKeyDown(event)` dispatcher. No DOM access is required
 *    to unit-test the dispatch logic.
 *  - **Decoupled from the shell.** Action callbacks are injected, so the
 *    registry knows nothing about the viewer's state shape.
 *  - **Self-attach option.** Passing `{ autoAttach: true }` (or calling the
 *    returned `attach`) wires the handler to `window` on mount and tears it down
 *    on scope dispose, but the shell may also wire `handleKeyDown` itself.
 *
 * Combo-matching mirrors the React hook exactly:
 *  - shortcuts are only active when `canEdit` is true and `isPresenting` is false
 *    (the React `mode === 'edit' && canEdit` guard);
 *  - `Escape` is always handled (even while inline-editing / in a text input);
 *  - all other shortcuts are suppressed while inline-editing, editing a table
 *    cell, using a non-`select` drawing tool, or focused in a text input;
 *  - `Delete`/`Backspace`, the `Ctrl/Cmd` combos, arrow-nudge, and slide
 *    navigation map to the same actions and selection guards as React.
 */
import {
	isEditorTextInputTarget,
	mapEditorKey,
	NUDGE_LARGE,
	NUDGE_SMALL,
} from 'pptx-viewer-shared';
import { onMounted, onScopeDispose, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

// Re-exported, not redeclared: the nudge step is part of the shared keymap.
// Vue used to declare its own 2/20 "to match React", which is how it ended up
// moving elements twice as far as Angular, Vanilla and Svelte.
export { NUDGE_LARGE, NUDGE_SMALL };

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

/** Logical grouping for the help overlay. */
export type ShortcutGroup = 'history' | 'clipboard' | 'editing' | 'navigation' | 'general';

/** The set of action identifiers the registry can dispatch. */
export type ShortcutActionName =
	| 'undo'
	| 'redo'
	| 'copy'
	| 'cut'
	| 'paste'
	| 'duplicate'
	| 'delete'
	| 'selectAll'
	| 'group'
	| 'ungroup'
	| 'toggleShortcuts'
	| 'nudge'
	| 'prevSlide'
	| 'nextSlide'
	| 'escape'
	| 'find';

/**
 * Action callbacks the registry dispatches to. All are optional; a missing
 * callback simply means the corresponding shortcut is a no-op (but it is still
 * matched/suppressed, so the browser default is still prevented).
 */
export interface ShortcutActions {
	/** Undo the last edit (Ctrl/Cmd+Z). */
	undo?: () => void;
	/** Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y). */
	redo?: () => void;
	/** Copy the selection (Ctrl/Cmd+C). */
	copy?: () => void;
	/** Cut the selection (Ctrl/Cmd+X). */
	cut?: () => void;
	/** Paste (Ctrl/Cmd+V). */
	paste?: () => void;
	/** Duplicate the selection (Ctrl/Cmd+D). */
	duplicate?: () => void;
	/** Delete the selection (Delete / Backspace). */
	delete?: () => void;
	/** Select all elements on the active slide (Ctrl/Cmd+A). */
	selectAll?: () => void;
	/** Group the selection into one group element (Ctrl/Cmd+G). */
	group?: () => void;
	/** Ungroup the selected group (Ctrl/Cmd+Shift+G). */
	ungroup?: () => void;
	/** Show or hide the keyboard-shortcut reference ("?"). */
	toggleShortcuts?: () => void;
	/** Nudge the selection by (dx, dy) pixels (Arrow keys / Shift+Arrow). */
	nudge?: (dx: number, dy: number) => void;
	/** Navigate to the previous slide (ArrowLeft, no selection). */
	prevSlide?: () => void;
	/** Navigate to the next slide (ArrowRight, no selection). */
	nextSlide?: () => void;
	/** Escape: clear selection / close menus / cancel inline edit. */
	escape?: () => void;
	/** Open or close the find bar (Ctrl/Cmd+F). */
	find?: () => void;
}

/**
 * Reactive guard flags + action callbacks. Flags accept a ref, getter, or plain
 * value (`MaybeRefOrGetter`) so the shell can pass `computed`s directly.
 */
export interface UseKeyboardShortcutsOptions {
	/** Action callbacks the registry dispatches to. */
	actions: ShortcutActions;

	/** Whether editing is enabled (React `canEdit`). Defaults to `true`. */
	canEdit?: MaybeRefOrGetter<boolean>;
	/** Whether the viewer is in presentation mode (React `mode !== 'edit'`). */
	isPresenting?: MaybeRefOrGetter<boolean>;

	/** Whether at least one element is selected. */
	hasSelection?: MaybeRefOrGetter<boolean>;
	/** Id of the element being inline-edited, or `null`. Suppresses shortcuts. */
	inlineEditingElementId?: MaybeRefOrGetter<string | null>;
	/** Whether a table cell is actively being edited. Suppresses shortcuts. */
	tableEditorIsEditing?: MaybeRefOrGetter<boolean>;
	/** Active drawing tool; shortcuts are suppressed unless `'select'`. */
	activeTool?: MaybeRefOrGetter<string>;

	/**
	 * Self-attach the handler to `window` on mount (and detach on scope dispose).
	 * When omitted/false, the caller wires `handleKeyDown` itself.
	 */
	autoAttach?: boolean;
}

/** A single entry in the shortcut catalog (drives both dispatch and the help UI). */
export interface ShortcutDefinition {
	/** Stable identifier (also the action name where 1:1). */
	id: string;
	/**
	 * Human-readable, platform-neutral key combo (e.g. `'Mod+Z'`, `'Mod+Shift+Z'`,
	 * `'Delete'`, `'ArrowUp'`). `Mod` renders as ⌘ on macOS, Ctrl elsewhere.
	 */
	combo: string;
	/** Logical group for the help overlay. */
	group: ShortcutGroup;
	/** i18n key for the help-panel description. */
	descriptionKey: string;
}

/** Result of matching a keyboard event against the catalog. */
export interface MatchedShortcut {
	/** The dispatched action, or `null` when the event matches nothing. */
	action: ShortcutActionName | null;
	/** Nudge delta (only set when `action === 'nudge'`). */
	dx?: number;
	/** Nudge delta (only set when `action === 'nudge'`). */
	dy?: number;
}

export interface UseKeyboardShortcutsResult {
	/**
	 * Pure matcher: resolve a keyboard event to an action (respecting the guard
	 * flags) **without** invoking any callback or touching the DOM. Returns
	 * `{ action: null }` when the event should be ignored.
	 */
	matchShortcut: (event: KeyboardEvent) => MatchedShortcut;
	/**
	 * Dispatcher: match the event, call `preventDefault()` when an action fires,
	 * and invoke the corresponding callback. Safe to wire directly to `keydown`.
	 */
	handleKeyDown: (event: KeyboardEvent) => void;
	/** Manually attach the handler to `window`. Returns a detach function. */
	attach: () => () => void;
}

/* ------------------------------------------------------------------ */
/*  Shortcut catalog (for the help panel)                             */
/* ------------------------------------------------------------------ */

/**
 * The full catalog of shortcuts, grouped for the help overlay. The `combo`
 * strings use `Mod` as a platform-neutral Ctrl/Cmd token (rendered per-platform
 * by `ShortcutPanel.vue`). This is the single source of truth for the help UI.
 */
export const SHORTCUT_CATALOG: readonly ShortcutDefinition[] = [
	{ id: 'undo', combo: 'Mod+Z', group: 'history', descriptionKey: 'pptx.toolbar.undo' },
	{ id: 'redo', combo: 'Mod+Shift+Z', group: 'history', descriptionKey: 'pptx.toolbar.redo' },
	{
		id: 'redo-y',
		combo: 'Mod+Y',
		group: 'history',
		descriptionKey: 'pptx.shortcuts.action.redoAlternate',
	},
	{
		id: 'copy',
		combo: 'Mod+C',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.copyElement',
	},
	{
		id: 'cut',
		combo: 'Mod+X',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.cutElement',
	},
	{
		id: 'paste',
		combo: 'Mod+V',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.pasteElement',
	},
	{
		id: 'duplicate',
		combo: 'Mod+D',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.duplicateElement',
	},
	{
		id: 'delete',
		combo: 'Delete',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.deleteElement',
	},
	{
		id: 'select-all',
		combo: 'Mod+A',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.selectAll',
	},
	{ id: 'group', combo: 'Mod+G', group: 'editing', descriptionKey: 'pptx.ribbon.group' },
	{
		id: 'ungroup',
		combo: 'Mod+Shift+G',
		group: 'editing',
		descriptionKey: 'pptx.ribbon.ungroup',
	},
	{
		id: 'nudge',
		combo: 'ArrowKeys',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.nudgeElement',
	},
	{
		id: 'nudge-large',
		combo: 'Shift+ArrowKeys',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.nudgeElementLarge',
	},
	{
		id: 'prev-slide',
		combo: 'ArrowLeft',
		group: 'navigation',
		descriptionKey: 'pptx.shortcuts.action.prevSlide',
	},
	{
		id: 'next-slide',
		combo: 'ArrowRight',
		group: 'navigation',
		descriptionKey: 'pptx.shortcuts.action.nextSlide',
	},
	{
		id: 'escape',
		combo: 'Escape',
		group: 'general',
		descriptionKey: 'pptx.shortcuts.action.clearSelection',
	},
	{ id: 'find', combo: 'Mod+F', group: 'general', descriptionKey: 'pptx.findReplace.title' },
	{ id: 'shortcuts', combo: '?', group: 'general', descriptionKey: 'pptx.shortcuts.title' },
] as const;

/** i18n keys for each group's label, in display order. */
export const SHORTCUT_GROUP_LABEL_KEYS: Record<ShortcutGroup, string> = {
	history: 'pptx.editorToolbar.history',
	clipboard: 'pptx.ribbon.clipboard',
	editing: 'pptx.shortcuts.group.editing',
	navigation: 'pptx.shortcuts.group.navigation',
	general: 'pptx.settings.general',
};

/** The catalog grouped by `group`, in `SHORTCUT_GROUP_LABEL_KEYS` order. */
export interface ShortcutCatalogGroup {
	group: ShortcutGroup;
	labelKey: string;
	shortcuts: ShortcutDefinition[];
}

/** Group the catalog for display (preserves the label order). */
export function groupShortcutCatalog(
	catalog: readonly ShortcutDefinition[] = SHORTCUT_CATALOG,
): ShortcutCatalogGroup[] {
	const order = Object.keys(SHORTCUT_GROUP_LABEL_KEYS) as ShortcutGroup[];
	return order
		.map((group) => ({
			group,
			labelKey: SHORTCUT_GROUP_LABEL_KEYS[group],
			shortcuts: catalog.filter((entry) => entry.group === group),
		}))
		.filter((bucket) => bucket.shortcuts.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Pure matcher                                                      */
/* ------------------------------------------------------------------ */

/** Resolved guard state: the plain (de-reffed) snapshot the matcher reads. */
export interface ShortcutGuardState {
	canEdit: boolean;
	isPresenting: boolean;
	hasSelection: boolean;
	inlineEditingElementId: string | null;
	tableEditorIsEditing: boolean;
	activeTool: string;
	isTextInput: boolean;
}

/**
 * Pure dispatch logic: a thin translation of Vue's guard shape onto the shared
 * `mapEditorKey`, which is the one keymap every binding resolves against. DOM-
 * free and side-effect-free, so it can be unit-tested with synthetic inputs.
 *
 * Keeping the signature (rather than exposing `mapEditorKey` directly) means the
 * existing shell wiring and tests carry on working while the decision table has
 * only one copy left in the repo.
 */
export function resolveShortcutAction(
	key: string,
	mod: boolean,
	shiftKey: boolean,
	guard: ShortcutGuardState,
): MatchedShortcut {
	return mapEditorKey(
		{ key, ctrlKey: mod, shiftKey },
		{
			canEdit: guard.canEdit,
			isPresenting: guard.isPresenting,
			hasSelection: guard.hasSelection,
			isEditingText: Boolean(guard.inlineEditingElementId || guard.tableEditorIsEditing),
			isDrawing: guard.activeTool !== 'select',
			isTextInputTarget: guard.isTextInput,
		},
	);
}

/** Detect whether a keyboard event originated from an editable text target. */
function eventTargetIsTextInput(event: KeyboardEvent): boolean {
	return isEditorTextInputTarget(event.target);
}

/* ------------------------------------------------------------------ */
/*  Composable                                                        */
/* ------------------------------------------------------------------ */

export function useKeyboardShortcuts(
	options: UseKeyboardShortcutsOptions,
): UseKeyboardShortcutsResult {
	const { actions } = options;

	/** Snapshot the reactive guard flags for a single event. */
	function readGuard(event: KeyboardEvent): ShortcutGuardState {
		return {
			canEdit: resolveFlag(options.canEdit, true),
			isPresenting: resolveFlag(options.isPresenting, false),
			hasSelection: resolveFlag(options.hasSelection, false),
			inlineEditingElementId: resolveFlag(options.inlineEditingElementId, null),
			tableEditorIsEditing: resolveFlag(options.tableEditorIsEditing, false),
			activeTool: resolveFlag(options.activeTool, 'select'),
			isTextInput: eventTargetIsTextInput(event),
		};
	}

	function matchShortcut(event: KeyboardEvent): MatchedShortcut {
		const mod = event.metaKey || event.ctrlKey;
		return resolveShortcutAction(event.key, mod, event.shiftKey, readGuard(event));
	}

	function dispatch(result: MatchedShortcut): void {
		switch (result.action) {
			case 'escape':
				actions.escape?.();
				break;
			case 'delete':
				actions.delete?.();
				break;
			case 'undo':
				actions.undo?.();
				break;
			case 'redo':
				actions.redo?.();
				break;
			case 'copy':
				actions.copy?.();
				break;
			case 'cut':
				actions.cut?.();
				break;
			case 'paste':
				actions.paste?.();
				break;
			case 'duplicate':
				actions.duplicate?.();
				break;
			case 'selectAll':
				actions.selectAll?.();
				break;
			case 'group':
				actions.group?.();
				break;
			case 'ungroup':
				actions.ungroup?.();
				break;
			case 'find':
				actions.find?.();
				break;
			case 'toggleShortcuts':
				actions.toggleShortcuts?.();
				break;
			case 'nudge':
				actions.nudge?.(result.dx ?? 0, result.dy ?? 0);
				break;
			case 'prevSlide':
				actions.prevSlide?.();
				break;
			case 'nextSlide':
				actions.nextSlide?.();
				break;
			case null:
			default:
				break;
		}
	}

	function handleKeyDown(event: KeyboardEvent): void {
		const result = matchShortcut(event);
		if (result.action === null) {
			return;
		}
		event.preventDefault();
		dispatch(result);
	}

	function attach(): () => void {
		if (typeof window === 'undefined') {
			return () => {};
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}

	if (options.autoAttach) {
		let detach: (() => void) | undefined;
		onMounted(() => {
			detach = attach();
		});
		onScopeDispose(() => {
			detach?.();
		});
	}

	return { matchShortcut, handleKeyDown, attach };
}

/* ------------------------------------------------------------------ */
/*  Internal: reactive-flag resolver                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve a `MaybeRefOrGetter<T>` (ref, getter, or plain value) to its current
 * value, falling back to `fallback` when the option was omitted. Folds the
 * default in so optional options don't need per-field guards at the call site.
 */
function resolveFlag<T>(source: MaybeRefOrGetter<T> | undefined, fallback: T): T {
	return source === undefined ? fallback : toValue(source);
}
