/**
 * editor-history.test.ts: Unit tests for EditorHistory<T>.
 */

import { describe, expect, it } from 'vitest';

import { EditorHistory } from './editor-history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal snapshot type used throughout these tests. */
interface Snap {
	value: number;
}

function snap(value: number): Snap {
	return { value };
}

// ---------------------------------------------------------------------------
// Construction & defaults
// ---------------------------------------------------------------------------

describe('editorHistory: construction', () => {
	it('starts empty with canUndo=false and canRedo=false', () => {
		const h = new EditorHistory<Snap>();
		expect(h.canUndo).toBeFalsy();
		expect(h.canRedo).toBeFalsy();
	});

	it('starts with depth 0', () => {
		const h = new EditorHistory<Snap>();
		expect(h.depth).toBe(0);
	});

	it('starts with undoLabel and redoLabel undefined', () => {
		const h = new EditorHistory<Snap>();
		expect(h.undoLabel).toBeUndefined();
		expect(h.redoLabel).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe('editorHistory: record', () => {
	it('record makes canUndo true', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'first');
		expect(h.canUndo).toBeTruthy();
	});

	it('record increases depth by 1', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		expect(h.depth).toBe(1);
		h.record(snap(2), 'b');
		expect(h.depth).toBe(2);
	});

	it('undoLabel reflects the most-recently recorded label', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'alpha');
		expect(h.undoLabel).toBe('alpha');
		h.record(snap(2), 'beta');
		expect(h.undoLabel).toBe('beta');
	});

	it('record clears the redo stack', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'first');
		h.undo(snap(2)); // pushes onto future
		expect(h.canRedo).toBeTruthy();
		h.record(snap(3), 'new action');
		expect(h.canRedo).toBeFalsy();
		expect(h.redoLabel).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// undo
// ---------------------------------------------------------------------------

describe('editorHistory: undo', () => {
	it('returns undefined when nothing to undo', () => {
		const h = new EditorHistory<Snap>();
		expect(h.undo(snap(0))).toBeUndefined();
	});

	it('returns the previously recorded snapshot', () => {
		const h = new EditorHistory<Snap>();
		const pre = snap(10);
		h.record(pre, 'action');
		const result = h.undo(snap(20));
		expect(result).toBeDefined();
		expect(result?.snapshot).toBe(pre);
	});

	it('returns the label from the recorded entry', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'Move shape');
		const result = h.undo(snap(2));
		expect(result?.label).toBe('Move shape');
	});

	it('decreases depth by 1 after undo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.undo(snap(3));
		expect(h.depth).toBe(1);
	});

	it('enables canRedo after undo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'x');
		h.undo(snap(2));
		expect(h.canRedo).toBeTruthy();
	});

	it('redoLabel is set to the undone action label after undo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'Resize');
		h.undo(snap(2));
		expect(h.redoLabel).toBe('Resize');
	});

	it('canUndo becomes false after undoing the only entry', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'only');
		h.undo(snap(2));
		expect(h.canUndo).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// redo
// ---------------------------------------------------------------------------

describe('editorHistory: redo', () => {
	it('returns undefined when nothing to redo', () => {
		const h = new EditorHistory<Snap>();
		expect(h.redo(snap(0))).toBeUndefined();
	});

	it('returns the snapshot that was current at undo time', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'step');
		const atUndo = snap(99);
		h.undo(atUndo);
		const result = h.redo(snap(0));
		expect(result?.snapshot).toBe(atUndo);
	});

	it('returns the label of the redone action', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'Delete element');
		h.undo(snap(2));
		const result = h.redo(snap(0));
		expect(result?.label).toBe('Delete element');
	});

	it('canRedo becomes false after redoing the only entry', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'x');
		h.undo(snap(2));
		h.redo(snap(1));
		expect(h.canRedo).toBeFalsy();
	});

	it('canUndo becomes true again after redo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'y');
		h.undo(snap(2));
		h.redo(snap(1));
		expect(h.canUndo).toBeTruthy();
	});

	it('depth increases by 1 after redo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.undo(snap(3));
		expect(h.depth).toBe(1);
		h.redo(snap(1));
		expect(h.depth).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: record → undo → redo
// ---------------------------------------------------------------------------

describe('editorHistory: round-trip', () => {
	it('undo then redo restores the correct snapshot sequence', () => {
		const h = new EditorHistory<Snap>();

		const s0 = snap(0);
		const s1 = snap(1);
		const s2 = snap(2);

		// Pre-mutation model:
		//   record(s0, 'init')  → past: [s0]
		//   record(s1, 'step1') → past: [s0, s1]
		// Current live state at this point is s2.
		h.record(s0, 'init');
		h.record(s1, 'step1');

		// undo(s2): pops s1 from past, pushes {s2} to future → returns s1
		const undo1 = h.undo(s2);
		expect(undo1?.snapshot).toBe(s1);

		// undo(s1): pops s0 from past, pushes {s1} to future → returns s0
		// future stack is now [{s2,'step1'}, {s1,'init'}] (s1 on top)
		const undo2 = h.undo(s1);
		expect(undo2?.snapshot).toBe(s0);

		// redo(s0): pops {s1,'init'} from the top of future → returns s1
		const redo1 = h.redo(s0);
		expect(redo1?.snapshot).toBe(s1);

		// After that redo, the future still has {s2,'step1'}; a second redo
		// from the live state (which is now s1) should return s2.
		const redo2 = h.redo(s1);
		expect(redo2?.snapshot).toBe(s2);
	});

	it('labels surface in the right order across undo/redo', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'alpha');
		h.record(snap(2), 'beta');

		expect(h.undoLabel).toBe('beta');
		h.undo(snap(3));
		expect(h.undoLabel).toBe('alpha');
		expect(h.redoLabel).toBe('beta');
		h.redo(snap(2));
		expect(h.undoLabel).toBe('beta');
		expect(h.redoLabel).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Redo cleared on new record after undo
// ---------------------------------------------------------------------------

describe('editorHistory: redo cleared by new record', () => {
	it('recording after undo wipes the redo stack', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.undo(snap(3));
		expect(h.canRedo).toBeTruthy();
		h.record(snap(99), 'new branch');
		expect(h.canRedo).toBeFalsy();
		expect(h.redoLabel).toBeUndefined();
	});

	it('subsequent undo only reaches the new-branch record', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.undo(snap(3)); // undo 'b'; future has one entry
		h.record(snap(5), 'c'); // clears future; past now has [a, c]
		const result = h.undo(snap(5));
		expect(result?.label).toBe('c');
	});
});

// ---------------------------------------------------------------------------
// maxDepth cap
// ---------------------------------------------------------------------------

describe('editorHistory: maxDepth', () => {
	it('does not exceed maxDepth entries', () => {
		const h = new EditorHistory<Snap>({ maxDepth: 3 });
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.record(snap(3), 'c');
		h.record(snap(4), 'd');
		expect(h.depth).toBe(3);
	});

	it('drops the oldest entry when maxDepth is exceeded', () => {
		const h = new EditorHistory<Snap>({ maxDepth: 2 });
		h.record(snap(1), 'first');
		h.record(snap(2), 'second');
		h.record(snap(3), 'third');

		// Stack should now hold [second, third]; 'first' was evicted.
		// Undo twice: expect labels 'third' then 'second'.
		const r1 = h.undo(snap(10));
		expect(r1?.label).toBe('third');
		const r2 = h.undo(snap(10));
		expect(r2?.label).toBe('second');
		expect(h.canUndo).toBeFalsy();
	});

	it('maxDepth of 1 keeps only the most recent entry', () => {
		const h = new EditorHistory<Snap>({ maxDepth: 1 });
		h.record(snap(1), 'old');
		h.record(snap(2), 'new');
		expect(h.depth).toBe(1);
		expect(h.undoLabel).toBe('new');
	});

	it('default maxDepth allows 100 entries', () => {
		const h = new EditorHistory<Snap>();
		for (let i = 0; i < 100; i++) {
			h.record(snap(i), `step-${String(i)}`);
		}
		expect(h.depth).toBe(100);
	});

	it('default maxDepth drops the 101st entry', () => {
		const h = new EditorHistory<Snap>();
		for (let i = 0; i < 101; i++) {
			h.record(snap(i), `step-${String(i)}`);
		}
		expect(h.depth).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('editorHistory: clear', () => {
	it('clear empties the undo stack', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.record(snap(2), 'b');
		h.clear();
		expect(h.canUndo).toBeFalsy();
		expect(h.depth).toBe(0);
	});

	it('clear empties the redo stack', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.undo(snap(2));
		h.clear();
		expect(h.canRedo).toBeFalsy();
		expect(h.redoLabel).toBeUndefined();
	});

	it('clear resets undoLabel and redoLabel to undefined', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'action');
		h.clear();
		expect(h.undoLabel).toBeUndefined();
		expect(h.redoLabel).toBeUndefined();
	});

	it('undo returns undefined after clear', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.clear();
		expect(h.undo(snap(0))).toBeUndefined();
	});

	it('redo returns undefined after clear', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.undo(snap(2));
		h.clear();
		expect(h.redo(snap(0))).toBeUndefined();
	});

	it('can record again normally after clear', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'before');
		h.clear();
		h.record(snap(2), 'after');
		expect(h.depth).toBe(1);
		expect(h.undoLabel).toBe('after');
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('editorHistory: edge cases', () => {
	it('multiple consecutive undos do not go below empty', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.undo(snap(2));
		expect(h.undo(snap(1))).toBeUndefined();
		expect(h.undo(snap(1))).toBeUndefined();
	});

	it('multiple consecutive redos do not go beyond available entries', () => {
		const h = new EditorHistory<Snap>();
		h.record(snap(1), 'a');
		h.undo(snap(2));
		h.redo(snap(1));
		expect(h.redo(snap(2))).toBeUndefined();
		expect(h.redo(snap(2))).toBeUndefined();
	});

	it('stores snapshot references as-is (no internal cloning)', () => {
		const h = new EditorHistory<Snap>();
		const original = snap(42);
		h.record(original, 'ref-test');
		const result = h.undo(snap(0));
		expect(result?.snapshot).toBe(original);
	});

	it('works with a non-object snapshot type (string)', () => {
		const h = new EditorHistory<string>();
		h.record('state-a', 'step A');
		const result = h.undo('state-b');
		expect(result?.snapshot).toBe('state-a');
	});
});
