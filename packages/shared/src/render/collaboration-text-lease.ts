import type { PptxElement } from 'pptx-viewer-core';

import type { YMapLike } from './collaboration-sync';

interface TextLease {
	readonly ownsModel: (element: PptxElement) => boolean;
}

const leases = new WeakMap<YMapLike, TextLease>();

/** Only the mounted native editor may protect its exact live text target. */
export function registerCollaborationTextLease(
	target: YMapLike,
	ownsModel: (element: PptxElement) => boolean,
): () => void {
	const lease = { ownsModel };
	leases.set(target, lease);
	return () => {
		if (leases.get(target) === lease) {
			leases.delete(target);
		}
	};
}

/** Check model ownership before reconciliation so explicit Undo is not skipped. */
export function hasCollaborationTextLease(target: YMapLike, candidate: PptxElement): boolean {
	const lease = leases.get(target);
	if (!lease) {
		return false;
	}
	try {
		if (lease.ownsModel(candidate) && leases.get(target) === lease) {
			return true;
		}
	} catch {
		// A failed editor must never block an explicit model update.
	}
	if (leases.get(target) === lease) {
		leases.delete(target);
	}
	return false;
}
