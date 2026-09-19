import type { DeltaOp } from './collaboration-text-codec';
import type { YTextEditableLike } from './collaboration-text-merge';
import type { ObservedTextSessionUnit } from './collaboration-text-session-apply';
import { applyTextSessionPlan } from './collaboration-text-session-apply';
import type { LocalTextEdit } from './collaboration-text-session-delta';
import {
	textSessionAttributesEqual,
	textSessionDeltaSupported,
	textSessionPlan,
	textSessionUnits,
} from './collaboration-text-session-delta';

/** Supplied by the binding's existing Yjs runtime, bound to this exact Y.Text. */
export interface TextSessionPositions<Position> {
	capture: (index: number, association: number) => Position;
	resolve: (position: Position) => number | null;
	/** Synchronize tracked positions once per batch, including in-transaction writes. */
	refresh?: () => boolean | void;
	/** Release only resources created for this session. */
	dispose?: () => void;
}

/** Opaque acknowledgement identity for an exact remote snapshot painted by an adapter. */
export interface CollaborationTextSnapshot {
	readonly delta: readonly DeltaOp[];
}

export interface CollaborationTextSession {
	applyLocalDelta: (delta: readonly DeltaOp[], edit?: LocalTextEdit) => boolean;
	readMerged: () => CollaborationTextSnapshot | undefined;
	adoptMerged: (snapshot: CollaborationTextSnapshot) => boolean;
	/** Capture an offset in the last painted/local draft, not the newer remote string. */
	bookmark: (index: number, association: number) => () => number | null;
	dispose: () => void;
}

/**
 * Rebase an active editor's local intent onto an integrated Y.Text.
 *
 * This primitive uses encoded deltas, including the codec's break and empty-run
 * carriers. Adapters must map native body offsets, initialize legacy plain-text
 * inputs, and apply/acknowledge remote DOM snapshots separately. It does not
 * reinterpret scalar text, own host resources or schedule delayed whole drafts.
 */
export function createCollaborationTextSession<Position>({
	text,
	positions,
	transact,
	isCurrent,
}: {
	text: YTextEditableLike;
	positions: TextSessionPositions<Position>;
	transact: (callback: () => void) => void;
	/** Checks edit permission and the exact document/element/text identity. */
	isCurrent: () => boolean;
}): CollaborationTextSession | undefined {
	if (!isCurrent() || positions.refresh?.() === false) {
		positions.dispose?.();
		return undefined;
	}
	const observe = (delta: readonly DeltaOp[]): ObservedTextSessionUnit<Position>[] | undefined =>
		textSessionUnits(delta)?.map((unit, index) => ({
			...unit,
			start: positions.capture(index, 0),
			end: positions.capture(index + 1, -1),
		}));
	let baseline = observe(text.toDelta());
	if (!baseline) {
		positions.dispose?.();
		return undefined;
	}
	let emptyBoundary = positions.capture(0, 0);
	let version = 0;
	let disposed = false;
	let snapshots = new WeakMap<
		CollaborationTextSnapshot,
		{ units: ObservedTextSessionUnit<Position>[]; boundary: Position; version: number }
	>();
	const dispose = (): void => {
		if (disposed) {
			return;
		}
		disposed = true;
		baseline = [];
		snapshots = new WeakMap();
		positions.dispose?.();
	};
	const active = (): boolean => {
		if (
			!disposed &&
			(!isCurrent() ||
				positions.refresh?.() === false ||
				!textSessionDeltaSupported(text.toDelta()))
		) {
			dispose();
		}
		return !disposed;
	};
	return {
		bookmark(index, association) {
			if (!active() || !Number.isInteger(index) || index < 0 || index > baseline!.length) {
				return () => null;
			}
			const units = baseline!;
			const position =
				association < 0 && index > 0
					? units[index - 1].end
					: (units[index]?.start ?? units[index - 1]?.end ?? emptyBoundary);
			return () => (active() ? positions.resolve(position) : null);
		},
		applyLocalDelta(delta, edit) {
			if (!active()) {
				return false;
			}
			const desired = textSessionUnits(delta);
			if (!desired) {
				return false;
			}
			const previous = baseline!;
			const before = previous.map((unit) => unit.text).join('');
			const after = desired.map((unit) => unit.text).join('');
			const plan = textSessionPlan(before, after, edit);
			if (!plan) {
				return false;
			}
			const { retainedIndices: indices, paragraphSources } = plan;
			if (
				previous.length === desired.length &&
				indices.every((retained, index) => retained === index) &&
				(!paragraphSources ||
					paragraphSources.every((source, index) => source === null || source === index)) &&
				desired.every((unit, index) =>
					textSessionAttributesEqual(previous[index].attributes, unit.attributes),
				)
			) {
				return true;
			}
			let next: ObservedTextSessionUnit<Position>[] | undefined;
			transact(() => {
				// A host beforeTransaction listener can change readiness or the text.
				if (!active()) {
					return;
				}
				next = applyTextSessionPlan(
					text,
					positions,
					previous,
					desired,
					indices,
					emptyBoundary,
					paragraphSources,
				);
			});
			if (!next || !active()) {
				return false;
			}
			baseline = next;
			version++;
			return true;
		},
		readMerged() {
			if (!active()) {
				return undefined;
			}
			const delta = text.toDelta();
			const units = observe(delta);
			if (!units) {
				dispose();
				return undefined;
			}
			const snapshot: CollaborationTextSnapshot = { delta };
			snapshots.set(snapshot, { units, boundary: positions.capture(0, 0), version });
			return snapshot;
		},
		adoptMerged(snapshot) {
			const observed = snapshots.get(snapshot);
			if (!active() || !observed || observed.version !== version) {
				return false;
			}
			baseline = observed.units;
			emptyBoundary = observed.boundary;
			version++;
			return true;
		},
		dispose,
	};
}
