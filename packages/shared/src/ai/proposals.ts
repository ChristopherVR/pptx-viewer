/**
 * {@link ProposalStore} - the staging area for AI-proposed writes.
 *
 * When the write policy is `'stage'` / `'approve'`, an edit tool does not touch
 * the document directly. Instead it registers a {@link PptxAiSlidesUpdater} here
 * as a {@link StagedProposal}, together with a human-readable diff summary. The
 * host UI can then present the pending change and, on accept, apply it through
 * {@link PptxAiBridge.applySlidesUpdate} as ONE undoable history entry (or drop
 * it on revert). This keeps AI edits reviewable and atomic.
 */

import type { PptxSlide } from 'pptx-viewer-core';

import type { PptxAiBridge, PptxAiSlidesUpdater } from './bridge';
import type { AiChangeAnimator } from './change-animator';
import { diffSlides } from './proposals-diff';

/** A pending, not-yet-applied write. */
export interface StagedProposal {
	/** Stable id for accept/revert. */
	id: string;
	/** Short label used as the history-entry name when applied. */
	label: string;
	/** Human-readable change lines (from {@link diffSlides}). */
	summary: string[];
	/** Epoch ms when staged. */
	createdAt: number;
	/** The updater to run against the live deck on apply. */
	updater: PptxAiSlidesUpdater;
}

/** Public (serialisable) view of a proposal, without the updater closure. */
export interface ProposalView {
	id: string;
	label: string;
	summary: string[];
	createdAt: number;
}

let counter = 0;
function nextId(): string {
	counter += 1;
	return `proposal-${Date.now().toString(36)}-${counter}`;
}

function cloneSlides(slides: PptxSlide[]): PptxSlide[] {
	return structuredClone(slides);
}

export class ProposalStore {
	private readonly proposals = new Map<string, StagedProposal>();

	constructor(
		private readonly bridge: PptxAiBridge,
		private readonly animator?: AiChangeAnimator,
	) {}

	/** Apply an updater to the deck and animate the resulting element changes. */
	private applyAndAnimate(updater: PptxAiSlidesUpdater, label: string): void {
		const before = this.bridge.getSlides();
		const after = this.animator ? updater(cloneSlides(before)) : null;
		this.bridge.applySlidesUpdate(updater, label);
		if (after) {
			this.animator?.publish(before, after);
		}
	}

	/**
	 * Stage an updater. Runs it against a clone of the current slides to compute
	 * a diff summary, but does NOT apply it to the live deck.
	 */
	stage(label: string, updater: PptxAiSlidesUpdater): StagedProposal {
		const before = this.bridge.getSlides();
		const after = updater(cloneSlides(before));
		const proposal: StagedProposal = {
			id: nextId(),
			label,
			summary: diffSlides(before, after),
			createdAt: Date.now(),
			updater,
		};
		this.proposals.set(proposal.id, proposal);
		return proposal;
	}

	/** List staged proposals (oldest first), without their updater closures. */
	list(): ProposalView[] {
		return [...this.proposals.values()]
			.sort((a, b) => a.createdAt - b.createdAt)
			.map(({ updater: _updater, ...view }) => view);
	}

	/** Number of staged proposals. */
	get size(): number {
		return this.proposals.size;
	}

	/** Look up one proposal's serialisable view. */
	get(id: string): ProposalView | undefined {
		const p = this.proposals.get(id);
		if (!p) {
			return undefined;
		}
		const { updater: _updater, ...view } = p;
		return view;
	}

	/**
	 * Apply a staged proposal to the live deck as a single history entry, then
	 * remove it. Returns `false` when the id is unknown.
	 */
	apply(id: string): boolean {
		const p = this.proposals.get(id);
		if (!p) {
			return false;
		}
		this.applyAndAnimate(p.updater, p.label);
		this.proposals.delete(id);
		return true;
	}

	/** Drop a staged proposal without applying it. */
	revert(id: string): boolean {
		return this.proposals.delete(id);
	}

	/**
	 * Apply every staged proposal in staged order. Each becomes its own history
	 * entry. Returns the number of proposals applied.
	 */
	acceptAll(): number {
		const ordered = [...this.proposals.values()].sort((a, b) => a.createdAt - b.createdAt);
		for (const p of ordered) {
			this.applyAndAnimate(p.updater, p.label);
		}
		const applied = ordered.length;
		this.proposals.clear();
		return applied;
	}

	/** Drop all staged proposals without applying them. */
	clear(): void {
		this.proposals.clear();
	}
}
