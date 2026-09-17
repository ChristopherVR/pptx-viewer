import type { DeltaOp } from './collaboration-text-codec';
import { createTextPositionTracker } from './collaboration-text-positions';
import type { TextPositionChange } from './collaboration-text-positions';

/** Public snapshot operations supplied by the binding's existing Yjs runtime. */
export interface TextPositionSnapshots<Snapshot> {
	read: () => Snapshot;
	equal: (left: Snapshot, right: Snapshot) => boolean;
	subscribeBeforeObservers: (listener: () => void) => () => void;
}

export interface SnapshotText<Snapshot> {
	toString: () => string;
	toDelta: (
		current: Snapshot,
		previous: Snapshot,
		mark: (type: 'added' | 'removed') => object,
	) => DeltaOp[];
}

/**
 * Capture text identities before Yjs garbage collection, independent of host
 * observer order. Native Y.Text event.delta is lazy: an earlier host observer
 * can change it, causing a later mirror to apply a reentrant insertion twice.
 * Snapshot deltas distinguish equal-spelling replacements without private IDs.
 *
 * Only this subscription and local position references are owned here. The
 * document, provider, awareness and their other listeners remain host-owned.
 */
export function createSnapshotTextPositions<Snapshot>(
	text: SnapshotText<Snapshot>,
	snapshots: TextPositionSnapshots<Snapshot>,
) {
	const tracker = createTextPositionTracker(text.toString().length);
	let previous = snapshots.read();
	let busy = false;
	let disposed = false;
	let unsubscribe = () => {};
	const marker = Symbol('text-identity-change');
	const dispose = (): void => {
		if (!disposed) {
			disposed = true;
			unsubscribe();
			tracker.dispose();
		}
	};
	const refresh = (): boolean => {
		if (disposed || busy) {
			return false;
		}
		busy = true;
		try {
			const current = snapshots.read();
			if (snapshots.equal(current, previous)) {
				return true;
			}
			const delta = text.toDelta(current, previous, (type) => ({ type, marker }));
			const changes: TextPositionChange[] = [];
			for (const op of delta) {
				if (typeof op.insert !== 'string') {
					dispose();
					return false;
				}
				const change = op.attributes?.ychange;
				const marked =
					typeof change === 'object' &&
					change !== null &&
					'marker' in change &&
					change.marker === marker &&
					'type' in change;
				changes.push(
					!marked
						? { retain: op.insert.length }
						: change.type === 'added'
							? { insert: op.insert }
							: { delete: op.insert.length },
				);
			}
			previous = current;
			// Formatting/unrelated document changes have no character identity effect.
			if (
				changes.some((change) => change.insert !== undefined || change.delete !== undefined) &&
				!tracker.apply(changes)
			) {
				dispose();
				return false;
			}
			return true;
		} catch {
			// Unsupported remote content must retire this session, not throw from a host observer.
			dispose();
			return false;
		} finally {
			busy = false;
		}
	};
	const stop = snapshots.subscribeBeforeObservers(refresh);
	if (disposed) {
		stop();
	} else {
		unsubscribe = stop;
	}
	return { capture: tracker.capture, resolve: tracker.resolve, refresh, dispose };
}
