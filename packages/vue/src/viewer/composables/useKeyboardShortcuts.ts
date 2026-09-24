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
	isEditorControlTarget,
	isEditorTextInputTarget,
	mapEditorKey,
	NUDGE_LARGE,
	NUDGE_SMALL,
} from 'pptx-viewer-shared';
import { onMounted, onScopeDispose, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { MatchedShortcut, ShortcutActions } from './shortcut-actions';

export {
	groupShortcutCatalog,
	SHORTCUT_CATALOG,
	SHORTCUT_GROUP_LABEL_KEYS,
} from './shortcut-catalog';
export type { ShortcutCatalogGroup, ShortcutDefinition, ShortcutGroup } from './shortcut-catalog';
export type { MatchedShortcut, ShortcutActionName, ShortcutActions } from './shortcut-actions';

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
	/** False leaves native paste unclaimed; omitted preserves custom callbacks. */
	canPaste?: MaybeRefOrGetter<boolean>;
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
/*  Pure matcher                                                      */
/* ------------------------------------------------------------------ */

/** Resolved guard state: the plain (de-reffed) snapshot the matcher reads. */
export interface ShortcutGuardState {
	canEdit: boolean;
	canPaste?: boolean;
	isPresenting: boolean;
	hasSelection: boolean;
	inlineEditingElementId: string | null;
	tableEditorIsEditing: boolean;
	activeTool: string;
	isTextInput: boolean;
	/** The event came from a focusable chrome control (Tab stays focus navigation). */
	isControl?: boolean;
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
	altKey = false,
): MatchedShortcut {
	return mapEditorKey(
		{ key, ctrlKey: mod, shiftKey, altKey },
		{
			canEdit: guard.canEdit,
			canPaste: guard.canPaste,
			isPresenting: guard.isPresenting,
			hasSelection: guard.hasSelection,
			isEditingText: Boolean(guard.inlineEditingElementId || guard.tableEditorIsEditing),
			isDrawing: guard.activeTool !== 'select',
			isTextInputTarget: guard.isTextInput,
			isControlTarget: guard.isControl ?? false,
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
			canPaste: resolveFlag(options.canPaste, true),
			isPresenting: resolveFlag(options.isPresenting, false),
			hasSelection: resolveFlag(options.hasSelection, false),
			inlineEditingElementId: resolveFlag(options.inlineEditingElementId, null),
			tableEditorIsEditing: resolveFlag(options.tableEditorIsEditing, false),
			activeTool: resolveFlag(options.activeTool, 'select'),
			isTextInput: eventTargetIsTextInput(event),
			isControl: isEditorControlTarget(event.target),
		};
	}

	function matchShortcut(event: KeyboardEvent): MatchedShortcut {
		const mod = event.metaKey || event.ctrlKey;
		return resolveShortcutAction(event.key, mod, event.shiftKey, readGuard(event), event.altKey);
	}

	/**
	 * Dispatch by name rather than a hand-enumerated `switch`: every
	 * `ShortcutActionName` is also a `ShortcutActions` property of the same
	 * name (nudge excepted, handled separately for its `dx`/`dy` payload), so a
	 * new shared action reaches this dispatcher automatically instead of
	 * needing a matching `case` added here.
	 */
	function dispatch(result: MatchedShortcut): void {
		if (result.action === null) {
			return;
		}
		if (result.action === 'nudge') {
			actions.nudge?.(result.dx ?? 0, result.dy ?? 0);
			return;
		}
		const handler = actions[result.action];
		handler?.();
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
