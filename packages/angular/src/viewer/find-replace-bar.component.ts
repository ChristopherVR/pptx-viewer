/**
 * find-replace-bar.component.ts: Floating find-and-replace bar.
 *
 * Selector: `pptx-find-replace-bar`
 *
 * Ported from:
 *   packages/react/src/viewer/components/FindReplacePanel.tsx
 *   packages/react/src/viewer/hooks/useFindReplace.ts
 *
 * This component is **purely presentational**: it holds no slide data and
 * performs no text mutation itself.  The parent component is responsible for:
 *
 *   - Feeding the current `matchCount` and `matchIndex` computed from slides.
 *   - Listening to `find`, `navigate`, `replaceOne`, `replaceAll`, and `close`
 *     outputs and delegating to `EditorStateService` / `findInSlides`.
 *
 * Usage:
 * ```html
 * <pptx-find-replace-bar
 *   [matchCount]="totalMatches()"
 *   [matchIndex]="activeResultIndex()"
 *   (find)="onFind($event)"
 *   (navigate)="onNavigate($event)"
 *   (replaceOne)="onReplaceOne($event)"
 *   (replaceAll)="onReplaceAll($event)"
 *   (close)="showFindReplace.set(false)"
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

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

/** Emitted when the user changes the find query or the case-sensitive toggle. */
export interface FindEvent {
	query: string;
	matchCase: boolean;
}

/** Emitted when the user confirms a replacement action. */
export interface ReplaceEvent {
	query: string;
	replacement: string;
	matchCase: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
	selector: 'pptx-find-replace-bar',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="pptx-frb"
			role="dialog"
			[attr.aria-label]="'pptx.findReplace.ariaLabel' | translate"
		>
			<!-- ── Find row ───────────────────────────────────────────────── -->
			<div class="pptx-frb__row">
				<input
					#findInput
					class="pptx-frb__input"
					type="search"
					[placeholder]="'pptx.findReplace.findPlaceholder' | translate"
					[attr.aria-label]="'pptx.findReplace.searchText' | translate"
					[value]="query()"
					(input)="onQueryInput($event)"
					(keydown.enter)="navigate.emit(1)"
				/>

				<!-- Case-sensitive toggle -->
				<button
					type="button"
					class="pptx-frb__btn"
					[class.pptx-frb__btn--active]="matchCase()"
					[attr.aria-label]="'pptx.findReplace.matchCase' | translate"
					[attr.aria-pressed]="matchCase()"
					(click)="toggleCase()"
					[title]="'pptx.findReplace.matchCase' | translate"
				>
					Aa
				</button>

				<!-- Match counter -->
				<span class="pptx-frb__count" aria-live="polite" aria-atomic="true">
					@if (query().trim()) {
						@if (matchCount() === 0) {
							{{ 'pptx.findReplace.noMatches' | translate }}
						} @else {
							{{
								'pptx.findReplace.matchCount'
									| translate: { current: displayIndex(), total: matchCount() }
							}}
						}
					}
				</span>

				<button
					type="button"
					class="pptx-frb__btn"
					[attr.aria-label]="'pptx.findReplace.previousMatch' | translate"
					[disabled]="matchCount() === 0"
					(click)="navigate.emit(-1)"
				>
					&#8593;
				</button>

				<button
					type="button"
					class="pptx-frb__btn"
					[attr.aria-label]="'pptx.findReplace.nextMatch' | translate"
					[disabled]="matchCount() === 0"
					(click)="navigate.emit(1)"
				>
					&#8595;
				</button>

				<button
					type="button"
					class="pptx-frb__btn pptx-frb__btn--close"
					[attr.aria-label]="'pptx.findReplace.closeAriaLabel' | translate"
					(click)="close.emit()"
				>
					&#10005;
				</button>
			</div>

			<!-- ── Replace row ────────────────────────────────────────────── -->
			<div class="pptx-frb__row pptx-frb__row--replace">
				<input
					class="pptx-frb__input"
					type="text"
					[placeholder]="'pptx.findReplace.replacePlaceholder' | translate"
					[attr.aria-label]="'pptx.findReplace.replacementText' | translate"
					[value]="replacement()"
					(input)="onReplacementInput($event)"
					(keydown.enter)="emitReplaceOne()"
				/>

				<button
					type="button"
					class="pptx-frb__action-btn"
					[disabled]="matchCount() === 0"
					(click)="emitReplaceOne()"
					[attr.aria-label]="'pptx.findReplace.replaceCurrent' | translate"
				>
					{{ 'pptx.findReplace.replace' | translate }}
				</button>

				<button
					type="button"
					class="pptx-frb__action-btn"
					[disabled]="matchCount() === 0"
					(click)="emitReplaceAll()"
					[attr.aria-label]="'pptx.findReplace.replaceAllMatches' | translate"
				>
					{{ 'pptx.findReplace.replaceAll' | translate }}
				</button>
			</div>
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

			.pptx-frb {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				min-width: 26rem;
				padding: 0.5rem 0.625rem;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 0.375rem;
				background: #1e1e1e;
				color: #e5e5e5;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
				font-size: 0.8125rem;
			}

			.pptx-frb__row {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}

			.pptx-frb__row--replace {
				padding-top: 0.125rem;
				border-top: 1px solid rgba(255, 255, 255, 0.07);
			}

			.pptx-frb__input {
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

			.pptx-frb__input:focus {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.08);
			}

			/* Remove default webkit search cancel button */
			.pptx-frb__input::-webkit-search-cancel-button {
				display: none;
			}

			.pptx-frb__count {
				white-space: nowrap;
				color: rgba(255, 255, 255, 0.5);
				font-size: 0.75rem;
				min-width: 5.5rem;
				text-align: right;
			}

			.pptx-frb__btn {
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

			.pptx-frb__btn:hover:not(:disabled) {
				background: rgba(255, 255, 255, 0.14);
			}

			.pptx-frb__btn:disabled {
				opacity: 0.35;
				cursor: not-allowed;
			}

			.pptx-frb__btn--active {
				background: rgba(59, 130, 246, 0.3);
				border-color: rgba(59, 130, 246, 0.6);
				color: #93c5fd;
			}

			.pptx-frb__btn--close {
				border-color: transparent;
				font-size: 0.75rem;
			}

			.pptx-frb__action-btn {
				padding: 0.25rem 0.625rem;
				border: 1px solid rgba(255, 255, 255, 0.15);
				border-radius: 0.25rem;
				background: rgba(255, 255, 255, 0.08);
				color: inherit;
				font-size: 0.75rem;
				cursor: pointer;
				white-space: nowrap;
				transition: background 0.12s;
				flex-shrink: 0;
			}

			.pptx-frb__action-btn:hover:not(:disabled) {
				background: rgba(255, 255, 255, 0.16);
			}

			.pptx-frb__action-btn:disabled {
				opacity: 0.35;
				cursor: not-allowed;
			}
		`,
	],
})
export class FindReplaceBarComponent {
	// -------------------------------------------------------------------------
	// Inputs
	// -------------------------------------------------------------------------

	/**
	 * Total number of matches found across all slides for the current query.
	 * Kept at 0 when no search has been performed yet.
	 */
	readonly matchCount = input<number>(0);

	/**
	 * Zero-based index of the currently highlighted match.
	 * Used to derive the 1-based display counter.
	 */
	readonly matchIndex = input<number>(-1);

	// -------------------------------------------------------------------------
	// Outputs
	// -------------------------------------------------------------------------

	/**
	 * Emitted whenever the find query or the case-sensitive toggle changes.
	 * The parent should run `findInSlides` and update `matchCount`/`matchIndex`.
	 */
	readonly find = output<FindEvent>();

	/**
	 * Emitted when the user clicks ↑ / ↓ or presses Enter in the find input.
	 * Payload is `1` (next) or `-1` (previous).
	 * The parent advances `matchIndex` and navigates to the matching slide.
	 */
	readonly navigate = output<1 | -1>();

	/**
	 * Emitted when the user clicks "Replace" (single match).
	 * The parent calls `replaceMatch(...)` on `EditorStateService`.
	 */
	readonly replaceOne = output<ReplaceEvent>();

	/**
	 * Emitted when the user clicks "Replace All".
	 * The parent calls `replaceInSlides(...)` and commits the result to history.
	 */
	readonly replaceAll = output<ReplaceEvent>();

	/** Emitted when the user closes the bar (Escape or ✕ button). */
	readonly close = output<void>();

	// -------------------------------------------------------------------------
	// Template reference
	// -------------------------------------------------------------------------

	private readonly findInputRef = viewChild<ElementRef<HTMLInputElement>>('findInput');

	// -------------------------------------------------------------------------
	// Internal state
	// -------------------------------------------------------------------------

	/** Current text in the find input. */
	readonly query = signal('');

	/** Current text in the replacement input. */
	readonly replacement = signal('');

	/** Whether the search should be case-sensitive. */
	readonly matchCase = signal(false);

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	/** 1-based display index for the counter (e.g. "2 / 5"). Clamps to bounds. */
	readonly displayIndex = computed<number>(() => {
		const count = this.matchCount();
		if (count === 0) {
			return 0;
		}
		const idx = this.matchIndex();
		if (idx < 0) {
			return 1;
		}
		return Math.min(idx + 1, count);
	});

	// -------------------------------------------------------------------------
	// Keyboard handling
	// -------------------------------------------------------------------------

	/** Escape anywhere on the document closes the bar. */
	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			this.close.emit();
		}
	}

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	onQueryInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		this.query.set(target.value);
		this.find.emit({ query: target.value, matchCase: this.matchCase() });
	}

	onReplacementInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		this.replacement.set(target.value);
	}

	toggleCase(): void {
		const next = !this.matchCase();
		this.matchCase.set(next);
		this.find.emit({ query: this.query(), matchCase: next });
	}

	emitReplaceOne(): void {
		if (this.matchCount() === 0) {
			return;
		}
		this.replaceOne.emit({
			query: this.query(),
			replacement: this.replacement(),
			matchCase: this.matchCase(),
		});
	}

	emitReplaceAll(): void {
		if (this.matchCount() === 0) {
			return;
		}
		this.replaceAll.emit({
			query: this.query(),
			replacement: this.replacement(),
			matchCase: this.matchCase(),
		});
	}

	/** Focus the find input (called by the parent after toggling the bar open). */
	focusFindInput(): void {
		this.findInputRef()?.nativeElement.focus();
	}
}
