// oxlint-disable react-hooks/rules-of-hooks
/**
 * Tests for the central keyboard-shortcut registry.
 *
 * Two layers:
 *  1. `resolveShortcutAction`: the pure dispatch logic (ported verbatim from
 *     the React `useKeyboardShortcuts.test.ts`); covers every guard, combo,
 *     nudge, and slide-nav branch.
 *  2. `useKeyboardShortcuts`: the composable wiring: `matchShortcut` over real
 *     `KeyboardEvent`s, `handleKeyDown` dispatch + `preventDefault`, reactive
 *     guard flags, the catalog grouping, and `attach`/`autoAttach`.
 */
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import {
	NUDGE_LARGE,
	NUDGE_SMALL,
	SHORTCUT_CATALOG,
	groupShortcutCatalog,
	resolveShortcutAction,
	useKeyboardShortcuts,
} from './useKeyboardShortcuts';
import type {
	ShortcutActions,
	ShortcutGuardState,
	UseKeyboardShortcutsResult,
} from './useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Pure dispatch logic: ported from React useKeyboardShortcuts.test.ts
// ---------------------------------------------------------------------------

function defaultGuard(overrides: Partial<ShortcutGuardState> = {}): ShortcutGuardState {
	return {
		canEdit: true,
		isPresenting: false,
		hasSelection: true,
		inlineEditingElementId: null,
		tableEditorIsEditing: false,
		activeTool: 'select',
		isTextInput: false,
		...overrides,
	};
}

describe('resolveShortcutAction - pure dispatch logic', () => {
	describe('guard conditions', () => {
		it('returns null in present mode', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ isPresenting: true })).action,
			).toBeNull();
		});

		it('returns null when canEdit is false', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ canEdit: false })).action,
			).toBeNull();
		});

		it('handles Escape in edit mode', () => {
			expect(resolveShortcutAction('Escape', false, false, defaultGuard()).action).toBe('escape');
		});

		it('suppresses non-Escape keys when inline editing', () => {
			expect(
				resolveShortcutAction(
					'Delete',
					false,
					false,
					defaultGuard({ inlineEditingElementId: 'el-1' }),
				).action,
			).toBeNull();
		});

		it('still allows Escape when inline editing', () => {
			expect(
				resolveShortcutAction(
					'Escape',
					false,
					false,
					defaultGuard({ inlineEditingElementId: 'el-1' }),
				).action,
			).toBe('escape');
		});

		it('suppresses when table editor is editing', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ tableEditorIsEditing: true }))
					.action,
			).toBeNull();
		});

		it('suppresses when drawing tool is active', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ activeTool: 'pen' })).action,
			).toBeNull();
		});

		it('suppresses when focus is in a text input', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ isTextInput: true })).action,
			).toBeNull();
		});
	});

	describe('delete', () => {
		it('triggers delete on Delete with selection', () => {
			expect(resolveShortcutAction('Delete', false, false, defaultGuard()).action).toBe('delete');
		});

		it('triggers delete on Backspace with selection', () => {
			expect(resolveShortcutAction('Backspace', false, false, defaultGuard()).action).toBe(
				'delete',
			);
		});

		it('does not trigger delete without selection', () => {
			expect(
				resolveShortcutAction('Delete', false, false, defaultGuard({ hasSelection: false })).action,
			).toBeNull();
		});
	});

	describe('ctrl/cmd combos', () => {
		it('ctrl+Z triggers undo', () => {
			expect(resolveShortcutAction('z', true, false, defaultGuard()).action).toBe('undo');
		});

		it('ctrl+Shift+Z triggers redo', () => {
			expect(resolveShortcutAction('z', true, true, defaultGuard()).action).toBe('redo');
		});

		it('ctrl+Y triggers redo', () => {
			expect(resolveShortcutAction('y', true, false, defaultGuard()).action).toBe('redo');
		});

		it('ctrl+C triggers copy with selection', () => {
			expect(resolveShortcutAction('c', true, false, defaultGuard()).action).toBe('copy');
		});

		it('ctrl+C does nothing without selection', () => {
			expect(
				resolveShortcutAction('c', true, false, defaultGuard({ hasSelection: false })).action,
			).toBeNull();
		});

		it('ctrl+X triggers cut with selection', () => {
			expect(resolveShortcutAction('x', true, false, defaultGuard()).action).toBe('cut');
		});

		it('ctrl+V triggers paste (selection not required)', () => {
			expect(
				resolveShortcutAction('v', true, false, defaultGuard({ hasSelection: false })).action,
			).toBe('paste');
		});

		it('ctrl+D triggers duplicate with selection', () => {
			expect(resolveShortcutAction('d', true, false, defaultGuard()).action).toBe('duplicate');
		});

		it('ctrl+A triggers selectAll', () => {
			expect(resolveShortcutAction('a', true, false, defaultGuard()).action).toBe('selectAll');
		});
	});

	describe('arrow nudge', () => {
		it('arrowUp nudges up by NUDGE_SMALL', () => {
			expect(resolveShortcutAction('ArrowUp', false, false, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: 0,
				dy: -NUDGE_SMALL,
			});
		});

		it('arrowDown nudges down by NUDGE_SMALL', () => {
			expect(resolveShortcutAction('ArrowDown', false, false, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: 0,
				dy: NUDGE_SMALL,
			});
		});

		it('arrowLeft nudges left by NUDGE_SMALL', () => {
			expect(resolveShortcutAction('ArrowLeft', false, false, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: -NUDGE_SMALL,
				dy: 0,
			});
		});

		it('arrowRight nudges right by NUDGE_SMALL', () => {
			expect(resolveShortcutAction('ArrowRight', false, false, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: NUDGE_SMALL,
				dy: 0,
			});
		});

		it('shift+ArrowUp nudges by NUDGE_LARGE', () => {
			expect(resolveShortcutAction('ArrowUp', false, true, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: 0,
				dy: -NUDGE_LARGE,
			});
		});

		it('shift+ArrowRight nudges by NUDGE_LARGE', () => {
			expect(resolveShortcutAction('ArrowRight', false, true, defaultGuard())).toStrictEqual({
				action: 'nudge',
				dx: NUDGE_LARGE,
				dy: 0,
			});
		});
	});

	describe('slide navigation', () => {
		it('arrowLeft without selection goes to prev slide', () => {
			expect(
				resolveShortcutAction('ArrowLeft', false, false, defaultGuard({ hasSelection: false }))
					.action,
			).toBe('prevSlide');
		});

		it('arrowRight without selection goes to next slide', () => {
			expect(
				resolveShortcutAction('ArrowRight', false, false, defaultGuard({ hasSelection: false }))
					.action,
			).toBe('nextSlide');
		});
	});
});

// ---------------------------------------------------------------------------
// Catalog grouping
// ---------------------------------------------------------------------------

describe('shortcut catalog', () => {
	it('groups the catalog, preserving label order and dropping empty groups', () => {
		const grouped = groupShortcutCatalog();
		expect(grouped.map((bucket) => bucket.group)).toStrictEqual([
			'history',
			'clipboard',
			'editing',
			'navigation',
			'general',
		]);
		const total = grouped.reduce((sum, bucket) => sum + bucket.shortcuts.length, 0);
		expect(total).toBe(SHORTCUT_CATALOG.length);
	});

	it('filters out groups with no matching shortcuts', () => {
		const grouped = groupShortcutCatalog(
			SHORTCUT_CATALOG.filter((entry) => entry.group === 'history'),
		);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].group).toBe('history');
	});
});

// ---------------------------------------------------------------------------
// Composable wiring
// ---------------------------------------------------------------------------

interface KeyEventInit {
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	target?: EventTarget | null;
}

function makeKeyEvent(init: KeyEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key: init.key,
		ctrlKey: init.ctrlKey ?? false,
		metaKey: init.metaKey ?? false,
		shiftKey: init.shiftKey ?? false,
		cancelable: true,
	});
	if (init.target !== undefined) {
		Object.defineProperty(event, 'target', { value: init.target, configurable: true });
	}
	return event;
}

function setup(
	actions: ShortcutActions,
	options: Record<string, unknown> = {},
): { api: UseKeyboardShortcutsResult; stop: () => void } {
	const scope = effectScope();
	let api!: UseKeyboardShortcutsResult;
	scope.run(() => {
		api = useKeyboardShortcuts({ actions, canEdit: true, ...options });
	});
	return { api, stop: () => scope.stop() };
}

describe('useKeyboardShortcuts', () => {
	it('matchShortcut maps a real KeyboardEvent to the action', () => {
		const { api, stop } = setup({}, { hasSelection: ref(true) });
		expect(api.matchShortcut(makeKeyEvent({ key: 'z', ctrlKey: true })).action).toBe('undo');
		expect(api.matchShortcut(makeKeyEvent({ key: 'z', metaKey: true })).action).toBe('undo');
		expect(api.matchShortcut(makeKeyEvent({ key: 'Delete' })).action).toBe('delete');
		stop();
	});

	it('handleKeyDown dispatches the callback and prevents default', () => {
		const undo = vi.fn();
		const { api, stop } = setup({ undo }, { hasSelection: ref(true) });
		const event = makeKeyEvent({ key: 'z', ctrlKey: true });
		api.handleKeyDown(event);
		expect(undo).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBeTruthy();
		stop();
	});

	it('handleKeyDown forwards nudge deltas', () => {
		const nudge = vi.fn();
		const { api, stop } = setup({ nudge }, { hasSelection: ref(true) });
		api.handleKeyDown(makeKeyEvent({ key: 'ArrowRight', shiftKey: true }));
		expect(nudge).toHaveBeenCalledWith(NUDGE_LARGE, 0);
		stop();
	});

	it('does not preventDefault or dispatch when no action matches', () => {
		const undo = vi.fn();
		const { api, stop } = setup({ undo }, { hasSelection: ref(true) });
		// 'q' is not a registered combo.
		const event = makeKeyEvent({ key: 'q', ctrlKey: true });
		api.handleKeyDown(event);
		expect(undo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
		stop();
	});

	it('respects reactive guard flags (isPresenting suppresses)', () => {
		const del = vi.fn();
		const isPresenting = ref(false);
		const { api, stop } = setup({ delete: del }, { hasSelection: ref(true), isPresenting });
		api.handleKeyDown(makeKeyEvent({ key: 'Delete' }));
		expect(del).toHaveBeenCalledOnce();

		isPresenting.value = true;
		api.handleKeyDown(makeKeyEvent({ key: 'Delete' }));
		expect(del).toHaveBeenCalledOnce(); // unchanged
		stop();
	});

	it('treats an INPUT target as a text input and suppresses', () => {
		const del = vi.fn();
		const { api, stop } = setup({ delete: del }, { hasSelection: ref(true) });
		const input = document.createElement('input');
		api.handleKeyDown(makeKeyEvent({ key: 'Delete', target: input }));
		expect(del).not.toHaveBeenCalled();
		// Escape still works in a text input.
		const esc = vi.fn();
		const { api: api2, stop: stop2 } = setup({ escape: esc }, { hasSelection: ref(true) });
		api2.handleKeyDown(makeKeyEvent({ key: 'Escape', target: input }));
		expect(esc).toHaveBeenCalledOnce();
		stop();
		stop2();
	});

	it('attach wires a window listener and returns a detach', () => {
		const redo = vi.fn();
		const { api, stop } = setup({ redo }, { hasSelection: ref(true) });
		const detach = api.attach();
		window.dispatchEvent(makeKeyEvent({ key: 'y', ctrlKey: true }));
		expect(redo).toHaveBeenCalledOnce();
		detach();
		window.dispatchEvent(makeKeyEvent({ key: 'y', ctrlKey: true }));
		expect(redo).toHaveBeenCalledOnce(); // detached
		stop();
	});

	it('autoAttach wires on mount and tears down on scope dispose', () => {
		const undo = vi.fn();
		const scope = effectScope();
		scope.run(() => {
			useKeyboardShortcuts({
				actions: { undo },
				canEdit: true,
				hasSelection: ref(true),
				autoAttach: true,
			});
		});
		// onMounted does not fire without a component instance, so the autoAttach
		// branch is registered but inert here; disposing the scope must not throw.
		expect(() => scope.stop()).not.toThrow();
	});
});
