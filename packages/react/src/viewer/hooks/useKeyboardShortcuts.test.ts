/**
 * Tests for the keyboard-shortcut decision logic behind useKeyboardShortcuts.
 *
 * The hook resolves keys through the shared `mapEditorKey`, so this suite drives
 * that map through the same adapter the hook uses. It deliberately no longer
 * re-implements the logic: the copy that used to live here is exactly how React
 * ended up nudging 2px while three other bindings nudged 1px, with a green test
 * suite the whole time.
 */
import { mapEditorKey, NUDGE_LARGE, NUDGE_SMALL } from 'pptx-viewer-shared';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Adapter: the guard translation the hook performs, in one place
// ---------------------------------------------------------------------------

interface ShortcutInput {
	mode: 'edit' | 'present' | 'view';
	canEdit: boolean;
	inlineEditingElementId: string | null;
	tableEditorIsEditing: boolean;
	activeTool: string;
	hasSelection: boolean;
	isTextInput: boolean;
}

type ActionName =
	| 'escape'
	| 'delete'
	| 'undo'
	| 'redo'
	| 'copy'
	| 'cut'
	| 'paste'
	| 'duplicate'
	| 'selectAll'
	| 'group'
	| 'ungroup'
	| 'toggleShortcuts'
	| 'nudge'
	| 'prevSlide'
	| 'nextSlide'
	| null;

interface DispatchResult {
	action: ActionName;
	dx?: number;
	dy?: number;
}

/** Resolve one key press exactly as the hook's keydown handler does. */
function resolveShortcutAction(
	key: string,
	ctrlKey: boolean,
	shiftKey: boolean,
	input: ShortcutInput,
): DispatchResult {
	return mapEditorKey(
		{ key, ctrlKey, shiftKey },
		{
			canEdit: input.canEdit,
			isPresenting: input.mode !== 'edit',
			hasSelection: input.hasSelection,
			isEditingText: Boolean(input.inlineEditingElementId || input.tableEditorIsEditing),
			isDrawing: input.activeTool !== 'select',
			isTextInputTarget: input.isTextInput,
		},
	);
}

// ---------------------------------------------------------------------------
// Default input factory
// ---------------------------------------------------------------------------

function defaultInput(overrides: Partial<ShortcutInput> = {}): ShortcutInput {
	return {
		mode: 'edit',
		canEdit: true,
		inlineEditingElementId: null,
		tableEditorIsEditing: false,
		activeTool: 'select',
		hasSelection: true,
		isTextInput: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts: shortcut dispatch logic', () => {
	// ── Guard conditions ──────────────────────────────────────────────
	describe('guard conditions', () => {
		it('should return null in present mode', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ mode: 'present' }),
			);
			expect(result.action).toBeNull();
		});

		it('should return null when canEdit is false', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ canEdit: false }),
			);
			expect(result.action).toBeNull();
		});

		it('should always handle Escape even in view mode guard (but edit mode required)', () => {
			const result = resolveShortcutAction('Escape', false, false, defaultInput());
			expect(result.action).toBe('escape');
		});

		it('should suppress non-Escape keys when inline editing', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ inlineEditingElementId: 'el-1' }),
			);
			expect(result.action).toBeNull();
		});

		it('should still allow Escape when inline editing', () => {
			const result = resolveShortcutAction(
				'Escape',
				false,
				false,
				defaultInput({ inlineEditingElementId: 'el-1' }),
			);
			expect(result.action).toBe('escape');
		});

		it('should suppress when table editor is editing', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ tableEditorIsEditing: true }),
			);
			expect(result.action).toBeNull();
		});

		it('should suppress when drawing tool is active', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ activeTool: 'pen' }),
			);
			expect(result.action).toBeNull();
		});

		it('should suppress when focus is in a text input', () => {
			const result = resolveShortcutAction(
				'Delete',
				false,
				false,
				defaultInput({ isTextInput: true }),
			);
			expect(result.action).toBeNull();
		});
	});

	// ── Delete / Backspace ────────────────────────────────────────────
	describe('delete', () => {
		it('should trigger delete on Delete key with selection', () => {
			expect(resolveShortcutAction('Delete', false, false, defaultInput()).action).toBe('delete');
		});

		it('should trigger delete on Backspace key with selection', () => {
			expect(resolveShortcutAction('Backspace', false, false, defaultInput()).action).toBe(
				'delete',
			);
		});

		it('should not trigger delete without selection', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultInput({ hasSelection: false })).action,
			).toBeNull();
		});
	});

	// ── Ctrl/Cmd combos ──────────────────────────────────────────────
	describe('ctrl combos', () => {
		it('ctrl+Z should trigger undo', () => {
			expect(resolveShortcutAction('z', true, false, defaultInput()).action).toBe('undo');
		});

		it('ctrl+Shift+Z should trigger redo', () => {
			expect(resolveShortcutAction('z', true, true, defaultInput()).action).toBe('redo');
		});

		it('ctrl+Y should trigger redo', () => {
			expect(resolveShortcutAction('y', true, false, defaultInput()).action).toBe('redo');
		});

		it('ctrl+C should trigger copy with selection', () => {
			expect(resolveShortcutAction('c', true, false, defaultInput()).action).toBe('copy');
		});

		it('ctrl+C should do nothing without selection', () => {
			expect(
				resolveShortcutAction('c', true, false, defaultInput({ hasSelection: false })).action,
			).toBeNull();
		});

		it('ctrl+X should trigger cut with selection', () => {
			expect(resolveShortcutAction('x', true, false, defaultInput()).action).toBe('cut');
		});

		it('ctrl+V should trigger paste (selection not required)', () => {
			expect(
				resolveShortcutAction('v', true, false, defaultInput({ hasSelection: false })).action,
			).toBe('paste');
		});

		it('ctrl+D should trigger duplicate with selection', () => {
			expect(resolveShortcutAction('d', true, false, defaultInput()).action).toBe('duplicate');
		});

		it('ctrl+A should trigger selectAll', () => {
			expect(resolveShortcutAction('a', true, false, defaultInput()).action).toBe('selectAll');
		});
	});

	// ── Arrow nudge ───────────────────────────────────────────────────
	describe('arrow nudge', () => {
		it('arrowUp should nudge up by NUDGE_SMALL', () => {
			const result = resolveShortcutAction('ArrowUp', false, false, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: 0, dy: -NUDGE_SMALL });
		});

		it('arrowDown should nudge down by NUDGE_SMALL', () => {
			const result = resolveShortcutAction('ArrowDown', false, false, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: 0, dy: NUDGE_SMALL });
		});

		it('arrowLeft should nudge left by NUDGE_SMALL', () => {
			const result = resolveShortcutAction('ArrowLeft', false, false, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: -NUDGE_SMALL, dy: 0 });
		});

		it('arrowRight should nudge right by NUDGE_SMALL', () => {
			const result = resolveShortcutAction('ArrowRight', false, false, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: NUDGE_SMALL, dy: 0 });
		});

		it('shift+ArrowUp should nudge by NUDGE_LARGE', () => {
			const result = resolveShortcutAction('ArrowUp', false, true, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: 0, dy: -NUDGE_LARGE });
		});

		it('shift+ArrowRight should nudge by NUDGE_LARGE', () => {
			const result = resolveShortcutAction('ArrowRight', false, true, defaultInput());
			expect(result).toStrictEqual({ action: 'nudge', dx: NUDGE_LARGE, dy: 0 });
		});
	});

	// ── Slide navigation ──────────────────────────────────────────────
	describe('slide navigation', () => {
		it('arrowLeft without selection should go to prev slide', () => {
			const result = resolveShortcutAction(
				'ArrowLeft',
				false,
				false,
				defaultInput({ hasSelection: false }),
			);
			expect(result.action).toBe('prevSlide');
		});

		it('arrowRight without selection should go to next slide', () => {
			const result = resolveShortcutAction(
				'ArrowRight',
				false,
				false,
				defaultInput({ hasSelection: false }),
			);
			expect(result.action).toBe('nextSlide');
		});
	});
});

// ---------------------------------------------------------------------------
// Newly bound keys
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts: group, ungroup and the help panel', () => {
	it('ctrl+G groups and ctrl+shift+G ungroups', () => {
		expect(resolveShortcutAction('g', true, false, defaultInput()).action).toBe('group');
		expect(resolveShortcutAction('g', true, true, defaultInput()).action).toBe('ungroup');
	});

	it('leaves ctrl+G alone with nothing selected', () => {
		expect(
			resolveShortcutAction('g', true, false, defaultInput({ hasSelection: false })).action,
		).toBeNull();
	});

	it('"?" toggles the shortcut reference without needing a selection', () => {
		expect(
			resolveShortcutAction('?', false, true, defaultInput({ hasSelection: false })).action,
		).toBe('toggleShortcuts');
	});
});
