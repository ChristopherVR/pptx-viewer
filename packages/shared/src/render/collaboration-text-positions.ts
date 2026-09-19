/** Identity-preserving changes from a CRDT snapshot, not a plain-text diff. */
export interface TextPositionChange {
	retain?: number;
	delete?: number;
	insert?: string;
}

interface TextPositionCell {
	index: number;
	left?: TextPositionCell;
	right?: TextPositionCell;
}

export interface TrackedTextPosition {
	/** Internal identity, shared by snapshots that observed the same character. */
	readonly cell: TextPositionCell;
	readonly association: number;
}

/**
 * Keep observed character identities without a Yjs index scan per character.
 * Removed characters point to surviving neighbours; resolving their start/end
 * cannot include new text inserted into the deleted gap. This uses explicit gap
 * affinity, not Yjs's historical tombstone ordering or collaborative undo.
 *
 * A bridge must provide complete identity-preserving changes before capture or
 * resolution, including local writes. Unordered/lazy observer deltas are not a
 * sufficient source when host observers can change the document themselves.
 */
export function createTextPositionTracker(length: number) {
	const start: TextPositionCell = { index: 0 };
	const end: TextPositionCell = { index: length };
	let cells: TextPositionCell[] = Array.from({ length }, (_, index) => ({ index }));
	let disposed = false;
	const dispose = (): void => {
		disposed = true;
		cells = [];
	};
	const neighbour = (cell: TextPositionCell, direction: 'left' | 'right'): TextPositionCell => {
		const path: TextPositionCell[] = [];
		while (cell.index < 0) {
			path.push(cell);
			cell = cell[direction]!;
		}
		for (const removed of path) {
			removed[direction] = cell;
		}
		return cell;
	};
	return {
		capture(index: number, association: number): TrackedTextPosition {
			if (disposed || !Number.isInteger(index) || index < 0 || index > cells.length) {
				throw new RangeError('Cannot capture a position outside the current text');
			}
			return {
				cell: association < 0 ? (cells[index - 1] ?? start) : (cells[index] ?? end),
				association,
			};
		},
		resolve(position: TrackedTextPosition): number | null {
			if (disposed) {
				return null;
			}
			const cell = neighbour(position.cell, position.association < 0 ? 'left' : 'right');
			return cell === start || cell === end
				? cell.index
				: cell.index + (position.association < 0 ? 1 : 0);
		},
		apply(changes: readonly TextPositionChange[]): boolean {
			if (disposed) {
				return false;
			}
			let oldIndex = 0;
			const next: TextPositionCell[] = [];
			const removed: Array<{ cell: TextPositionCell; left: TextPositionCell; rightIndex: number }> =
				[];
			for (const change of changes) {
				if (
					[change.retain, change.delete, change.insert].filter((value) => value !== undefined)
						.length !== 1
				) {
					dispose();
					return false;
				}
				if (change.insert !== undefined) {
					for (let index = 0; index < change.insert.length; index++) {
						next.push({ index: next.length });
					}
					continue;
				}
				const count = change.retain ?? change.delete!;
				if (!Number.isInteger(count) || count < 0 || oldIndex + count > cells.length) {
					dispose();
					return false;
				}
				for (let index = 0; index < count; index++) {
					const cell = cells[oldIndex++];
					if (change.retain !== undefined) {
						next.push(cell);
					} else {
						removed.push({ cell, left: next.at(-1) ?? start, rightIndex: next.length });
					}
				}
			}
			while (oldIndex < cells.length) {
				next.push(cells[oldIndex++]);
			}
			for (const { cell, left, rightIndex } of removed) {
				cell.index = -1;
				cell.left = left;
				cell.right = next[rightIndex] ?? end;
			}
			next.forEach((cell, index) => {
				cell.index = index;
			});
			cells = next;
			end.index = cells.length;
			return true;
		},
		dispose,
	};
}
