import type { PptxSlide } from 'pptx-viewer-core';
import type { FindResult } from 'pptx-viewer-shared';
import { findInSlides, replaceInSlides, replaceMatch } from 'pptx-viewer-shared';

/**
 * Reactive Find & Replace panel state for the Home tab's Editing group.
 * Wraps the shared, framework-agnostic `render/find-replace` functions
 * (pure slide-array search/replace); this class owns only the panel's UI
 * state (query, current match, open/closed) and routes every replace through
 * the host's history-tracked commit so undo/redo cover it.
 */
export interface FindReplaceDeps {
	getSlides(): readonly PptxSlide[];
	/** Commit a fully-replaced slide array (pushes history, marks dirty). */
	commitSlides(next: PptxSlide[]): void;
	/** Called with the match's slide/element so the host can navigate to it. */
	onNavigate?(slideIndex: number, elementId: string): void;
}

export class FindReplaceState {
	open = $state(false);
	query = $state('');
	replacement = $state('');
	matchCase = $state(false);
	results = $state.raw<FindResult[]>([]);
	index = $state(0);

	readonly #deps: FindReplaceDeps;

	constructor(deps: FindReplaceDeps) {
		this.#deps = deps;
	}

	get hasResults(): boolean {
		return this.results.length > 0;
	}

	get matchCount(): number {
		return this.results.length;
	}

	toggle(): void {
		this.open = !this.open;
		if (this.open) {
			this.search();
		}
	}

	close(): void {
		this.open = false;
	}

	/** Re-run the search from the current query/matchCase and jump to the first match. */
	search(): void {
		this.results = this.query
			? findInSlides(this.#deps.getSlides(), this.query, { matchCase: this.matchCase })
			: [];
		this.index = 0;
		this.#navigateCurrent();
	}

	next(): void {
		this.#step(1);
	}

	prev(): void {
		this.#step(-1);
	}

	#step(direction: 1 | -1): void {
		if (this.results.length === 0) {
			return;
		}
		this.index = (this.index + direction + this.results.length) % this.results.length;
		this.#navigateCurrent();
	}

	#navigateCurrent(): void {
		const match = this.results[this.index];
		if (match) {
			this.#deps.onNavigate?.(match.slideIndex, match.elementId);
		}
	}

	/** Replace the current match, then refresh the result set. */
	replaceCurrent(): void {
		if (this.results.length === 0) {
			return;
		}
		const result = replaceMatch(this.#deps.getSlides(), this.results, this.index, this.replacement);
		this.#deps.commitSlides([...result.slides]);
		this.search();
	}

	/** Replace every match of the current query, then refresh the result set. */
	replaceAll(): void {
		if (!this.query) {
			return;
		}
		const result = replaceInSlides(this.#deps.getSlides(), this.query, this.replacement, {
			matchCase: this.matchCase,
		});
		this.#deps.commitSlides([...result.slides]);
		this.search();
	}
}
