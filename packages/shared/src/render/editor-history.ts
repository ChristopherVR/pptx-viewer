/**
 * editor-history.ts: Generic undo/redo history stack.
 *
 * Framework-agnostic: no React, Vue, Angular, or any other framework imports.
 * Designed to be consumed by a binding's editor state layer.
 *
 * ## Snapshot semantics (PRE-mutation model)
 *
 * `record(snapshot, label)` must be called with the snapshot taken BEFORE the
 * caller applies its mutation.  The class never deep-clones values: the caller
 * is responsible for passing already-cloned / immutable snapshots so that
 * mutations to the live state do not retroactively corrupt stored history
 * entries.
 *
 * ## Example usage
 *
 *   // before mutating:
 *   history.record(currentSnapshot(), 'Move element');
 *   // apply mutation to the live state ...
 *
 *   // undo:
 *   const result = history.undo(currentSnapshot());
 *   if (result) applySnapshot(result.snapshot);
 *
 *   // redo:
 *   const result = history.redo(currentSnapshot());
 *   if (result) applySnapshot(result.snapshot);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry<T> {
	readonly snapshot: T;
	readonly label: string;
}

export interface UndoRedoResult<T> {
	readonly snapshot: T;
	readonly label: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EditorHistoryOptions {
	/**
	 * Maximum number of past entries kept on the undo stack.
	 * When exceeded, the oldest entry is silently dropped.
	 * @default 100
	 */
	maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * Generic undo/redo history stack.
 *
 * `T` is the snapshot type; the caller decides what constitutes a snapshot
 * (e.g. `PptxSlide[]`, a plain state object, etc.).
 *
 * No deep-cloning is performed inside this class; the caller must pass
 * already-cloned snapshots.
 */
export class EditorHistory<T> {
	private _maxDepth: number;
	private readonly _past: HistoryEntry<T>[] = [];
	private readonly _future: HistoryEntry<T>[] = [];

	constructor(options?: EditorHistoryOptions) {
		this._maxDepth = options?.maxDepth ?? 100;
	}

	/**
	 * Change the maximum undo depth at runtime (File > Options > Advanced >
	 * "Maximum number of undos"). Trims the past stack immediately if the new
	 * limit is smaller.
	 */
	setMaxDepth(maxDepth: number): void {
		this._maxDepth = Math.max(1, Math.floor(maxDepth));
		while (this._past.length > this._maxDepth) {
			this._past.shift();
		}
	}

	// -- Getters --------------------------------------------------------------

	/** True when at least one undo step is available. */
	get canUndo(): boolean {
		return this._past.length > 0;
	}

	/** True when at least one redo step is available. */
	get canRedo(): boolean {
		return this._future.length > 0;
	}

	/**
	 * Label of the most-recently recorded entry (the action that would be
	 * undone on the next `undo()` call), or `undefined` when the stack is
	 * empty.
	 */
	get undoLabel(): string | undefined {
		if (this._past.length === 0) {
			return undefined;
		}

		return this._past[this._past.length - 1].label;
	}

	/**
	 * Label of the most-recently undone entry (the action that would be
	 * redone on the next `redo()` call), or `undefined` when the redo stack
	 * is empty.
	 */
	get redoLabel(): string | undefined {
		if (this._future.length === 0) {
			return undefined;
		}

		return this._future[this._future.length - 1].label;
	}

	/** Number of entries currently on the undo (past) stack. */
	get depth(): number {
		return this._past.length;
	}

	// -- Mutations ------------------------------------------------------------

	/**
	 * Push `snapshot` (taken **before** the caller's mutation) onto the undo
	 * stack with the given `label`, then clear the redo stack.
	 *
	 * When the stack length exceeds `maxDepth`, the oldest entry is dropped.
	 *
	 * The caller must pass an already-cloned snapshot; this method does NOT
	 * deep-clone.
	 */
	record(snapshot: T, label: string): void {
		this._past.push({ snapshot, label });

		if (this._past.length > this._maxDepth) {
			this._past.shift();
		}

		// New record always invalidates the redo stack.
		this._future.length = 0;
	}

	/**
	 * Undo the last recorded action.
	 *
	 * Pops the top of the past stack, pushes `current` onto the future stack
	 * (so it can be redone), and returns the popped entry so the caller can
	 * restore it.
	 *
	 * Returns `undefined` when there is nothing to undo (`canUndo === false`).
	 *
	 * The caller must pass an already-cloned snapshot for `current`; this
	 * method does NOT deep-clone.
	 */
	undo(current: T): UndoRedoResult<T> | undefined {
		const entry = this._past.pop();

		if (entry === undefined) {
			return undefined;
		}

		this._future.push({ snapshot: current, label: entry.label });

		return { snapshot: entry.snapshot, label: entry.label };
	}

	/**
	 * Redo the last undone action.
	 *
	 * Pops the top of the future stack, pushes `current` back onto the past
	 * stack, and returns the popped entry so the caller can restore it.
	 *
	 * Returns `undefined` when there is nothing to redo (`canRedo === false`).
	 *
	 * The caller must pass an already-cloned snapshot for `current`; this
	 * method does NOT deep-clone.
	 */
	redo(current: T): UndoRedoResult<T> | undefined {
		const entry = this._future.pop();

		if (entry === undefined) {
			return undefined;
		}

		this._past.push({ snapshot: current, label: entry.label });

		return { snapshot: entry.snapshot, label: entry.label };
	}

	/**
	 * Clear both the undo and redo stacks, resetting history to an empty
	 * state.
	 */
	clear(): void {
		this._past.length = 0;
		this._future.length = 0;
	}
}
