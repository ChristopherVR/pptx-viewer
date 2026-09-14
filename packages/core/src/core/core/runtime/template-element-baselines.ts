/**
 * @fileoverview "Which slide's copy of an inherited shape is the edited one?"
 *
 * Every slide on a layout receives the SAME layout/master element objects
 * (`layoutCache` parses a part once), and each of those objects points at the
 * one `rawXml` node inside the cached part tree. The save writer persists an
 * inherited edit by patching that shared node in place, and it used to do so
 * for EVERY slide's copy, unconditionally. Bindings update state immutably,
 * so an edit on slide 1 produces a fresh element object while slide 2 keeps
 * the pristine one; whichever slide the loop reached last won, and the
 * pristine copy silently wrote the original colour back over the edit.
 *
 * The tracker records a structural signature of each inherited element when
 * its copies are first produced (the baseline) and lets the writer skip any
 * copy that still matches it: the part already holds that XML. A copy that
 * differs is written and its signature becomes the new baseline once the save
 * completes. Copies that matched the OLD baseline during that save are then
 * marked stale BY IDENTITY, so on a later save they keep being skipped even
 * though they no longer match the baseline, while a genuinely new object that
 * happens to carry the original values (an undo) is still written back.
 */
import type { PptxElement } from '../../types';
import { templateElementSignature } from './master-part-element-signature';

interface SeenCopy {
	readonly element: PptxElement;
	readonly signature: string;
}

export class TemplateElementBaselineTracker {
	/** Element id -> signature of the copy the owning part currently holds. */
	private readonly baselines = new Map<string, string>();

	/** Copies superseded by a written edit; skipped on every later save. */
	private stale = new WeakSet<PptxElement>();

	/** Element id -> signature written back during the save in progress. */
	private readonly pending = new Map<string, string>();

	/** Every copy the save in progress looked at, keyed by element id. */
	private readonly seen = new Map<string, SeenCopy[]>();

	/** Forget everything; called wherever the other per-load caches are cleared. */
	reset(): void {
		this.baselines.clear();
		this.pending.clear();
		this.seen.clear();
		this.stale = new WeakSet();
	}

	/**
	 * Record the as-parsed signature of freshly produced inherited copies. A
	 * baseline is written once per id: a later re-parse of the same part (layout
	 * switch, preview decoding) must not move it, because the part's XML may by
	 * then already carry an edit the tracker has committed.
	 */
	recordBaselines(elements: readonly PptxElement[]): void {
		for (const element of elements) {
			if (!this.baselines.has(element.id)) {
				this.baselines.set(element.id, templateElementSignature(element));
			}
		}
	}

	/** Drop any bookkeeping left over from a save that did not complete. */
	beginSave(): void {
		this.pending.clear();
		this.seen.clear();
	}

	/**
	 * Decide whether the save writer has to write this copy back into its
	 * part. `false` means the part already holds it (or a newer edit of it),
	 * so the shared `rawXml` must be left untouched.
	 */
	shouldWriteBack(element: PptxElement): boolean {
		if (this.stale.has(element)) {
			return false;
		}
		const signature = templateElementSignature(element);
		this.remember(element, signature);
		const baseline = this.baselines.get(element.id);
		if (baseline !== undefined && baseline === signature) {
			return false;
		}
		this.pending.set(element.id, signature);
		return true;
	}

	/**
	 * Promote the signatures written during this save to baselines, and mark
	 * every other copy of the same id that still matched the previous baseline
	 * as stale.
	 */
	commitSave(): void {
		for (const [id, signature] of this.pending) {
			const previous = this.baselines.get(id);
			for (const copy of this.seen.get(id) ?? []) {
				if (copy.signature !== signature && copy.signature === previous) {
					this.stale.add(copy.element);
				}
			}
			this.baselines.set(id, signature);
		}
		this.pending.clear();
		this.seen.clear();
	}

	private remember(element: PptxElement, signature: string): void {
		const copies = this.seen.get(element.id);
		if (copies) {
			copies.push({ element, signature });
		} else {
			this.seen.set(element.id, [{ element, signature }]);
		}
	}
}
