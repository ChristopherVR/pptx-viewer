/**
 * find-bar.component.ts: Floating text-search bar for the PPTX viewer.
 *
 * Selector: `pptx-find-bar`
 *
 * Usage:
 * ```html
 * <pptx-find-bar
 *   [slides]="loader.slides()"
 *   (navigate)="goTo($event)"
 *   (closed)="showFind.set(false)"
 * />
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	computed,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { searchSlides } from './slide-search';
import type { SlideSearchMatch } from './slide-search';

@Component({
	selector: 'pptx-find-bar',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="pptx-find-bar"
			role="search"
			[attr.aria-label]="'pptx.findBar.ariaLabel' | translate"
		>
			<!-- Input row -->
			<div class="pptx-find-bar__row">
				<input
					#queryInput
					class="pptx-find-bar__input"
					type="search"
					[placeholder]="'pptx.findBar.placeholder' | translate"
					[attr.aria-label]="'pptx.findBar.searchQuery' | translate"
					[value]="query()"
					(input)="onInput($event)"
					(keydown.enter)="next()"
				/>

				<span class="pptx-find-bar__count" aria-live="polite" aria-atomic="true">
					@if (query().trim()) {
						@if (totalMatches() === 0) {
							{{ 'pptx.findBar.noResults' | translate }}
						} @else {
							{{
								'pptx.findBar.resultsSummary'
									| translate
										: {
												current: activeMatchDisplay(),
												total: totalMatches(),
												slides: matches().length,
										  }
							}}
						}
					}
				</span>

				<button
					type="button"
					class="pptx-find-bar__btn"
					[attr.aria-label]="'pptx.findReplace.previousMatch' | translate"
					[disabled]="totalMatches() === 0"
					(click)="prev()"
				>
					&#8593;
				</button>

				<button
					type="button"
					class="pptx-find-bar__btn"
					[attr.aria-label]="'pptx.findReplace.nextMatch' | translate"
					[disabled]="totalMatches() === 0"
					(click)="next()"
				>
					&#8595;
				</button>

				<button
					type="button"
					class="pptx-find-bar__btn pptx-find-bar__btn--close"
					[attr.aria-label]="'pptx.findBar.close' | translate"
					(click)="close()"
				>
					&#10005;
				</button>
			</div>

			<!-- Snippet preview for the active match -->
			@if (activeSnippet()) {
				<div
					class="pptx-find-bar__snippet"
					[attr.aria-label]="'pptx.findBar.matchContext' | translate"
				>
					{{ activeSnippet() }}
				</div>
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				position: fixed;
				top: 3.5rem;
				right: 1rem;
				z-index: 100;
			}

			.pptx-find-bar {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				min-width: 22rem;
				padding: 0.5rem 0.625rem;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 0.375rem;
				background: #1e1e1e;
				color: #e5e5e5;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
				font-size: 0.8125rem;
			}

			.pptx-find-bar__row {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}

			.pptx-find-bar__input {
				flex: 1;
				min-width: 0;
				padding: 0.3rem 0.5rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.25rem;
				background: rgba(255, 255, 255, 0.06);
				color: inherit;
				font-size: inherit;
				outline: none;
			}

			.pptx-find-bar__input:focus {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.08);
			}

			/* Remove the default search cancel button in WebKit */
			.pptx-find-bar__input::-webkit-search-cancel-button {
				display: none;
			}

			.pptx-find-bar__count {
				white-space: nowrap;
				color: rgba(255, 255, 255, 0.5);
				font-size: 0.75rem;
				min-width: 7rem;
				text-align: right;
			}

			.pptx-find-bar__btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 1px solid rgba(255, 255, 255, 0.1);
				border-radius: 0.25rem;
				background: rgba(255, 255, 255, 0.06);
				color: inherit;
				cursor: pointer;
				transition: background 0.12s;
				flex-shrink: 0;
				font-size: 0.875rem;
				line-height: 1;
			}

			.pptx-find-bar__btn:hover:not(:disabled) {
				background: rgba(255, 255, 255, 0.14);
			}

			.pptx-find-bar__btn:disabled {
				opacity: 0.35;
				cursor: not-allowed;
			}

			.pptx-find-bar__btn--close {
				border-color: transparent;
				font-size: 0.75rem;
			}

			.pptx-find-bar__snippet {
				padding: 0.25rem 0.375rem;
				border-radius: 0.25rem;
				background: rgba(255, 255, 255, 0.04);
				color: rgba(255, 255, 255, 0.6);
				font-size: 0.6875rem;
				line-height: 1.4;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
		`,
	],
})
export class FindBarComponent {
	// -------------------------------------------------------------------------
	// Inputs / outputs
	// -------------------------------------------------------------------------

	/** All slides in the current presentation. */
	readonly slides = input.required<PptxSlide[]>();

	/** Emits the zero-based slide index to navigate to. */
	readonly navigate = output<number>();

	/** Emits when the user closes the find bar (Escape or ✕). */
	readonly closed = output<void>();

	// -------------------------------------------------------------------------
	// Template reference
	// -------------------------------------------------------------------------

	private readonly queryInputRef = viewChild<ElementRef<HTMLInputElement>>('queryInput');

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	/** Current text typed into the search input. */
	readonly query = signal('');

	/**
	 * Zero-based index into the flat `matches` array tracking which result is
	 * currently highlighted. Clamped whenever `matches` changes.
	 */
	readonly activeMatchIndex = signal(0);

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	/** Slides that contain at least one match for the current query. */
	readonly matches = computed<SlideSearchMatch[]>(() => searchSlides(this.slides(), this.query()));

	/** Total number of individual occurrences across all matching slides. */
	readonly totalMatches = computed<number>(() =>
		this.matches().reduce((sum, m) => sum + m.matchCount, 0),
	);

	/**
	 * 1-based display position (which slide-level result we're on).
	 * Accounts for clamping when the match list shrinks.
	 */
	readonly activeMatchDisplay = computed<number>(() => {
		const len = this.matches().length;
		if (len === 0) {
			return 0;
		}
		const idx = Math.min(this.activeMatchIndex(), len - 1);
		return idx + 1;
	});

	/** Snippet text for the currently active match. */
	readonly activeSnippet = computed<string>(() => {
		const ms = this.matches();
		if (ms.length === 0) {
			return '';
		}
		const idx = Math.min(this.activeMatchIndex(), ms.length - 1);
		return ms[idx].snippet;
	});

	// -------------------------------------------------------------------------
	// Keyboard handling
	// -------------------------------------------------------------------------

	/**
	 * Pressing Escape anywhere on the document closes the find bar.
	 * (Enter inside the input already calls `next()` via `keydown.enter`.)
	 */
	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			this.close();
		}
	}

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	onInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		this.query.set(target.value);
		// Reset to first match whenever the query changes.
		this.activeMatchIndex.set(0);
		this._emitCurrentSlide();
	}

	next(): void {
		const len = this.matches().length;
		if (len === 0) {
			return;
		}
		const next = (this.activeMatchIndex() + 1) % len;
		this.activeMatchIndex.set(next);
		this._emitCurrentSlide();
	}

	prev(): void {
		const len = this.matches().length;
		if (len === 0) {
			return;
		}
		const prev = (this.activeMatchIndex() - 1 + len) % len;
		this.activeMatchIndex.set(prev);
		this._emitCurrentSlide();
	}

	close(): void {
		this.closed.emit();
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	private _emitCurrentSlide(): void {
		const ms = this.matches();
		if (ms.length === 0) {
			return;
		}
		const idx = Math.min(this.activeMatchIndex(), ms.length - 1);
		this.navigate.emit(ms[idx].slideIndex);
	}
}
